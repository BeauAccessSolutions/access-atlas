// POST /api/confirmations — record one first-person confirmation or dissent
// against an attribute claim (§4). On-demand (needs a per-request server).
//
// Two ways in, one write path:
//   * claimId                    — the classic confirm flow (an existing claim);
//   * listingId + attributeKey   — the FIRST-report flow (§13): the attribute has
//     no claim on this listing yet, so the report creates the claim and this
//     visit's confirmation together. The claim starts at "1 community
//     confirmation" (or "disputed" for a first-person "no") — it is a visit
//     report, not a submitter's self-assertion, so it counts (§4).
//
// This is the write side of the moat. It enforces, server-side:
//   * the hard write-gate (contributor.ts) — refuses unless provisional
//     contributions are explicitly enabled or real auth exists;
//   * evidence: a photo is required to CONFIRM an objective (photo-backed)
//     attribute (§4) — but NOT required to dissent (favor dissent on safety, §4);
//   * independence: one confirmation per contributor per claim (DB unique
//     constraint; a repeat is reported back honestly, not silently dropped);
//   * privacy: the photo is re-encoded through sharp to strip EXIF/GPS before it
//     is ever stored (§6).
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { supabaseAdmin } from '../../lib/supabase-server';
import { getAttributeForReport, getClaimForConfirm } from '../../lib/repo';
import { resolveContributor } from '../../lib/contributor';
import { sanitizeTags } from '../../lib/identity-tags';
import { setFormEcho, clearFormEcho } from '../../lib/form-echo';

export const prerender = false;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB before re-encode
const MAX_NOTE_LEN = 2000;
const MAX_ALT_LEN = 300;

// Every exit redirects back to a form page with an honest status the page
// renders in a role="status" banner. Zero-JS: the server tells the user what
// happened via a normal 303 redirect.
function redirectTo(path: string, status: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `${path}?status=${status}` },
  });
}

const confirmPath = (claimId: string) => `/contribute/confirm/${encodeURIComponent(claimId)}`;
const reportPath = (listingId: string, attributeKey: string) =>
  `/contribute/report/${encodeURIComponent(listingId)}/${encodeURIComponent(attributeKey)}`;

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('Bad request', { status: 400 });

  const claimIdRaw = form.get('claimId');
  const listingIdRaw = form.get('listingId');
  const attributeKeyRaw = form.get('attributeKey');

  // Which door did the report come through? claimId wins; otherwise the
  // (listingId, attributeKey) pair names a claim that may not exist yet.
  const givenClaimId = typeof claimIdRaw === 'string' && claimIdRaw ? claimIdRaw : null;
  const listingId = typeof listingIdRaw === 'string' && listingIdRaw ? listingIdRaw : null;
  const attributeKey =
    typeof attributeKeyRaw === 'string' && attributeKeyRaw ? attributeKeyRaw : null;
  if (!givenClaimId && !(listingId && attributeKey)) {
    return new Response('Bad request', { status: 400 });
  }
  // Errors BEFORE a claim exists go back to the form the person was on.
  const formBase = givenClaimId ? confirmPath(givenClaimId) : reportPath(listingId!, attributeKey!);
  const back = (status: string) => redirectTo(formBase, status);

  // Preserve everything the contributor typed so a single-field error doesn't
  // wipe the form (§5). Every error path below re-renders the form via `back()`;
  // the success path clears this so a recorded report leaves the form blank.
  setFormEcho(cookies, form);

  // Writes require a resolved contributor — a verified Keycloak session, or the
  // provisional stand-in when explicitly enabled. resolveContributor encodes the
  // precedence and the hard gate (§6); we just need the DB to be configured here.
  if (!supabaseAdmin) return back('disabled');

  try {
    // What is being answered: the claim's question (confirm flow) or the
    // attribute's question for a claim that may not exist yet (report flow).
    let requiresPhoto: boolean;
    let existingClaimId: string | null;
    let attributeDefId: string | null = null;
    if (givenClaimId) {
      const claim = await getClaimForConfirm(givenClaimId);
      if (!claim) return back('notfound');
      requiresPhoto = claim.requiresPhoto;
      existingClaimId = claim.claimId;
    } else {
      const target = await getAttributeForReport(listingId!, attributeKey!);
      if (!target) return back('notfound');
      requiresPhoto = target.requiresPhoto;
      existingClaimId = target.existingClaimId;
      attributeDefId = target.attributeDefId;
    }

    const agreesRaw = form.get('agrees');
    if (agreesRaw !== 'yes' && agreesRaw !== 'no') {
      return back('need_answer');
    }
    const agrees = agreesRaw === 'yes';

    // Evidence rule: confirming a photo-backed objective claim needs a photo;
    // dissent never does (§4).
    const photo = form.get('photo');
    const hasPhoto = photo instanceof File && photo.size > 0;
    if (requiresPhoto && agrees && !hasPhoto) {
      return back('photo_required');
    }
    if (hasPhoto && (photo as File).size > MAX_PHOTO_BYTES) {
      return back('photo_too_big');
    }

    // Alt text is part of the evidence (§5; a11y audit Tier 3): a photo a blind
    // or low-vision user can't read isn't evidence for them. Required with a
    // photo, meaningless without one.
    const photoAlt = ((form.get('photo_alt') as string | null) ?? '').trim().slice(0, MAX_ALT_LEN);
    if (hasPhoto && !photoAlt) {
      return back('alt_required');
    }

    const observedNote = (form.get('observed_note') as string | null)?.slice(0, MAX_NOTE_LEN) || null;
    const visitedOn = normalizeDate(form.get('visited_on'));
    const tags = sanitizeTags(form.getAll('identity_tags').map(String));
    const pseudonym = (form.get('pseudonym') as string | null) ?? null;

    const resolved = await resolveContributor(cookies, supabaseAdmin, { pseudonym });
    if ('gate' in resolved) return back(resolved.gate);
    const contributor = resolved.contributor;

    // First-report flow: create the claim now — AFTER validation and the write
    // gate, so a fixable form error never leaves an empty claim behind. If two
    // people race to first-report the same attribute, the unique
    // (listing_id, attribute_def_id) constraint decides and the loser re-reads
    // the winner's claim — both visits then count against one claim (§4
    // independence, no duplicates).
    let claimId = existingClaimId;
    if (!claimId) {
      const inserted = await supabaseAdmin
        .from('attribute_claims')
        .insert({ listing_id: listingId, attribute_def_id: attributeDefId })
        .select('id')
        .single();
      if (inserted.error) {
        if ((inserted.error as { code?: string }).code === '23505') {
          const again = await supabaseAdmin
            .from('attribute_claims')
            .select('id')
            .eq('listing_id', listingId!)
            .eq('attribute_def_id', attributeDefId!)
            .maybeSingle();
          claimId = again.data?.id ?? null;
        }
        if (!claimId) return back('error');
      } else {
        claimId = inserted.data.id as string;
      }
    }
    // From here on, errors return to the canonical per-claim confirm form — the
    // claim exists now, and the report page would just redirect there anyway.
    const backToClaim = (status: string) => redirectTo(confirmPath(claimId!), status);

    // Strip EXIF + normalize BEFORE storing (§6). sharp drops metadata by
    // default on re-encode; rotate() bakes in orientation so we can. Two
    // outputs from one pass: the full evidence photo and a small thumbnail so
    // listing pages can show evidence within the low-bandwidth budget (§5) —
    // the full photo stays one click away.
    let photoUrl: string | null = null;
    let photoThumbUrl: string | null = null;
    if (hasPhoto) {
      const input = Buffer.from(await (photo as File).arrayBuffer());
      const base = sharp(input).rotate();
      const [cleaned, thumb] = await Promise.all([
        base
          .clone()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer(),
        base
          .clone()
          .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer(),
      ]);
      const id = crypto.randomUUID();
      const path = `${claimId}/${id}.jpg`;
      const thumbPath = `${claimId}/${id}.thumb.jpg`;
      const store = supabaseAdmin.storage.from('evidence');
      const [up, upThumb] = await Promise.all([
        store.upload(path, cleaned, { contentType: 'image/jpeg', upsert: false }),
        store.upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: false }),
      ]);
      if (up.error || upThumb.error) return backToClaim('error');
      photoUrl = store.getPublicUrl(path).data.publicUrl;
      photoThumbUrl = store.getPublicUrl(thumbPath).data.publicUrl;
    }

    const { error } = await supabaseAdmin.from('confirmations').insert({
      claim_id: claimId,
      contributor_id: contributor.id,
      agrees,
      observed_note: observedNote,
      photo_url: photoUrl,
      photo_thumb_url: photoThumbUrl,
      photo_alt: hasPhoto ? photoAlt : null,
      reviewer_identity_tags: tags,
      visited_on: visitedOn,
    });

    if (error) {
      // 23505 = unique_violation → this contributor already reported this claim.
      if ((error as { code?: string }).code === '23505') return backToClaim('already');
      // If we just created the claim, a failed confirmation leaves it empty —
      // that renders honestly as "self-reported / awaiting verification" (the
      // person DID report it; only the visit record failed). No cleanup delete:
      // a cascade delete could race away someone else's confirmation.
      return backToClaim('error');
    }

    clearFormEcho(cookies);
    return backToClaim('thanks');
  } catch {
    return back('error');
  }
};

// Accept an ISO date (yyyy-mm-dd) only; anything else becomes null rather than
// risking a bad insert.
function normalizeDate(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}
