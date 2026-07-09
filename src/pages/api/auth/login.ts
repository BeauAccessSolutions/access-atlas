// GET /api/auth/login — start the Keycloak Authorization-Code-+-PKCE flow.
// On-demand, zero client JS: we mint the PKCE verifier + CSRF `state` server-side,
// stash them in short-lived httpOnly cookies, and 302 to Keycloak's hosted login.
// The browser never handles a token (§5, invariant #1).
import type { APIRoute } from 'astro';
import { getOidcConfig, cookieSecure } from '../../../lib/auth/config';
import {
  buildAuthUrl,
  challengeFromVerifier,
  generateVerifier,
  getEndpoints,
  randomToken,
  sanitizeReturnTo,
} from '../../../lib/auth/oidc';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const config = getOidcConfig();
  if (!config) return new Response('Sign-in is not enabled.', { status: 503 });

  try {
    const endpoints = await getEndpoints(config.issuer);
    const verifier = generateVerifier();
    const state = randomToken();
    const returnTo = sanitizeReturnTo(url.searchParams.get('return_to'));

    // Short-lived (10 min): they only need to survive the round-trip to Keycloak.
    const opts = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: cookieSecure(config),
      maxAge: 600,
    } as const;
    cookies.set('aa_oidc_verifier', verifier, opts);
    cookies.set('aa_oidc_state', state, opts);
    cookies.set('aa_oidc_return', returnTo, opts);

    const location = buildAuthUrl(config, endpoints, {
      state,
      challenge: challengeFromVerifier(verifier),
    });
    return new Response(null, { status: 302, headers: { Location: location } });
  } catch {
    return new Response(null, {
      status: 303,
      headers: { Location: '/contribute/submit/?status=auth_error' },
    });
  }
};
