// Bulk provider coverage — the call-sheet loop (migrations 0014-0016).
//
// The realistic ops workflow is a calling campaign: someone rings a batch of WNY
// practices over a week and records what they are told. That produces a
// spreadsheet, so this works in CSV and round-trips the same file:
//
//   1. npm run coverage:sheet -- --out calls.csv
//        Exports every provider, pre-filled with what we currently hold, with
//        the ones most needing a call first (nothing recorded, then stale).
//   2. Fill it in. Blank = leave unchanged. `unknown` = clear/retract.
//   3. npm run coverage:import -- calls.csv --dry-run
//   4. npm run coverage:import -- calls.csv
//
// The export exists because the import is unusable without it: rows are keyed by
// listing UUID, and no operator is going to look up forty of those by hand.
//
// SAFETY, all of it inherited rather than reinvented:
//   * Every row goes through the SAME validateCoverageWrite rules as the
//     single-record CLI. Bulk gets no weaker standard — that is exactly where a
//     weaker standard would do the most damage. (Before migration 0017 it also
//     needed a carriedOverFlags check, because one shared source/date meant a
//     partial row could relabel facts it never mentioned. Per-fact provenance
//     removed that whole class of problem.)
//   * The whole batch is validated BEFORE anything is written. A forty-row
//     import that half-applies is worse than one that refuses.
//   * The `name` column is checked against the database. A spreadsheet where
//     someone inserted a row and shifted the ids is a realistic disaster, and a
//     name mismatch catches it before it writes coverage to the wrong practice.
//   * Every applied row lands in the append-only audit, one entry each.
import { readFileSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { serviceClient, parseArgs } from './lib/db.mjs';
import { registerTsExtResolve } from './lib/ts-ext-resolve.mjs';

registerTsExtResolve();

const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 23 && !(maj === 22 && min >= 6)) {
  console.error(
    `This ops script needs Node >= 23 (native TypeScript); you have ${process.versions.node}.\n` +
      `Run it under a newer Node (e.g. \`nvm use 23\`) — the app itself still targets Node 20.`,
  );
  process.exit(1);
}

const { parseCoverageBatch, toCsv, CALL_SHEET_COLUMNS } = await import(
  '../src/lib/coverage-batch.ts'
);
const { validateCoverageWrite, updateProviderCoverage, rowsToCoverage } = await import(
  '../src/lib/coverage-write.ts'
);
const { isCoverageStale } = await import('../src/lib/coverage.ts');

const args = parseArgs(process.argv.slice(2));
const admin = serviceClient();

const FACT_SELECT = 'listing_id, key, value, source, as_of, note';

/** A fact's cell value for the sheet: 'yes' / 'no' / blank when unknown. */
const cell = (fact) => (fact === undefined ? '' : fact.value ? 'yes' : 'no');

/** The freshest as_of across a provider's facts — drives the stale ranking. */
const newestAsOf = (coverage) => {
  const dates = Object.values(coverage).map((f) => f.asOf).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
};

// ---------------------------------------------------------------------------
// Mode 1: export the call sheet
// ---------------------------------------------------------------------------
if (args['call-sheet'] || args.out || args.export) {
  const { data: providers, error } = await admin
    .from('listings')
    .select('id, name, city')
    .eq('kind', 'provider')
    .order('name');
  if (error) {
    console.error(`Could not read providers: ${error.message}`);
    process.exit(1);
  }
  const { data: facts, error: pErr } = await admin
    .from('provider_coverage_facts')
    .select(FACT_SELECT);
  if (pErr) {
    console.error(`Could not read coverage facts: ${pErr.message}`);
    process.exit(1);
  }
  // Group the per-fact rows (migration 0017) back into one map per provider.
  const byListing = new Map();
  for (const f of facts ?? []) {
    const rows = byListing.get(f.listing_id) ?? [];
    rows.push(f);
    byListing.set(f.listing_id, rows);
  }

  const today = new Date();

  // Most-needing-a-call first: nothing recorded, then stale, then the rest.
  const ranked = (providers ?? [])
    .map((p) => {
      const coverage = rowsToCoverage(byListing.get(p.id));
      const known = Object.keys(coverage).length > 0;
      // Rank by how badly a call is needed: nothing recorded, then stale, then
      // current. Staleness is judged PER FACT against that fact's own window
      // (they differ — a panel status goes stale in 90 days, telehealth in a
      // year), so a provider whose panel status is four months old ranks as
      // needing a call even though its Medicaid answer is still fresh.
      const anyStale = Object.entries(coverage).some(([key, fact]) =>
        isCoverageStale(key, fact.asOf, today),
      );
      const priority = !known ? 0 : anyStale ? 1 : 2;
      return { p, coverage, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.p.name.localeCompare(b.p.name));

  const csv = toCsv(
    CALL_SHEET_COLUMNS,
    ranked.map(({ p, coverage }) => [
      p.id,
      p.name,
      cell(coverage.acceptingNewPatients),
      cell(coverage.acceptsMedicaid),
      cell(coverage.acceptsMedicare),
      cell(coverage.offersTelehealth),
      coverage.acceptingNewPatients?.source ?? 'self_attested',
      // Deliberately BLANK, not the stored date: as_of means "when you confirmed
      // it", so carrying the old date forward would let a fresh call be filed
      // under a stale one. The operator types the date they called.
      '',
      coverage.acceptingNewPatients?.note ?? '',
      '',
    ]),
  );

  const out = typeof args.out === 'string' ? args.out : null;
  if (out) {
    writeFileSync(out, csv);
    const counts = ranked.reduce((acc, r) => ((acc[r.priority] = (acc[r.priority] ?? 0) + 1), acc), {});
    console.log(`Wrote ${ranked.length} provider(s) to ${out}.`);
    console.log(`  ${counts[0] ?? 0} with nothing recorded, ${counts[1] ?? 0} stale, ${counts[2] ?? 0} current.`);
    console.log('\nFill in yes / no / unknown. Blank leaves a fact unchanged; `unknown` clears it.');
    console.log('Put the date you called in as_of, and how you know in reason.');
  } else {
    process.stdout.write(csv);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Mode 2: import a filled-in sheet
// ---------------------------------------------------------------------------
const file = args._?.[0];
if (!file) {
  console.error('Usage:');
  console.error('  npm run coverage:sheet  -- --out calls.csv');
  console.error('  npm run coverage:import -- calls.csv [--dry-run] [--reason "..."] [--yes]');
  process.exit(1);
}

const actor = `ops-cli:${args.actor ?? userInfo().username}`;
const { rows, problems } = parseCoverageBatch(readFileSync(file, 'utf8'), {
  actor,
  defaultReason: typeof args.reason === 'string' ? args.reason : undefined,
});

const errors = [...problems];

// Fetch every referenced listing at once, then check each row against reality.
const ids = rows.map((r) => r.request.listingId);
const { data: listings, error: lErr } = ids.length
  ? await admin.from('listings').select('id, kind, name').in('id', ids)
  : { data: [], error: null };
if (lErr) {
  console.error(`Could not read listings: ${lErr.message}`);
  process.exit(1);
}
const listingById = new Map((listings ?? []).map((l) => [l.id, l]));

for (const row of rows) {
  const { line, request, declaredName } = row;
  const listing = listingById.get(request.listingId);
  if (!listing) {
    errors.push(`Row ${line}: no listing with id ${request.listingId}.`);
    continue;
  }
  if (listing.kind !== 'provider') {
    errors.push(`Row ${line}: "${listing.name}" is a place, not a provider.`);
    continue;
  }
  // Row-shift guard: a spreadsheet where someone inserted a row and slid the
  // ids out of alignment would otherwise write each practice's answers to its
  // neighbour.
  if (declaredName && declaredName !== listing.name) {
    errors.push(
      `Row ${line}: name "${declaredName}" does not match listing ${request.listingId} ("${listing.name}"). ` +
        `Rows may have shifted — check the sheet before importing.`,
    );
    continue;
  }
  // No carried-over-provenance check any more: since migration 0017 each fact
  // owns its source and date, so leaving a cell blank simply leaves that fact
  // — and its provenance — exactly as it was.
  for (const p of validateCoverageWrite(request)) errors.push(`Row ${line}: ${p}`);
}

if (errors.length > 0) {
  console.error(`Refusing the whole batch — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nNothing was written. Fix the sheet and re-run.');
  process.exit(1);
}

console.log(`${rows.length} row(s) ready:\n`);
for (const { line, request } of rows) {
  const listing = listingById.get(request.listingId);
  const changes = Object.entries(request.values)
    .map(([k, v]) => `${k}=${v === 'unknown' ? 'unknown' : v ? 'yes' : 'no'}`)
    .join(', ');
  console.log(`  row ${line}  ${listing.name} — ${changes} (${request.source}, ${request.asOf})`);
}

if (args['dry-run']) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}

if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType "import" to write ${rows.length} coverage record(s): `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'import') {
    console.log('Aborted; nothing written.');
    process.exit(1);
  }
}

// Applied row by row: supabase-js exposes no multi-statement transaction, so a
// failure part-way leaves earlier rows written. That is why validation above is
// exhaustive — and why every applied row is audited, so the trail shows exactly
// what landed even if this stops early.
let applied = 0;
for (const { line, request } of rows) {
  try {
    const result = await updateProviderCoverage(admin, request);
    applied += 1;
    console.log(`  ✓ row ${line}  audit ${result.auditId}`);
  } catch (err) {
    console.error(`  ✗ row ${line}: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`\nStopped after ${applied} of ${rows.length} row(s). Earlier rows ARE written`);
    console.error('and are in the audit trail. Fix this row and re-run — re-applying an');
    console.error('already-written row is harmless (it records the same values again).');
    process.exit(1);
  }
}
console.log(`\nWrote ${applied} coverage record(s).`);
