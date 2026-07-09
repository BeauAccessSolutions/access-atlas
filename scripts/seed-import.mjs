// Seed importer — loads a curated JSON dataset (docs/seed-format.md) into
// Postgres. Built for the WNY beachhead seed (research/seed-nys/), but generic.
//
// GUARANTEES (enforced below, from the project constitution):
//   * Imports create ONLY self_reported claims — or `sourced` when a record
//     explicitly cites a certification/audit/partner (§4). It CANNOT create
//     confirmations; community trust is earned from real first-person visits,
//     never seeded (§2, §4, §14).
//   * Idempotent: upserts listings on `source_ref`, so re-running after fixing
//     the dataset doesn't duplicate rows.
//   * Honest: refuses unknown attribute keys instead of silently dropping them,
//     and every listing must carry a source_url (§7).
//   * `--dry-run` validates + previews and writes nothing. Use it first.
//
// Usage:
//   npm run seed:import -- <file.json> --dry-run
//   npm run seed:import -- <file.json>
import { readFileSync } from 'node:fs';
import { serviceClient, parseArgs } from './lib/db.mjs';

// Allowed scannability categories — mirror of src/lib/categories.ts. Inlined
// (not imported) so this script stays pure ESM and runs on the Node 20 floor.
// Keep in sync with categories.ts (it's a small, stable list).
const CATEGORIES = [
  'healthcare', 'disability_services', 'business',
  'library', 'arts_culture', 'parks_recreation', 'transit',
];

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
const dryRun = Boolean(args['dry-run']);

if (!file) {
  console.error('Usage: npm run seed:import -- <file.json> [--dry-run]');
  process.exit(1);
}

// ---- load + shape-validate the dataset (before touching the DB) -------------

let dataset;
try {
  dataset = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Could not read/parse ${file}: ${e.message}`);
  process.exit(1);
}

const listings = Array.isArray(dataset.listings) ? dataset.listings : null;
if (!listings) {
  console.error('Dataset must have a top-level "listings" array (see docs/seed-format.md).');
  process.exit(1);
}

const errors = [];
const seenRefs = new Set();
for (const [i, l] of listings.entries()) {
  const at = `listings[${i}]${l?.name ? ` "${l.name}"` : ''}`;
  if (!l || typeof l !== 'object') { errors.push(`${at}: not an object`); continue; }
  if (l.kind !== 'place' && l.kind !== 'provider') errors.push(`${at}: kind must be "place" or "provider"`);
  if (!l.name || typeof l.name !== 'string') errors.push(`${at}: missing name`);
  if (!l.source_ref || typeof l.source_ref !== 'string') errors.push(`${at}: missing source_ref (the idempotency key)`);
  else if (seenRefs.has(l.source_ref)) errors.push(`${at}: duplicate source_ref "${l.source_ref}" within this file`);
  else seenRefs.add(l.source_ref);
  if (!l.source_url || typeof l.source_url !== 'string') errors.push(`${at}: missing source_url (provenance is required — §7)`);
  if (l.provider && l.kind !== 'provider') errors.push(`${at}: has a provider block but kind is "${l.kind}"`);
  for (const f of ['disabled_owned', 'disabled_led']) {
    if (f in l && typeof l[f] !== 'boolean') errors.push(`${at}: ${f} must be a boolean`);
  }
  if (l.category != null && !CATEGORIES.includes(l.category))
    errors.push(`${at}: unknown category "${l.category}" (allowed: ${CATEGORIES.join(', ')})`);
  if (l.attributes && !Array.isArray(l.attributes)) errors.push(`${at}: attributes must be an array`);
  for (const [j, a] of (l.attributes ?? []).entries()) {
    if (!a?.key) errors.push(`${at}: attributes[${j}] missing key`);
    if (a?.sourced && !a?.sourced_note) errors.push(`${at}: attributes[${j}] sourced=true requires sourced_note (§4)`);
  }
}
if (errors.length) {
  console.error(`Dataset has ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// Shape is valid — report it BEFORE the DB step so a reviewer with no local
// backend still gets confirmation (key validation below needs the live catalog).
const shapeClaimCount = listings.reduce((n, l) => n + (l.attributes?.length ?? 0), 0);
console.log(`Shape OK: ${listings.length} listing(s), ${shapeClaimCount} attribute claim(s). Checking attribute keys against the live catalog…`);

// ---- validate attribute keys against the LIVE catalog -----------------------

const db = serviceClient();

const { data: defs, error: defsErr } = await db
  .from('attribute_definitions')
  .select('id, key, applies_to_kind');
if (defsErr) {
  console.error(`Could not read attribute_definitions: ${defsErr.message}`);
  process.exit(1);
}
const defByKey = new Map(defs.map((d) => [d.key, d]));

const keyErrors = [];
for (const l of listings) {
  for (const a of l.attributes ?? []) {
    const def = defByKey.get(a.key);
    if (!def) { keyErrors.push(`"${l.name}": unknown attribute key "${a.key}"`); continue; }
    if (def.applies_to_kind && def.applies_to_kind !== l.kind) {
      keyErrors.push(`"${l.name}" (${l.kind}): attribute "${a.key}" only applies to ${def.applies_to_kind}`);
    }
  }
}
if (keyErrors.length) {
  console.error(`${keyErrors.length} attribute problem(s):`);
  for (const e of keyErrors) console.error(`  - ${e}`);
  console.error(`Valid keys: ${[...defByKey.keys()].join(', ')}`);
  process.exit(1);
}

console.log(
  `Dataset OK: ${listings.length} listing(s), ` +
    `${listings.reduce((n, l) => n + (l.attributes?.length ?? 0), 0)} attribute claim(s).`,
);
if (dataset.source) console.log(`Source: ${dataset.source}`);

if (dryRun) {
  console.log('\n--dry-run: no changes written. Preview:');
  for (const l of listings) {
    const claims = (l.attributes ?? []).map((a) => `${a.key}${a.sourced ? ' [sourced]' : ''}`).join(', ');
    console.log(`  • [${l.kind}] ${l.name} — ${l.city ?? '?'} (${l.source_ref})`);
    if (claims) console.log(`      claims (self-reported): ${claims}`);
  }
  process.exit(0);
}

// ---- apply (idempotent) -----------------------------------------------------

let listingsUpserted = 0, claimsUpserted = 0;

for (const l of listings) {
  // Upsert the listing on source_ref. onConflict returns the row either way.
  const { data: listing, error: lErr } = await db
    .from('listings')
    .upsert(
      {
        kind: l.kind,
        name: l.name,
        summary: l.summary ?? null,
        street: l.street ?? null,
        city: l.city ?? null,
        region: l.region ?? null,
        postal_code: l.postal_code ?? null,
        lat: l.lat ?? null,
        lng: l.lng ?? null,
        category: l.category ?? null,
        // Representation (§12) is top-level: it applies to places AND providers.
        disabled_owned: Boolean(l.disabled_owned),
        disabled_led: Boolean(l.disabled_led),
        source_ref: l.source_ref,
        source_url: l.source_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_ref' },
    )
    .select('id')
    .single();
  if (lErr) {
    console.error(`Failed to upsert "${l.name}": ${lErr.message}`);
    process.exit(1);
  }
  listingsUpserted++;

  if (l.kind === 'provider') {
    const p = l.provider ?? {};
    // provider_profiles holds only provider-specific competence now; ownership /
    // leadership went to the listing above (both kinds carry them).
    const { error: pErr } = await db.from('provider_profiles').upsert(
      { listing_id: listing.id, disability_literate: Boolean(p.disability_literate) },
      { onConflict: 'listing_id' },
    );
    if (pErr) { console.error(`Failed provider_profile for "${l.name}": ${pErr.message}`); process.exit(1); }
  }

  for (const a of l.attributes ?? []) {
    const def = defByKey.get(a.key);
    // Upsert the claim on (listing_id, attribute_def_id) — its unique key. This
    // creates a self_reported claim (no confirmations) or, if explicitly cited,
    // a sourced one. It NEVER inserts confirmations.
    const { error: cErr } = await db.from('attribute_claims').upsert(
      {
        listing_id: listing.id,
        attribute_def_id: def.id,
        asserted_value: a.asserted_value ?? true,
        sourced: Boolean(a.sourced),
        sourced_note: a.sourced ? a.sourced_note : null,
      },
      { onConflict: 'listing_id,attribute_def_id' },
    );
    if (cErr) { console.error(`Failed claim ${a.key} for "${l.name}": ${cErr.message}`); process.exit(1); }
    claimsUpserted++;
  }
}

console.log(
  `\nDone. Listings upserted: ${listingsUpserted}. ` +
    `Attribute claims upserted: ${claimsUpserted} (all self-reported unless explicitly sourced).`,
);
console.log('Every imported claim reads "self-reported / awaiting verification" until the community validates it (§4).');
