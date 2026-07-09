// GET /api/auth/callback — finish the OIDC flow. Validate the CSRF `state`,
// exchange the code (+ PKCE verifier) for tokens, verify the ID token against
// Keycloak's JWKS, then MINT OUR OWN session (layered sessions, invariant #1) and
// set it as an httpOnly cookie. The OIDC token is never stored or sent to the
// browser. Zero client JS.
import type { APIRoute } from 'astro';
import { getOidcConfig, cookieSecure } from '../../../lib/auth/config';
import { exchangeCode, getEndpoints, sanitizeReturnTo } from '../../../lib/auth/oidc';
import { remoteJwks, verifyIdToken } from '../../../lib/auth/verify';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getOrCreateContributorBySub } from '../../../lib/contributor';
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from '../../../lib/auth/session';

export const prerender = false;

const TEMP_COOKIES = ['aa_oidc_verifier', 'aa_oidc_state', 'aa_oidc_return'];

export const GET: APIRoute = async ({ url, cookies }) => {
  const config = getOidcConfig();
  const returnTo = sanitizeReturnTo(cookies.get('aa_oidc_return')?.value);
  const fail = () =>
    new Response(null, { status: 303, headers: { Location: `${returnTo}?status=auth_error` } });
  const clearTemp = () => TEMP_COOKIES.forEach((n) => cookies.delete(n, { path: '/' }));

  if (!config || !supabaseAdmin) {
    clearTemp();
    return fail();
  }

  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const savedState = cookies.get('aa_oidc_state')?.value;
    const verifier = cookies.get('aa_oidc_verifier')?.value;
    clearTemp();
    // CSRF: the returned state must match the one we set before redirecting.
    if (!code || !state || !savedState || state !== savedState || !verifier) return fail();

    const endpoints = await getEndpoints(config.issuer);
    const tokens = await exchangeCode(config, endpoints, { code, verifier });
    const { sub } = await verifyIdToken(tokens.id_token, remoteJwks(endpoints.jwks_uri), {
      issuer: config.issuer,
      audience: config.clientId,
    });

    const contributor = await getOrCreateContributorBySub(supabaseAdmin, sub, null);
    const { token } = await createSession(supabaseAdmin, contributor.id);
    cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: cookieSecure(config),
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return new Response(null, { status: 303, headers: { Location: returnTo } });
  } catch {
    clearTemp();
    return fail();
  }
};
