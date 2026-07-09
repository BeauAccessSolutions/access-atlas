// The app's OWN data-access session — the "mint" half of layered sessions
// (invariant #1). After verify.ts proves the OIDC token, we create a session
// here that is short-lived, REVOCABLE (a DB row, not a bare signed JWT), and the
// only credential the write endpoints trust.
//
// SECURITY: the httpOnly cookie holds a high-entropy random token; we persist
// only its SHA-256 hash (`token_hash`). So the raw session token exists only in
// the user's cookie — a leaked DB snapshot can't be replayed. Lookups hash the
// presented token and compare.
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomToken } from './oidc';

export const SESSION_COOKIE = 'aa_session';

// 30 days, then re-auth. Revocation (logout / admin) is immediate regardless.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface NewSession {
  token: string; // goes in the cookie (raw); never stored
  expiresAt: Date;
}

/** Mint a session row for a contributor and return the raw cookie token. */
export async function createSession(
  admin: SupabaseClient,
  contributorId: string,
  now = new Date(),
): Promise<NewSession> {
  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const { error } = await admin.from('contributor_sessions').insert({
    contributor_id: contributorId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return { token, expiresAt };
}

/**
 * Resolve a cookie token to its contributor id, or null if the session is
 * unknown, revoked, or expired. Read-then-check (not a SQL filter) keeps the
 * logic explicit and unit-testable.
 */
export async function verifySession(
  admin: SupabaseClient,
  token: string | undefined | null,
  now = new Date(),
): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await admin
    .from('contributor_sessions')
    .select('contributor_id, expires_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= now.getTime()) return null;
  return data.contributor_id as string;
}

/** Revoke a session (logout). Idempotent — a missing token is a no-op. */
export async function revokeSession(
  admin: SupabaseClient,
  token: string | undefined | null,
  now = new Date(),
): Promise<void> {
  if (!token) return;
  await admin
    .from('contributor_sessions')
    .update({ revoked_at: now.toISOString() })
    .eq('token_hash', hashToken(token));
}
