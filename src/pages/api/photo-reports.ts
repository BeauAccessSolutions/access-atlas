// POST /api/photo-reports — a visitor flags an evidence photo for ops triage
// (§7). On-demand (needs a per-request server). Zero-JS: a normal <form> POST
// and a 303 redirect back to the listing with an honest status banner, exactly
// like /api/settings and /api/confirmations.
//
// GATED: reporting is only accepted when public contributions are open
// (contributionsOpen). The UI doesn't render the control when closed, and this
// endpoint refuses a direct POST too — a report queue with no contributing
// public is premature (§13).
//
// PRIVACY (§6): reporter-anonymous. We store only the already-public claim_id +
// photo_url and a coarse reason CODE (never free text, never who reported).
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabase-server';
import { contributionsOpen } from '../../lib/contributor';
import { normalizeReportReason, safeReturnTo } from '../../lib/reports';

export const prerender = false;

// Redirect back to where the visitor was, with a status the listing page renders
// in a role="status" banner. The return path is sanitized (no open redirect).
function back(returnTo: string, status: string) {
  const sep = returnTo.includes('?') ? '&' : '?';
  return new Response(null, {
    status: 303,
    headers: { Location: `${returnTo}${sep}photo_report=${status}` },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('Bad request', { status: 400 });

  const returnTo = safeReturnTo(form.get('return_to'), '/');

  // Hard gate: refuse unless contributions are open. Honest status, not a 404.
  if (!contributionsOpen()) return back(returnTo, 'closed');
  if (!supabaseAdmin || !supabase) return back(returnTo, 'error');

  const claimId = form.get('claim_id');
  const photoUrl = form.get('photo_url');
  const reason = normalizeReportReason(form.get('reason'));
  if (typeof claimId !== 'string' || !claimId || typeof photoUrl !== 'string' || !photoUrl) {
    return back(returnTo, 'error');
  }
  if (!reason) return back(returnTo, 'need_reason');

  try {
    // Only accept a report for a photo that ACTUALLY EXISTS in the public
    // evidence view — stops the endpoint from being a dumping ground for
    // arbitrary attacker-supplied URLs. This is a public read, so use the anon
    // client (evidence_photos is granted to anon, not the service role).
    const { data: exists, error: exErr } = await supabase
      .from('evidence_photos')
      .select('claim_id')
      .eq('claim_id', claimId)
      .eq('photo_url', photoUrl)
      .maybeSingle();
    if (exErr) return back(returnTo, 'error');
    if (!exists) return back(returnTo, 'gone'); // already redacted, or never existed

    const { error } = await supabaseAdmin
      .from('photo_reports')
      .insert({ claim_id: claimId, photo_url: photoUrl, reason });
    if (error) return back(returnTo, 'error');

    return back(returnTo, 'thanks');
  } catch {
    return back(returnTo, 'error');
  }
};
