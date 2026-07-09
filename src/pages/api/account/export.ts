// POST /api/account/export — the self-service half of the §6 CCPA/CPRA EXPORT
// right (BAS invariant #3). Downloads everything we hold tied to the current
// contributor as a JSON file, immediately — no request form, no waiting period.
//
// Reuses the single implementation in src/lib/data-rights.ts (same one the ops
// CLI drives). Gated by the contributor seam: a verified Keycloak session, or
// the provisional stand-in when explicitly enabled — never a way to pull
// someone ELSE's data (you can only be resolved to yourself).
//
// POST, not GET, on purpose: session cookies are SameSite=Lax, which rides
// cross-site top-level GET navigations but NOT cross-site POSTs — so another
// site can't trigger a data download in your name.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getAccountContributor } from '../../../lib/contributor';
import { keycloakConfigured } from '../../../lib/auth/config';
import { exportContributorData } from '../../../lib/data-rights';

export const prerender = false;

// Every failure exits back to the account page with an honest status banner
// (zero-JS: the server says what happened via a normal 303 redirect).
function back(status: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `/account/?status=${status}` },
  });
}

export const POST: APIRoute = async ({ cookies }) => {
  if (!supabaseAdmin) return back('disabled');
  try {
    const who = await getAccountContributor(cookies, supabaseAdmin);
    if (!who) return back(keycloakConfigured() ? 'need_signin' : 'nothing');

    const data = await exportContributorData(supabaseAdmin, who.id);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="access-atlas-my-data.json"',
        // Personal data: never let a shared cache hold this response.
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return back('error');
  }
};
