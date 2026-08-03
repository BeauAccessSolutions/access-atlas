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
//   * Every row goes through the SAME validateCoverageWrite + carriedOverFlags
//     rules as the single-record CLI. Bulk gets no weaker standard — that is
//     exactly where a weaker standard would do the most damage.
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
const { validateCoverageWrite, carriedOverFlags, updateProviderCoverage } = await import(
  '../src/lib/coverage-write.ts'
);
const { COVERAGE_STALE_DAYS } = await import('../src/lib/coverage.ts');

const args = parseArgs(process.argv.slice(2));
const admin = serviceClient();

const COVERAGE_SELECT =
  'listing_id, accepting_new_patients, accepts_medicaid, accepts_medicare, offers_telehealth, coverage_source, coverage_as_of, coverage_note';

/** DB row -> the ProviderCoverage shape the shared helpers expect. */
function toCoverage(row) {
  if (!row) return null;
  const c = {
    acceptingNewPatients: row.accepting_new_patients ?? null,
    acceptsMedicaid: row.accepts_medicaid ?? null,
    acceptsMedicare: row.accepts_medicare ?? null,
    offersTelehealth: row.offers_telehealth ?? null,
    source: row.coverage_source ?? null,
    asOf: row.coverage_as_of ?? null,
    note: row.coverage_note ?? null,
  };
  const hasAny =
    c.acceptingNewPatients !== null ||
    c.acceptsMedicaid !== null ||
    c.acceptsMedicare !== null ||
    c.offersTelehealth !== null;
  return hasAny ? c : null;
}

const cell = (v) => (v === null || v === undefined ? '' : v ? 'yes' : 'no');

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
  const { data: profiles, error: pErr } = await admin
    .from('provider_profiles')
    .select(COVERAGE_SELECT);
  if (pErr) {
    console.error(`Could not read provider profiles: ${pErr.message}`);
    process.exit(1);
  }
  const byListing = new Map((profiles ?? []).map((p) => [p.listing_id, p]));

  const today = new Date();
  const staleBefore = new Date(today.getTime() - COVERAGE_STALE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Most-needing-a-call first: nothing recorded, then stale, then the rest.
  const ranked = (providers ?? [])
    .map((p) => {
      const row = byListing.get(p.id);
      const coverage = toCoverage(row);
      const asOf = row?.coverage_as_of ?? null;
      const priority = !coverage ? 0 : !asOf || asOf < staleBefore ? 1 : 2;
      return { p, row, coverage, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.p.name.localeCompare(b.p.name));

  const csv = toCsv(
    CALL_SHEET_COLUMNS,
    ranked.map(({ p, row }) => [
      p.id,
      p.name,
      cell(row?.accepting_new_patients),
      cell(row?.accepts_medicaid),
      cell(row?.accepts_medicare),
      cell(row?.offers_telehealth),
      row?.coverage_source ?? 'self_attested',
      // Deliberately BLANK, not the stored date: as_of means "when you confirmed
      // it", so carrying the old date forward would let a fresh call be filed
      // under a stale one. The operator types the date they called.
      '',
      row?.coverage_note ?? '',
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

const { data: profiles } = ids.length
  ? await admin.from('provider_profiles').select(COVERAGE_SELECT).in('listing_id', ids)
  : { data: [] };
const profileByListing = new Map((profiles ?? []).map((p) => [p.listing_id, p]));

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
  for (const p of validateCoverageWrite(request)) errors.push(`Row ${line}: ${p}`);

  const before = toCoverage(profileByListing.get(request.listingId));
  const carried = carriedOverFlags(before, request);
  if (carried.length > 0) {
    errors.push(
      `Row ${line} ("${listing.name}"): changes the source/date but leaves ${carried.join(', ')} ` +
        `blank while already published — they would be relabelled with provenance nobody gave them. ` +
        `Re-state them in the row, or set them to unknown.`,
    );
  }
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
