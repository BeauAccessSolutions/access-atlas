// POST /api/account/delete — the self-service half of the §6 CCPA/CPRA
// DELETION right (BAS invariant #3). Erases the contributor's PERSONAL data —
// their confirmations, evidence photos, display name, and account — via the
// same single implementation the ops CLI drives (src/lib/data-rights.ts).
// Listings they suggested are community safety data about a place, not about
// them: those are kept with the personal link severed. Self-service NEVER
// purges listings; that override stays ops-only (spam/abuse).
//
// Guardrails, in order:
//   * a resolved contributor is required (verified Keycloak session, or the
//     provisional stand-in when explicitly enabled) — this is never an
//     unauthenticated destructive endpoint, and you can only delete YOURSELF;
//   * the typed confirmation word from /account/delete/ is required
//     (destructive-action confirmation — a11y crossover audit Tier 3; a stray
//     click or Enter press must never erase data);
//   * consensus side effects are surfaced, not swallowed (§4 "never silently"):
//     claims that lose confirmations — including a dissent whose departure may
//     un-freeze a claim — are logged for ops re-review.
//
// Phase B attach point (invariant #1): when Keycloak step-up (ACR) lands, this
// endpoint is where a fresh/elevated authentication gets required.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getAccountContributor, PROVISIONAL_COOKIE } from '../../../lib/contributor';
import { keycloakConfigured } from '../../../lib/auth/config';
import { confirmsDeletion, deleteContributorData } from '../../../lib/data-rights';
import { SESSION_COOKIE } from '../../../lib/auth/session';

export const prerender = false;

function redirect(to: string) {
  return new Response(null, { status: 303, headers: { Location: to } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!supabaseAdmin) return redirect('/account/?status=disabled');
  try {
    const who = await getAccountContributor(cookies, supabaseAdmin);
    if (!who) {
      return redirect(`/account/?status=${keycloakConfigured() ? 'need_signin' : 'nothing'}`);
    }

    const form = await request.formData().catch(() => null);
    if (!confirmsDeletion(form?.get('confirm'))) {
      return redirect('/account/delete/?status=need_confirm');
    }

    const result = await deleteContributorData(supabaseAdmin, who.id);

    // §4: deleting confirmations recomputes consensus on those claims — a
    // dissent that FROZE a claim leaving can un-freeze it. Surface that to ops
    // (server log is the interim channel; there is no operator in this flow).
    if (result.affectedClaimIds.length > 0) {
      console.warn(
        `[data-rights] contributor self-deletion removed confirmations from ` +
          `${result.affectedClaimIds.length} claim(s); re-review (§4): ` +
          result.affectedClaimIds.join(', '),
      );
    }

    // The contributor row is gone, so their sessions are already cascade-
    // deleted (migration 0006) — clearing the cookies just tidies the browser.
    cookies.delete(SESSION_COOKIE, { path: '/' });
    cookies.delete(PROVISIONAL_COOKIE, { path: '/' });
    return redirect('/account/?status=deleted');
  } catch {
    return redirect('/account/?status=error');
  }
};
