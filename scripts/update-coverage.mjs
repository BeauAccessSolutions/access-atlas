// Ops CLI for provider coverage — panel status, Medicaid/Medicare, telehealth
// (migrations 0014-0016). Run by an operator against a real backend.
//
// WHY OPS AND NOT THE PRACTICE. Coverage's authority IS the practice, so a
// provider-facing form is the eventual answer. It is not buildable yet: the
// Keycloak BFF is config-gated OFF and there is no claim-a-listing /
// practice-verification flow, so a public write on MONEY facts would be a fraud
// vector — mark a competitor "not accepting new patients" and you have diverted
// their patients. Unlike every other write surface here, coverage has NO §4
// consensus layer to absorb a bad actor: one write publishes immediately. Full
// reasoning in supabase/migrations/0016_coverage_audit.sql.
//
// The realistic workflow this serves: someone rings a batch of WNY practices and
// records what they are told, one call at a time.
//
// Usage:
//   npm run coverage:update -- --listing <uuid> --new-patients yes --medicaid yes \
//     --source self_attested --reason "called the office, spoke to reception" [--dry-run]
//
//   npm run coverage:update -- --listing <uuid> --medicare no --source sourced \
//     --note "NY State of Health directory, August 2026" --as-of 2026-08-01 --reason "directory check"
//
//   npm run coverage:update -- --listing <uuid> --new-patients unknown --medicaid unknown \
//     --medicare unknown --telehealth unknown --reason "retracting: our note was wrong"
//
// Flags: --new-patients / --medicaid / --medicare / --telehealth take yes|no|unknown.
//   yes/no publish; unknown clears back to "we don't know" and publishes nothing.
// --as-of defaults to today (you just confirmed it). --note is required when
//   --source is `sourced`, so a reader can go and check it (§7).
// --dry-run previews without writing. --yes skips the typed confirmation.
import { userInfo } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { serviceClient, parseArgs } from './lib/db.mjs';
import { registerTsExtResolve } from './lib/ts-ext-resolve.mjs';

// Let Node resolve the app's extensionless relative imports when running the
// real .ts modules under type-stripping.
registerTsExtResolve();

const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 23 && !(maj === 22 && min >= 6)) {
  console.error(
    `This ops script needs Node >= 23 (native TypeScript); you have ${process.versions.node}.\n` +
      `Run it under a newer Node (e.g. \`nvm use 23\`) — the app itself still targets Node 20.`,
  );
  process.exit(1);
}

// Reuse the single typed implementation — no duplicated write or validation
// logic, exactly as the other ops scripts do.
const { updateProviderCoverage, validateCoverageWrite } = await import(
  '../src/lib/coverage-write.ts'
);
const { presentAllCoverage } = await import('../src/lib/coverage.ts');

const args = parseArgs(process.argv.slice(2));

const FLAG_ARGS = [
  ['new-patients', 'acceptingNewPatients'],
  ['medicaid', 'acceptsMedicaid'],
  ['medicare', 'acceptsMedicare'],
  ['telehealth', 'offersTelehealth'],
];

/** yes | no | unknown -> true | false | 'unknown'. Anything else is fatal. */
function parseTriState(raw, flag) {
  const v = String(raw).trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === 'y') return true;
  if (v === 'no' || v === 'false' || v === 'n') return false;
  if (v === 'unknown' || v === 'null' || v === 'clear') return 'unknown';
  console.error(`--${flag} must be yes, no, or unknown (got "${raw}").`);
  process.exit(1);
}

const values = {};
for (const [argName, key] of FLAG_ARGS) {
  if (args[argName] !== undefined) values[key] = parseTriState(args[argName], argName);
}

const today = new Date().toISOString().slice(0, 10);
const request = {
  listingId: args.listing ?? args.id ?? '',
  values,
  source: args.source ?? 'self_attested',
  // Default to today: the common case is "I just confirmed this on the phone".
  asOf: args['as-of'] ?? today,
  note: args.note ?? null,
  reason: args.reason ?? '',
  actor: `ops-cli:${args.actor ?? userInfo().username}`,
};

// Fail BEFORE touching the database, with every problem at once rather than one
// per run. Same rules the write path enforces — this is the friendly copy of it.
const problems = validateCoverageWrite(request);
if (problems.length > 0) {
  console.error('Refusing to write an unpublishable coverage record:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nRun with --help for usage.');
  process.exit(1);
}

const changed = Object.entries(values)
  .map(([k, v]) => `${k}=${v === 'unknown' ? 'unknown (cleared)' : v ? 'yes' : 'no'}`)
  .join(', ');

console.log(`Listing:  ${request.listingId}`);
console.log(`Setting:  ${changed}`);
console.log(`Source:   ${request.source}${request.note ? ` — ${request.note}` : ''}`);
console.log(`As of:    ${request.asOf}${args['as-of'] ? '' : ' (today, default)'}`);
console.log(`Reason:   ${request.reason}`);
console.log(`Actor:    ${request.actor}`);

if (args['dry-run']) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}

if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nType "update" to write this coverage record: ');
  rl.close();
  if (answer.trim().toLowerCase() !== 'update') {
    console.log('Aborted; nothing written.');
    process.exit(1);
  }
}

const admin = serviceClient();
let result;
try {
  result = await updateProviderCoverage(admin, request);
} catch (err) {
  // An operator on the phone needs the sentence, not a stack trace. The write
  // path throws for things only the database can know (wrong id, a place rather
  // than a provider) — those messages are already written for a human.
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  console.error('Nothing was written.');
  process.exit(1);
}

console.log('\nWritten. Audit row:', result.auditId);
if (result.cleared.length > 0) {
  console.log(`Cleared (now unknown, publishing nothing): ${result.cleared.join(', ')}.`);
}

const published = presentAllCoverage(result.after);
if (published.length === 0) {
  console.log('This provider now publishes NO coverage information.');
} else {
  // Each line carries its OWN source and date (migration 0017) — facts this
  // write didn't touch keep exactly the provenance they already had.
  console.log('\nWhat the site will now publish:');
  for (const c of published) {
    console.log(`  • ${c.text} — ${c.provenance} Last confirmed ${c.asOf}.${c.isStale ? ' (STALE)' : ''}`);
  }
}
