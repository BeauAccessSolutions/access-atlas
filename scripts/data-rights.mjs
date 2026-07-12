// Ops CLI for contributor data rights (§6 CCPA/CPRA; BAS invariant #3).
// The trusted entry point until the Keycloak-authenticated self-service flow
// lands (§15). Run by an operator against a real backend.
//
// Usage:
//   npm run data-rights -- export <contributorId>            # print JSON export to stdout
//   npm run data-rights -- export <contributorId> --out f.json
//   npm run data-rights -- delete <contributorId>            # asks for confirmation
//   npm run data-rights -- delete <contributorId> --yes      # skip the prompt (scripted use)
//   npm run data-rights -- delete <contributorId> --purge-listings --yes   # also erase submitted listings
//
// The delete path is destructive and irreversible. It defaults to KEEPING the
// listings a contributor submitted (community safety data), severing only the
// personal link — see src/lib/data-rights.ts. --purge-listings overrides that.
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { serviceClient, parseArgs } from './lib/db.mjs';
import { registerTsExtResolve } from './lib/ts-ext-resolve.mjs';

// Let Node resolve the app's extensionless relative imports when running the
// real .ts modules under type-stripping (data-rights.ts has none today, but any
// sibling import it grows would otherwise fail at runtime only).
registerTsExtResolve();

// This script reuses the SINGLE typed implementation in src/lib/data-rights.ts
// (also used by the unit tests and the future self-service endpoint — no
// duplicated delete logic). Importing a .ts file needs Node's native
// type-stripping (Node >= 22.6, default-on in 23+). The rest of the project runs
// on the Node 20 floor; this one operator-only script asks for a newer Node so
// there's no second copy of safety-critical deletion code to drift.
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 23 && !(maj === 22 && min >= 6)) {
  console.error(
    `This ops script needs Node >= 23 (native TypeScript); you have ${process.versions.node}.\n` +
      `Run it under a newer Node (e.g. \`nvm use 23\`) — the app itself still targets Node 20.`,
  );
  process.exit(1);
}

const { exportContributorData, deleteContributorData } = await import('../src/lib/data-rights.ts');

const args = parseArgs(process.argv.slice(2));
const [action, contributorId] = args._;

if (!action || !contributorId || !['export', 'delete'].includes(action)) {
  console.error(
    'Usage:\n' +
      '  npm run data-rights -- export <contributorId> [--out file.json]\n' +
      '  npm run data-rights -- delete <contributorId> [--yes] [--purge-listings]',
  );
  process.exit(1);
}

const db = serviceClient();

if (action === 'export') {
  const data = await exportContributorData(db, contributorId);
  const json = JSON.stringify(data, null, 2);
  if (args.out) {
    writeFileSync(args.out, json);
    console.error(
      `Exported contributor ${contributorId}: ${data.confirmations.length} confirmation(s), ` +
        `${data.submittedListings.length} submitted listing(s) → ${args.out}`,
    );
  } else {
    console.log(json);
  }
  process.exit(0);
}

// action === 'delete'
if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(
    `Permanently delete contributor ${contributorId} and their personal data` +
      `${args['purge-listings'] ? ' AND their submitted listings' : ''}? This cannot be undone. [type "delete"]: `,
  );
  rl.close();
  if (answer.trim() !== 'delete') {
    console.error('Aborted — no changes made.');
    process.exit(1);
  }
}

const result = await deleteContributorData(db, contributorId, {
  deleteSubmittedListings: Boolean(args['purge-listings']),
});

if (!result.existed) {
  console.error(`No contributor ${contributorId} found — nothing to delete (already gone).`);
  process.exit(0);
}

console.error(
  `Deleted contributor ${contributorId}: ` +
    `${result.deletedConfirmations} confirmation(s), ${result.deletedPhotos} evidence photo(s).\n` +
    `Kept ${result.keptListingIds.length} submitted listing(s) (link severed).`,
);
if (result.affectedClaimIds.length > 0) {
  console.error(
    `\n⚠ ${result.affectedClaimIds.length} attribute claim(s) had confirmations removed and will ` +
      `recompute their state (§4). A dissent that froze a claim leaving can un-freeze it — re-review:\n  ` +
      result.affectedClaimIds.join('\n  '),
  );
}
