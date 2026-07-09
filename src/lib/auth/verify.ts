// ID-token verification against Keycloak's JWKS, using `jose`. NEVER hand-roll
// JWT parsing or signature checking — that is exactly where auth bugs become
// account-takeover bugs. `jose` validates the RS256 signature against the
// published keys and enforces the standard claims.
//
// This is the "validate" half of layered sessions (invariant #1): we prove the
// token is a genuine, unexpired token for THIS client, extract the pairwise
// `sub`, and then session.ts mints our own credential. The OIDC token is never
// stored or reused as a data credential.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { KeyLike } from 'jose';

export interface VerifiedIdentity {
  /** Keycloak pairwise subject id — the stable per-app identity. */
  sub: string;
  /** Authentication Context Class Reference — used for step-up later (Phase B). */
  acr?: string;
}

// Cache the remote key set per JWKS URI. jose's createRemoteJWKSet does its own
// caching + rotation handling; we just avoid rebuilding the fetcher each call.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** The verification key input for a JWKS URI (fetches + rotates keys). */
export function remoteJwks(jwksUri: string): JWTVerifyGetKey {
  let set = jwksCache.get(jwksUri);
  if (!set) {
    set = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, set);
  }
  return set;
}

/**
 * Verify an ID token and return the identity. `key` is either a remote JWKS
 * getter (production, via remoteJwks) or a local key (tests). Throws on any
 * failure — bad signature, wrong issuer/audience, or expiry.
 */
export async function verifyIdToken(
  idToken: string,
  key: JWTVerifyGetKey | KeyLike | Uint8Array,
  opts: { issuer: string; audience: string },
): Promise<VerifiedIdentity> {
  const options = { issuer: opts.issuer, audience: opts.audience };
  // Narrow so each overload of jwtVerify (resolver vs. key) is matched cleanly.
  const { payload } =
    typeof key === 'function'
      ? await jwtVerify(idToken, key, options)
      : await jwtVerify(idToken, key, options);
  if (!payload.sub) throw new Error('ID token has no subject (sub)');
  const acr = typeof payload.acr === 'string' ? payload.acr : undefined;
  return { sub: payload.sub, acr };
}
