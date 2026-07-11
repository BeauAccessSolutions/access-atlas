// Evidence-photo moderation (§13 "photo moderation is a real surface — revisit
// before contributions open publicly"; §4 photos are the evidence base; §6
// sensitive data). This is the FIRST CUT: photo-level redaction of an abusive or
// off-topic evidence photo, ops-only.
//
// WHAT IT DOES — the least-destructive action that removes a bad image:
//   1. Remove BOTH storage objects (full + thumbnail) so the image is no longer
//      reachable by its public bucket URL — the same primitive as deletion, so
//      there is one place that knows how evidence storage is laid out.
//   2. Null the photo columns on the confirmation row. The public read path
//      (`evidence_photos` view, migration 0007) already filters
//      `where photo_url is not null`, so nulling the URL removes the photo from
//      every listing page WITH NO SCHEMA CHANGE and no view edit.
//
// WHAT IT DELIBERATELY DOES NOT DO (documented forks, deferred):
//   * It keeps the contributor's CONFIRMATION (their yes/no visit report). An
//     off-topic photo does not prove the person's report was dishonest, and
//     removing a confirmation changes §4 consensus — that is a separate, heavier
//     action (confirmation-level takedown) that must be a deliberate decision,
//     not a side effect of scrubbing an image.
//   * It stores no in-DB audit row (who/why). The reason is required and
//     returned for the ops log; a proper moderation_audit table + a user-facing
//     "report this photo" surface are follow-ups for when public contributions
//     actually open (both need a migration verified against real Postgres).
import type { SupabaseClient } from '@supabase/supabase-js';
import { storagePathFromPublicUrl } from './data-rights';

export interface RedactionTarget {
  /** The confirmation row's id, OR ... */
  confirmationId?: string;
  /** ... the public photo URL an operator sees in the evidence_photos view. */
  photoUrl?: string;
}

export interface RedactionResult {
  /** false when no matching photo was found (idempotent — safe to re-run). */
  found: boolean;
  confirmationId: string | null;
  claimId: string | null;
  /** Number of storage objects removed (full + thumb ⇒ 0, 1, or 2). */
  removedObjects: number;
  reason: string;
}

/** A reason is mandatory — moderation must be accountable even before there's an
 *  audit table to hold it (the caller logs it). Rejects empty/whitespace. */
export function isValidReason(reason: unknown): reason is string {
  return typeof reason === 'string' && reason.trim().length > 0;
}

/**
 * Redact one evidence photo. Ops-only (service-role client). Identify the photo
 * by confirmation id or by the public photo URL. Idempotent: a target whose
 * photo is already gone returns { found:false } without error.
 */
export async function redactEvidencePhoto(
  admin: SupabaseClient,
  target: RedactionTarget,
  reason: string,
): Promise<RedactionResult> {
  if (!isValidReason(reason)) {
    throw new Error('A non-empty moderation reason is required.');
  }
  if (!target.confirmationId && !target.photoUrl) {
    throw new Error('Provide a confirmationId or a photoUrl to redact.');
  }

  // 1. Find the confirmation (only rows that still HAVE a photo).
  let q = admin
    .from('confirmations')
    .select('id, claim_id, photo_url, photo_thumb_url')
    .not('photo_url', 'is', null);
  q = target.confirmationId
    ? q.eq('id', target.confirmationId)
    : q.eq('photo_url', target.photoUrl as string);
  const { data: row, error: selErr } = await q.maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (!row) {
    return {
      found: false,
      confirmationId: target.confirmationId ?? null,
      claimId: null,
      removedObjects: 0,
      reason,
    };
  }

  // 2. Remove the storage objects FIRST (not covered by any cascade), so an
  //    error here aborts before we lose the DB pointer to the file.
  const paths = [
    storagePathFromPublicUrl(row.photo_url as string | null),
    storagePathFromPublicUrl(row.photo_thumb_url as string | null),
  ].filter((p): p is string => p !== null);
  let removedObjects = 0;
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from('evidence').remove(paths);
    if (rmErr) throw new Error(`evidence photo removal failed: ${rmErr.message}`);
    removedObjects = paths.length;
  }

  // 3. Null the photo columns. The evidence_photos view (photo_url is not null)
  //    now excludes this row from every listing page. The confirmation's vote
  //    (agrees) is untouched — see the header note.
  const { error: updErr } = await admin
    .from('confirmations')
    .update({ photo_url: null, photo_thumb_url: null, photo_alt: null })
    .eq('id', row.id as string);
  if (updErr) throw new Error(updErr.message);

  return {
    found: true,
    confirmationId: row.id as string,
    claimId: row.claim_id as string,
    removedObjects,
    reason,
  };
}
