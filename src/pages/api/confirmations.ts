// POST /api/confirmations — record one first-person confirmation or dissent
// against an attribute claim (§4). On-demand (needs a per-request server).
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
import { getClaimForConfirm } from '../../lib/repo';
import { resolveContributor } from '../../lib/contributor';
import { sanitizeTags } from '../../lib/identity-tags';

export const prerender = false;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB before re-encode
const MAX_NOTE_LEN = 2000;

// Every exit redirects back to the confirm page with an honest status the page
// renders in a role="status" banner. Zero-JS: the server tells the user what
// happened via a normal 303 redirect.
function back(claimId: string, status: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `/contribute/confirm/${encodeURIComponent(claimId)}?status=${status}` },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData().catch(() => null);
  const claimId = form?.get('claimId');
  if (!form || typeof claimId !== 'string' || !claimId) {
    return new Response('Bad request', { status: 400 });
  }

  // Writes require a resolved contributor — a verified Keycloak session, or the
  // provisional stand-in when explicitly enabled. resolveContributor encodes the
  // precedence and the hard gate (§6); we just need the DB to be configured here.
  if (!supabaseAdmin) return back(claimId, 'disabled');

  try {
    const claim = await getClaimForConfirm(claimId);
    if (!claim) return back(claimId, 'notfound');

    const agreesRaw = form.get('agrees');
    if (agreesRaw !== 'yes' && agreesRaw !== 'no') {
      return back(claimId, 'need_answer');
    }
    const agrees = agreesRaw === 'yes';

    // Evidence rule: confirming a photo-backed objective claim needs a photo;
    // dissent never does (§4).
    const photo = form.get('photo');
    const hasPhoto = photo instanceof File && photo.size > 0;
    if (claim.requiresPhoto && agrees && !hasPhoto) {
      return back(claimId, 'photo_required');
    }
    if (hasPhoto && (photo as File).size > MAX_PHOTO_BYTES) {
      return back(claimId, 'photo_too_big');
    }

    const observedNote = (form.get('observed_note') as string | null)?.slice(0, MAX_NOTE_LEN) || null;
    const visitedOn = normalizeDate(form.get('visited_on'));
    const tags = sanitizeTags(form.getAll('identity_tags').map(String));
    const pseudonym = (form.get('pseudonym') as string | null) ?? null;

    const resolved = await resolveContributor(cookies, supabaseAdmin, { pseudonym });
    if ('gate' in resolved) return back(claimId, resolved.gate);
    const contributor = resolved.contributor;

    // Strip EXIF + normalize BEFORE storing (§6). sharp drops metadata by
    // default on re-encode; rotate() bakes in orientation so we can.
    let photoUrl: string | null = null;
    if (hasPhoto) {
      const input = Buffer.from(await (photo as File).arrayBuffer());
      const cleaned = await sharp(input)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const path = `${claimId}/${crypto.randomUUID()}.jpg`;
      const up = await supabaseAdmin.storage
        .from('evidence')
        .upload(path, cleaned, { contentType: 'image/jpeg', upsert: false });
      if (up.error) return back(claimId, 'error');
      photoUrl = supabaseAdmin.storage.from('evidence').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabaseAdmin.from('confirmations').insert({
      claim_id: claimId,
      contributor_id: contributor.id,
      agrees,
      observed_note: observedNote,
      photo_url: photoUrl,
      reviewer_identity_tags: tags,
      visited_on: visitedOn,
    });

    if (error) {
      // 23505 = unique_violation → this contributor already reported this claim.
      if ((error as { code?: string }).code === '23505') return back(claimId, 'already');
      return back(claimId, 'error');
    }

    return back(claimId, 'thanks');
  } catch {
    return back(claimId, 'error');
  }
};

// Accept an ISO date (yyyy-mm-dd) only; anything else becomes null rather than
// risking a bad insert.
function normalizeDate(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}
