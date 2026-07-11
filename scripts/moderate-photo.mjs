// Ops CLI for evidence-photo moderation (§13). Ops-only until a user-facing
// "report this photo" surface and a moderation-audit table land (both need a
// migration verified against real Postgres). Run by an operator against a real
// backend.
//
// Usage:
//   npm run moderate:photo -- --url "<public photo URL>" --reason "off-topic" [--dry-run]
//   npm run moderate:photo -- --id <confirmationId>       --reason "abuse"     [--yes]
//
// What it does: removes BOTH storage objects (full + thumbnail) and nulls the
// photo columns on the confirmation, so the photo disappears from every listing
// page (the evidence_photos view filters `photo_url is not null`). It KEEPS the
// contributor's yes/no visit report — scrubbing a bad image is not the same as a
// confirmation-level takedown, which would change §4 consensus and must be a
// separate, deliberate action. This action is destructive to the image and
// cannot be undone; --dry-run previews without touching anything.
import { createInterface } from 'node:readline/promises';
import { serviceClient, parseArgs } from './lib/db.mjs';

// Reuse the single typed implementation in src/lib/moderation.ts (also unit
// tested) — no duplicated moderation logic. Importing .ts needs Node's native
// type-stripping (>= 22.6), like scripts/data-rights.mjs.
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 23 && !(maj === 22 && min >= 6)) {
  console.error(
    `This ops script needs Node >= 23 (native TypeScript); you have ${process.versions.node}.\n` +
      `Run it under a newer Node (e.g. \`nvm use 23\`) — the app itself still targets Node 20.`,
  );
  process.exit(1);
}

const { redactEvidencePhoto, isValidReason } = await import('../src/lib/moderation.ts');

const args = parseArgs(process.argv.slice(2));
const confirmationId = typeof args.id === 'string' ? args.id : undefined;
const photoUrl = typeof args.url === 'string' ? args.url : undefined;
const reason = typeof args.reason === 'string' ? args.reason : undefined;
const dryRun = Boolean(args['dry-run']);

if ((!confirmationId && !photoUrl) || !isValidReason(reason)) {
  console.error(
    'Usage:\n' +
      '  npm run moderate:photo -- --url "<photo URL>" --reason "<why>" [--dry-run] [--yes]\n' +
      '  npm run moderate:photo -- --id <confirmationId> --reason "<why>" [--dry-run] [--yes]\n' +
      '\nA reason is required (it is logged; moderation must be accountable).',
  );
  process.exit(1);
}

const db = serviceClient();

// Preview: find the row without changing anything.
let preview = db
  .from('confirmations')
  .select('id, claim_id, photo_url, photo_thumb_url')
  .not('photo_url', 'is', null);
preview = confirmationId ? preview.eq('id', confirmationId) : preview.eq('photo_url', photoUrl);
const { data: row, error: previewErr } = await preview.maybeSingle();
if (previewErr) {
  console.error(`Lookup failed: ${previewErr.message}`);
  process.exit(1);
}
if (!row) {
  console.error('No matching evidence photo found (already removed?). Nothing to do.');
  process.exit(0);
}

console.error(
  `Evidence photo to redact:\n` +
    `  confirmation: ${row.id}\n  claim:        ${row.claim_id}\n  photo:        ${row.photo_url}\n` +
    `  reason:       ${reason}`,
);

if (dryRun) {
  console.error('\n--dry-run: nothing was changed.');
  process.exit(0);
}

if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(
    'Remove this photo (storage + DB pointer)? The visit report is kept. This cannot be undone. [type "redact"]: ',
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'redact') {
    console.error('Aborted — no changes made.');
    process.exit(1);
  }
}

const result = await redactEvidencePhoto(
  db,
  { confirmationId, photoUrl },
  reason,
);

if (!result.found) {
  console.error('Photo was already gone — nothing changed.');
  process.exit(0);
}

console.error(
  `\nRedacted evidence photo on confirmation ${result.confirmationId} ` +
    `(claim ${result.claimId}): ${result.removedObjects} storage object(s) removed, photo columns nulled.\n` +
    `The contributor's visit report was kept (§4 consensus unchanged).\n` +
    `Reason (log this): ${result.reason}`,
);
