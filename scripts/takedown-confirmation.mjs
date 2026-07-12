// Ops CLI for CONFIRMATION-LEVEL takedown (§4 consensus-changing; §7 fake /
// brigaded reviews). The heavier sibling of moderate:photo. Ops-only, run by an
// operator against a real backend. Every run is recorded in moderation_audit (0008).
//
// Usage:
//   npm run moderate:takedown -- --id <confirmationId> --reason "fake review" [--dry-run]
//   npm run moderate:takedown -- --id <confirmationId> --reason "brigading" --actor "ops-cli:zach" --yes
//
// What it does: DELETES the confirmation (a fraudulent visit report), removes its
// evidence photos from storage, then RECOMPUTES the claim's §4 state and prints
// the before/after so the operator sees the consensus impact. Unlike
// moderate:photo (which keeps the visit report), this CHANGES consensus — a
// removed dissent can un-freeze a 'disputed' claim, a removed agreement can drop
// a claim below the community-verified bar. Destructive and irreversible;
// --dry-run previews (including the current state) without touching anything.
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

const { takedownConfirmation, isValidReason } = await import('../src/lib/moderation.ts');

const args = parseArgs(process.argv.slice(2));
const confirmationId = typeof args.id === 'string' ? args.id : undefined;
const reason = typeof args.reason === 'string' ? args.reason : undefined;
const dryRun = Boolean(args['dry-run']);
const actor = typeof args.actor === 'string' ? args.actor : `ops-cli:${safeUser()}`;

function safeUser() {
  try {
    return userInfo().username || 'unknown';
  } catch {
    return 'unknown';
  }
}

if (!confirmationId || !isValidReason(reason)) {
  console.error(
    'Usage:\n' +
      '  npm run moderate:takedown -- --id <confirmationId> --reason "<why>" [--dry-run] [--actor <who>] [--yes]\n' +
      '\nRemoves a fraudulent confirmation and RECOMPUTES the claim consensus (§4).\n' +
      'A reason is required (recorded in moderation_audit; moderation must be accountable).',
  );
  process.exit(1);
}

const db = serviceClient();

// Preview: find the confirmation + its claim's CURRENT state, change nothing.
const { data: row, error: previewErr } = await db
  .from('confirmations')
  .select('id, claim_id, agrees')
  .eq('id', confirmationId)
  .maybeSingle();
if (previewErr) {
  console.error(`Lookup failed: ${previewErr.message}`);
  process.exit(1);
}
if (!row) {
  console.error('No matching confirmation found (already removed?). Nothing to do.');
  process.exit(0);
}
const { data: statusRow } = await db
  .from('attribute_claim_status')
  .select('state, agree_count, dissent_count')
  .eq('claim_id', row.claim_id)
  .maybeSingle();

console.error(
  `Confirmation to take down (this CHANGES §4 consensus):\n` +
    `  confirmation: ${row.id}\n  claim:        ${row.claim_id}\n` +
    `  this vote:    ${row.agrees ? 'AGREES' : 'DISSENTS (freezes the claim)'}\n` +
    `  claim now:    ${statusRow?.state ?? '(no status)'} ` +
    `(${statusRow?.agree_count ?? 0} agree / ${statusRow?.dissent_count ?? 0} dissent)\n` +
    `  reason:       ${reason}\n  actor:        ${actor}`,
);

if (dryRun) {
  console.error('\n--dry-run: nothing was changed.');
  process.exit(0);
}

if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(
    'Delete this confirmation and recompute consensus? This cannot be undone. [type "takedown"]: ',
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'takedown') {
    console.error('Aborted — no changes made.');
    process.exit(1);
  }
}

const result = await takedownConfirmation(db, confirmationId, reason, actor);

if (!result.found) {
  console.error('Confirmation was already gone — nothing changed.');
  process.exit(0);
}

const changed = result.stateBefore !== result.stateAfter;
console.error(
  `\nTook down confirmation ${result.confirmationId} (claim ${result.claimId}, ` +
    `${result.removedObjects} evidence photo object(s) removed).\n` +
    `Claim state: ${result.stateBefore} -> ${result.stateAfter}` +
    `${changed ? '  ⚠ CONSENSUS CHANGED — re-review this claim (§4).' : '  (unchanged)'}\n` +
    `Recorded in moderation_audit as ${result.auditId} (actor ${actor}, reason: ${result.reason}).`,
);
