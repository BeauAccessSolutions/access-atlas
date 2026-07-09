// OIDC Authorization-Code-+-PKCE mechanics for the server-side BFF flow.
//
// This runs ONLY on the server (the /api/auth/* routes) — the browser never sees
// a token, which is why the zero-JS browsing surface is untouched (§5) and the
// identity token stays server-side (invariant #1). PKCE uses the built-in
// node:crypto; JWT/JWKS verification lives in verify.ts (jose) — never hand-rolled.
import { createHash, randomBytes } from 'node:crypto';
import type { OidcConfig } from './config';

// --- PKCE (RFC 7636, S256) ---------------------------------------------------

const base64url = (b: Buffer): string => b.toString('base64url');

/** A high-entropy PKCE code verifier (43–128 chars of unreserved base64url). */
export function generateVerifier(): string {
  return base64url(randomBytes(32));
}

/** The S256 challenge for a verifier: base64url(sha256(verifier)). */
export function challengeFromVerifier(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

/** A random opaque token — used for the CSRF `state` and session tokens. */
export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

// --- Discovery ---------------------------------------------------------------

export interface OidcEndpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

// Cache discovery per issuer — the document is stable and re-fetching it on every
// login is wasteful. Cleared only on process restart.
const discoveryCache = new Map<string, OidcEndpoints>();

/** Fetch (and cache) the issuer's OpenID configuration. */
export async function getEndpoints(issuer: string): Promise<OidcEndpoints> {
  const cached = discoveryCache.get(issuer);
  if (cached) return cached;
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as OidcEndpoints;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error('OIDC discovery document missing required endpoints');
  }
  discoveryCache.set(issuer, doc);
  return doc;
}

// --- Authorize + token exchange ----------------------------------------------

/** Build the Keycloak-hosted login URL to redirect the user to. */
export function buildAuthUrl(
  config: OidcConfig,
  endpoints: OidcEndpoints,
  opts: { state: string; challenge: string },
): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid',
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
  });
  return `${endpoints.authorization_endpoint}?${p.toString()}`;
}

export interface TokenResponse {
  id_token: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

/** Exchange the authorization code (+ PKCE verifier) for tokens. */
export async function exchangeCode(
  config: OidcConfig,
  endpoints: OidcEndpoints,
  opts: { code: string; verifier: string },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: opts.verifier,
  });
  const res = await fetch(endpoints.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = (await res.json()) as TokenResponse;
  if (!json.id_token) throw new Error('Token response missing id_token');
  return json;
}

// --- Safe return-to ----------------------------------------------------------

/**
 * Only allow same-origin relative paths as a post-login destination, to prevent
 * an open-redirect. Anything suspicious falls back to the submit page.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  const fallback = '/contribute/submit/';
  if (!raw) return fallback;
  // Must be a root-relative path, and NOT a protocol-relative "//evil.com".
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}
