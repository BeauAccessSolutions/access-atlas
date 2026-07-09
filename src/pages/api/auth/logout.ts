// POST /api/auth/logout — revoke the app session and clear the cookie. Revocation
// is immediate (the session row is marked revoked), so a stolen cookie stops
// working the moment the user logs out (invariant #1: revocable sessions). POST
// (not GET) so a cross-site image/link can't force a logout.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { SESSION_COOKIE, revokeSession } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token && supabaseAdmin) {
    try {
      await revokeSession(supabaseAdmin, token);
    } catch {
      // Best-effort: clearing the cookie below still logs the user out locally.
    }
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return new Response(null, { status: 303, headers: { Location: '/' } });
};
