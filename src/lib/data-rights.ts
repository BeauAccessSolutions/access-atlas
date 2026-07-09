// Contributor data rights — EXPORT and DELETE (BAS platform invariant #3,
// docs/platform-membership.md; and §6: CCPA/CPRA export + deletion, "treat
// access/disability data as sensitive"). These are the independently-callable,
// complete workflows the invariant requires.
//
// Keyed by CONTRIBUTOR ID today. When the Keycloak IdP lands (§15), the caller
// resolves the verified `sub` to a contributor id and passes it here — this
// module doesn't change. That's deliberate: identity stores identity only; each
// app owns its own data lifecycle (invariant #3).
//
// TWO FRONT DOORS, ONE IMPLEMENTATION: the ops CLI (scripts/data-rights.mjs)
// and the self-service pages (/account, via src/pages/api/account/*) both call
// exactly these functions — there is no second copy of deletion logic to drift.
// Self-service is gated by the contributor seam (a verified Keycloak session,
// or the provisional stand-in when explicitly enabled) and never purges
// submitted listings; the purge override stays ops-only.
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Destructive-action confirmation (a11y crossover audit, Tier 3).
// ---------------------------------------------------------------------------

// Both the ops CLI and the self-service delete page require the person to TYPE
// this word before anything is erased — a stray click or Enter press must never
// destroy data. Trim + case tolerant on purpose (§5 cognitive access): the
// friction we want is "read and decide", not "match exact casing".
export const DELETE_CONFIRM_PHRASE = 'delete';

export function confirmsDeletion(input: unknown): boolean {
  return typeof input === 'string' && input.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;
}

// ---------------------------------------------------------------------------
// Export — everything we hold that is tied to this contributor.
// ---------------------------------------------------------------------------

export interface ContributorExport {
  exportedAt: string;
  contributor: Record<string, unknown> | null;
  // Listings this person submitted. These are community data ABOUT places /
  // providers (not personal to the submitter), included for completeness/
  // transparency — deletion keeps them (see below).
  submittedListings: Record<string, unknown>[];
  // The person's own first-person confirmations: notes, coarse identity tags,
  // visit dates, evidence photo URLs. This IS their personal data (§6).
  confirmations: Record<string, unknown>[];
}

export async function exportContributorData(
  admin: SupabaseClient,
  contributorId: string,
): Promise<ContributorExport> {
  const [contributor, listings, confirmations] = await Promise.all([
    admin.from('contributors').select('*').eq('id', contributorId).maybeSingle(),
    admin.from('listings').select('*').eq('submitted_by', contributorId),
    admin.from('confirmations').select('*').eq('contributor_id', contributorId),
  ]);
  for (const r of [contributor, listings, confirmations]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    // Caller stamps the real time; kept as a param-free default the ops script
    // overrides. (new Date() is fine here — this is runtime code, not a workflow
    // script.)
    exportedAt: new Date().toISOString(),
    contributor: contributor.data ?? null,
    submittedListings: (listings.data as Record<string, unknown>[]) ?? [],
    confirmations: (confirmations.data as Record<string, unknown>[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Delete — remove the contributor and their personal data, completely.
// ---------------------------------------------------------------------------

export interface DeletionResult {
  contributorId: string;
  existed: boolean;
  deletedConfirmations: number;
  deletedPhotos: number;
  // Listings are NOT deleted (see note). Their submitted_by link is nulled by
  // the DB (FK on delete set null). We report which, for transparency.
  keptListingIds: string[];
  // Deleting a person's confirmations recomputes consensus on those claims — a
  // dissent that FROZE a claim leaving may flip it (§4 privacy-vs-safety tension,
  // §11). We surface the affected claims so ops can re-review, never silently.
  affectedClaimIds: string[];
}

/**
 * Delete a contributor and all their personal data. Complete and idempotent:
 * calling it for an already-deleted id returns existed=false and no-ops.
 *
 * ORDER MATTERS. Postgres FKs cascade confirmations when the contributor row is
 * deleted, and null out listings.submitted_by — but storage objects are NOT in
 * the DB, so evidence photos must be removed explicitly FIRST, or they orphan.
 *
 * Design choice (documented, §11): we keep the LISTINGS this person submitted.
 * A listing describes a business/place's accessibility — it is community safety
 * data, not personal data about the submitter, and dropping it would strand the
 * next person looking for that place. We sever the personal link (submitted_by
 * → null) instead. Flip `deleteSubmittedListings` only for a true erasure of a
 * spam/abuse account.
 */
export async function deleteContributorData(
  admin: SupabaseClient,
  contributorId: string,
  opts: { deleteSubmittedListings?: boolean } = {},
): Promise<DeletionResult> {
  // 1. Read what's there (for the report + the photo/claim lists) BEFORE deleting.
  const { data: contributor, error: cErr } = await admin
    .from('contributors')
    .select('id')
    .eq('id', contributorId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);

  const { data: confs, error: fErr } = await admin
    .from('confirmations')
    .select('id, claim_id, photo_url')
    .eq('contributor_id', contributorId);
  if (fErr) throw new Error(fErr.message);

  const { data: listings, error: lErr } = await admin
    .from('listings')
    .select('id')
    .eq('submitted_by', contributorId);
  if (lErr) throw new Error(lErr.message);

  const confirmations = confs ?? [];
  const affectedClaimIds = [...new Set(confirmations.map((c) => c.claim_id as string))];
  const listingIds = (listings ?? []).map((l) => l.id as string);

  if (!contributor) {
    // Idempotent: nothing to delete.
    return {
      contributorId,
      existed: false,
      deletedConfirmations: 0,
      deletedPhotos: 0,
      keptListingIds: listingIds,
      affectedClaimIds,
    };
  }

  // 2. Remove evidence photos from storage FIRST (not covered by FK cascade).
  const paths = confirmations
    .map((c) => storagePathFromPublicUrl(c.photo_url as string | null))
    .filter((p): p is string => p !== null);
  let deletedPhotos = 0;
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from('evidence').remove(paths);
    if (rmErr) throw new Error(`evidence photo removal failed: ${rmErr.message}`);
    deletedPhotos = paths.length;
  }

  // 3. Optionally erase submitted listings (default: keep, null the link).
  if (opts.deleteSubmittedListings && listingIds.length > 0) {
    const { error } = await admin.from('listings').delete().in('id', listingIds);
    if (error) throw new Error(error.message);
  }

  // 4. Delete the contributor. FK cascade removes their confirmations; FK
  //    set-null clears submitted_by on any kept listings.
  const { error: delErr } = await admin.from('contributors').delete().eq('id', contributorId);
  if (delErr) throw new Error(delErr.message);

  return {
    contributorId,
    existed: true,
    deletedConfirmations: confirmations.length,
    deletedPhotos,
    keptListingIds: opts.deleteSubmittedListings ? [] : listingIds,
    affectedClaimIds,
  };
}

// Evidence photos are stored as public URLs like
//   {base}/storage/v1/object/public/evidence/{claimId}/{uuid}.jpg
// Storage.remove() wants the path WITHIN the bucket: "{claimId}/{uuid}.jpg".
// Returns null for anything that isn't an evidence-bucket URL (defensive).
export function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = '/evidence/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split('?')[0];
  return path || null;
}
