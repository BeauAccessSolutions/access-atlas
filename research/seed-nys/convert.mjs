// One-time converter: the WNY research batch (listings.json — the research
// task's own shape: candidate_id / attribute_key / flags) -> the canonical
// importer seed format (docs/seed-format.md). Deterministic + documented so the
// human review pass has a clear, reproducible diff to check.
//
// This does NOT finalize the data and does NOT write to any database. It emits a
// CANDIDATE seed file for review. Everything imports as `self_reported` (§4).
//
// Data-quality rules applied (from gaps.md §4 — bias toward caution, §4):
//   * DROP the whole listing if it isn't real/available yet.
//   * DROP all attribute claims on physical-safety-caution records, so we never
//     assert access that is partial, elevator-dependent, or not-yet-built. The
//     listing stays (it exists); it just carries no claim until a visit. The
//     reviewer can restore a nuanced claim.
//   * PROMOTE provider accessible-parking evidence that the research had to hold
//     as a note (Gap B is now fixed — providers can carry accessible_parking).
//   * Carry the research's flags + source_notes into a `_review` field so the
//     reviewer sees them (the importer ignores underscore-prefixed fields).
//
// Run:  node research/seed-nys/convert.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, 'listings.json');
const OUT = resolve(HERE, 'wny-2026-07.seed.json');

// The live attribute catalog (mirror of seed.sql / src/lib/seed.ts ATTR).
const CATALOG = {
  entrance_step_free: 'both',
  accessible_restroom: 'both',
  accessible_parking: 'both',
  height_adjustable_exam_table: 'provider',
  accessible_scale: 'provider',
  communicated_directly: 'provider',
  staff_knew_equipment: 'provider',
};
const kindOk = (key, kind) => CATALOG[key] === 'both' || CATALOG[key] === kind;

// Flags that remove the listing entirely (not real/available).
const DROP_LISTING = new Set(['planned_2027_not_operational']);
// Editorial exclusions (reviewer decision 2026-07-08): pure-B2B service-disabled-
// veteran-owned firms (construction / IT / snow plowing) that are legitimately
// disabled-owned but are NOT accessible places or disability-competent providers
// and carry zero accessibility claims. They'd make the representation axis (§1)
// read as veteran-B2B padding. Kept in the raw batch for a possible future
// disabled-owned-business directory. Service Bridges (Deaf-owned interpreting) and
// Fly By Cafe (a visitable place) are RETAINED.
const DROP_CANDIDATE = new Set([
  'hoag-group',
  'greater-frontier',
  'vanguard-innovative',
  'buffalo-veteran-contracting',
  'aveteran-corp',
  'cw-snow-plowing',
]);
// Attributes we could not verify from here and won't assert (§4): Explore & More's
// accessibility page hard-blocks fetching (403 to curl AND WebFetch), so its claim
// is unconfirmable — drop the claim, keep the listing until a visit / re-fetch.
const DROP_ATTRS_FOR_CANDIDATE = new Set(['explore-and-more']);
// Flags where asserting a positive access claim could misrepresent physical
// safety — drop the claims, keep the listing (§4). Reviewer restores nuance.
const DROP_ATTRS = new Set([
  'project_in_progress_reverify', // feature was under construction
  'partial_accessibility_caution', // e.g. Shea's — not fully accessible, no elevator
  'elevator_dependent_underground', // access hinges on elevators that can fail
]);
const PROMOTE_PARKING = 'provider_parking_evidence_no_schema_slot';
// Source upgrades (reviewer 2026-07-08): replace a weak/transient source with a
// durable first-party one that was corroborated during the review pass.
const SOURCE_OVERRIDE = {
  // The 2015 PR Newswire release is corroborated by Catholic Health's own
  // Language Assistance compliance page — cite that instead.
  'catholic-health-wny': 'https://www.chsbuffalo.org/about-us/compliance-program/language-assistance/',
};

// Coarse category classifier (mirror of src/lib/categories.ts classifyCategory —
// inlined so this script stays pure ESM). Name-only, first match wins; null if
// none. Explicit overrides for names that don't self-describe.
const CATEGORY_OVERRIDE = {
  // A Deaf-owned ASL interpreting agency — a disability service; the name alone
  // ("Service Bridges, Inc.") doesn't reveal it.
  'service-bridges': 'disability_services',
};
function classifyCategory(name) {
  const t = name.toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has('independent living', 'peer connection', 'association on independent', 'interpreting', 'sign language', ' asl', 'visually impaired advancement')) return 'disability_services';
  if (has('library')) return 'library';
  if (has('museum', 'theatre', 'theater', 'performing arts', 'science', 'gallery', 'art ')) return 'arts_culture';
  if (has('park', 'nature preserve', 'creek', 'ridge', 'recreation', 'trail')) return 'parks_recreation';
  if (has('metro rail', 'station', 'nfta', 'transit', 'bus ')) return 'transit';
  if (has('health', 'clinic', 'medical', 'dental', 'hospital', 'medicine', 'dentistry', 'care center', 'ecmc', 'physician')) return 'healthcare';
  if (has('cafe', 'restaurant', 'coffee', 'shop', 'store', 'llc', 'inc', 'company', 'contracting')) return 'business';
  return null;
}

const src = JSON.parse(readFileSync(SRC, 'utf8'));
const records = Array.isArray(src) ? src : src.listings;

const out = [];
const log = [];
let dropped = 0,
  attrsDropped = 0,
  parkingPromoted = 0,
  attrsKept = 0;

for (const r of records) {
  const flags = r.flags || [];
  const id = r.candidate_id;
  const tag = `${r.kind}:${r.name}`;

  if (!id || !r.source_url) {
    log.push(`SKIP (no ${!id ? 'candidate_id' : 'source_url'}): ${tag}`);
    dropped++;
    continue;
  }
  if (flags.some((f) => DROP_LISTING.has(f))) {
    log.push(`EXCLUDE listing (${flags.filter((f) => DROP_LISTING.has(f)).join(',')}): ${tag}`);
    dropped++;
    continue;
  }
  if (DROP_CANDIDATE.has(id)) {
    log.push(`EXCLUDE listing (pure-B2B SDVOB, off-mission — reviewer decision): ${tag}`);
    dropped++;
    continue;
  }

  const rec = {
    source_ref: `wny:${r.kind}:${id}`,
    source_url: SOURCE_OVERRIDE[id] ?? r.source_url,
    kind: r.kind,
    name: r.name,
    summary: r.summary ?? null,
    street: r.street ?? null,
    city: r.city ?? null,
    region: r.region ?? null,
    postal_code: r.postal_code ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    category: CATEGORY_OVERRIDE[id] ?? classifyCategory(r.name),
    // The research batch stored ownership inconsistently: top-level for places,
    // but inside provider_profile for providers. Read BOTH so the representation
    // axis (§1) isn't silently lost for the SDVOB / disabled-led provider records.
    disabled_owned: Boolean(r.disabled_owned ?? r.provider_profile?.disabled_owned),
    disabled_led: Boolean(r.disabled_led ?? r.provider_profile?.disabled_led),
    // Review metadata — importer ignores underscore fields; reviewer uses them.
    _review: { flags, source_notes: r.source_notes ?? null },
  };
  if (r.kind === 'provider') {
    rec.provider = { disability_literate: Boolean(r.provider_profile?.disability_literate) };
  }

  // Attributes
  const safetyDrop = flags.filter((f) => DROP_ATTRS.has(f));
  if (DROP_ATTRS_FOR_CANDIDATE.has(id) && (r.attributes || []).length) {
    log.push(`DROP ${r.attributes.length} attr claim(s) — source unverifiable from here (403): ${tag}`);
    attrsDropped += r.attributes.length;
    rec.attributes = [];
  } else if (safetyDrop.length && (r.attributes || []).length) {
    log.push(
      `DROP ${r.attributes.length} attr claim(s) — physical-safety caution (${safetyDrop.join(',')}): ${tag}`,
    );
    attrsDropped += r.attributes.length;
    rec.attributes = [];
  } else {
    rec.attributes = [];
    for (const a of r.attributes || []) {
      const key = a.attribute_key;
      if (!CATALOG[key]) {
        log.push(`  drop attr "${key}" (unknown key): ${tag}`);
        continue;
      }
      if (!kindOk(key, r.kind)) {
        log.push(`  drop attr "${key}" (not valid for ${r.kind}): ${tag}`);
        continue;
      }
      if (!a.source_url) {
        log.push(`  drop attr "${key}" (no source_url): ${tag}`);
        continue;
      }
      rec.attributes.push({
        key,
        asserted_value: a.asserted_value ?? true,
        source_url: a.source_url,
        note: a.note ?? null,
      });
      attrsKept++;
    }
    // Promote provider parking evidence the research had to hold as a note.
    if (flags.includes(PROMOTE_PARKING) && !rec.attributes.some((a) => a.key === 'accessible_parking')) {
      rec.attributes.push({
        key: 'accessible_parking',
        asserted_value: true,
        source_url: r.source_url,
        note:
          'Provider accessible-parking evidence promoted after the Gap B fix (accessible_parking now applies to providers). Source: ' +
          (r.source_notes ?? 'see listing source_url') +
          '. Re-confirm on a visit.',
      });
      parkingPromoted++;
      attrsKept++;
      log.push(`PROMOTE accessible_parking (Gap B): ${tag}`);
    }
  }

  out.push(rec);
}

const dataset = {
  _note:
    'CANDIDATE WNY seed batch, converted from listings.json by convert.mjs. NOT reviewed, NOT imported. Every record needs source sign-off and the _review flags resolved before import (see CONVERSION-NOTES.md). All claims import as self_reported (§4).',
  source: 'WNY seed research batch 2026-07-08 (Erie County beachhead, §3)',
  listings: out,
};
writeFileSync(OUT, JSON.stringify(dataset, null, 2) + '\n');

const claimCount = out.reduce((n, r) => n + r.attributes.length, 0);
console.log(`# Conversion summary`);
console.log(`- input records: ${records.length}`);
console.log(`- listings written: ${out.length} (dropped ${dropped})`);
console.log(`- attribute claims written: ${claimCount} (kept ${attrsKept}, safety-dropped ${attrsDropped}, parking promoted ${parkingPromoted})`);
console.log(`- output: ${OUT}`);
console.log(`\n# Per-record decisions`);
for (const line of log) console.log(`- ${line}`);
