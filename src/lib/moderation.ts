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
//   * It keeps the contributor's CONFIRMATION — a bad image doesn't prove a
//     dishonest report. Removing a confirmation changes §4 consensus and is a
//     separate, heavier action (confirmation-level takedown), not a side effect
//     of scrubbing an image.
//
// Every action is now recorded in the moderation_audit table (migration 0008):
// a durable, append-only, ops-only trail of who/what/when/why — the reason is no
// longer only in terminal scrollback.
import type { SupabaseClient } from '@supabase/supabase-js';
import { storagePathFromPublicUrl } from './data-rights';

// ---------------------------------------------------------------------------
// Moderation audit trail (§7 accountability; migration 0008).
// ---------------------------------------------------------------------------

// Mirrors the moderation_action enum in migration 0008 — keep in lockstep.
export type ModerationAction = 'photo_redaction' | 'confirmation_takedown';

export interface ModerationAuditEntry {
  action: ModerationAction;
  reason: string;
  /** Who acted — an operator label like 'ops-cli:<name>', NEVER a contributor id
   *  (§6: the audit is about the moderator, not the moderated). */
  actor: string;
  confirmationId?: string | null;
  claimId?: string | null;
  listingId?: string | null;
  /** Structured context (removed-object count, redacted URL, before/after state). */
  details?: Record<string, unknown>;
}

/** A moderation actor label is mandatory alongside the reason — an audit row
 *  with no "who" isn't accountable. Rejects empty/whitespace. */
export function isValidActor(actor: unknown): actor is string {
  return typeof actor === 'string' && actor.trim().length > 0;
}

/**
 * Append one row to moderation_audit. Ops-only (service-role client). Returns
 * the new audit row id. The table is append-only by grant (0008) — there is no
 * update/delete path, by design.
 */
export async function recordModerationAudit(
  admin: SupabaseClient,
  entry: ModerationAuditEntry,
): Promise<string> {
  if (!isValidReason(entry.reason)) throw new Error('A non-empty moderation reason is required.');
  if (!isValidActor(entry.actor)) throw new Error('A non-empty moderation actor is required.');
  const { data, error } = await admin
    .from('moderation_audit')
    .insert({
      action: entry.action,
      reason: entry.reason,
      actor: entry.actor,
      confirmation_id: entry.confirmationId ?? null,
      claim_id: entry.claimId ?? null,
      listing_id: entry.listingId ?? null,
      details: entry.details ?? {},
    })
    .select('id')
    .single();
  if (error) throw new Error(`moderation audit write failed: ${error.message}`);
  return data.id as string;
}

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
  /** The moderation_audit row id written for this action; null on a no-op. */
  auditId: string | null;
}

/** A reason is mandatory — moderation must be accountable. Rejects
 *  empty/whitespace. */
export function isValidReason(reason: unknown): reason is string {
  return typeof reason === 'string' && reason.trim().length > 0;
}

/**
 * Redact one evidence photo. Ops-only (service-role client). Identify the photo
 * by confirmation id or by the public photo URL. Idempotent: a target whose
 * photo is already gone returns { found:false } without error (and writes no
 * audit row — nothing happened). A successful redaction appends one
 * moderation_audit row (0008); its id is returned as `auditId`.
 */
export async function redactEvidencePhoto(
  admin: SupabaseClient,
  target: RedactionTarget,
  reason: string,
  actor: string,
): Promise<RedactionResult> {
  if (!isValidReason(reason)) {
    throw new Error('A non-empty moderation reason is required.');
  }
  if (!target.confirmationId && !target.photoUrl) {
    throw new Error('Provide a confirmationId or a photoUrl to redact.');
  }
  if (!isValidActor(actor)) {
    throw new Error('A non-empty moderation actor is required.');
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
      auditId: null,
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

  // 4. Record the action in the durable audit trail (0008). Written LAST, so a
  //    row only exists for a redaction that actually completed.
  const auditId = await recordModerationAudit(admin, {
    action: 'photo_redaction',
    reason,
    actor,
    confirmationId: row.id as string,
    claimId: row.claim_id as string,
    details: { removedObjects, photoUrl: row.photo_url as string },
  });

  return {
    found: true,
    confirmationId: row.id as string,
    claimId: row.claim_id as string,
    removedObjects,
    reason,
    auditId,
  };
}
