import { describe, it, expect } from 'vitest';
import { createSession, revokeSession, verifySession } from '../../src/lib/auth/session';

// The app session is the only credential the write endpoints trust, so its
// lifecycle must be airtight: a minted token verifies, an unknown one doesn't,
// and revocation/expiry take effect immediately. A fake `contributor_sessions`
// store (no DB) pins the behavior — including that only the token HASH is stored.

function fakeSessions() {
  const rows: Array<Record<string, unknown>> = [];
  const admin: any = {
    from: () => {
      let col = '';
      let val: unknown = null;
      let mode: 'select' | 'update' | null = null;
      let patch: Record<string, unknown> = {};
      const api: any = {
        insert: async (row: Record<string, unknown>) => {
          rows.push({ revoked_at: null, ...row });
          return { error: null };
        },
        select: () => {
          mode = 'select';
          return api;
        },
        update: (p: Record<string, unknown>) => {
          mode = 'update';
          patch = p;
          return api;
        },
        eq: (c: string, v: unknown) => {
          col = c;
          val = v;
          if (mode === 'update') {
            rows.filter((r) => r[col] === val).forEach((r) => Object.assign(r, patch));
            return Promise.resolve({ error: null });
          }
          return api;
        },
        maybeSingle: async () => ({ data: rows.find((r) => r[col] === val) ?? null, error: null }),
      };
      return api;
    },
  };
  return { admin, rows };
}

describe('session lifecycle', () => {
  it('mints a session whose token verifies to the contributor', async () => {
    const { admin, rows } = fakeSessions();
    const { token } = await createSession(admin, 'contrib-1');
    // The RAW token is never persisted — only its hash.
    expect(rows[0].token_hash).toBeTypeOf('string');
    expect(rows[0].token_hash).not.toBe(token);
    expect(await verifySession(admin, token)).toBe('contrib-1');
  });

  it('rejects unknown or missing tokens', async () => {
    const { admin } = fakeSessions();
    expect(await verifySession(admin, 'not-a-real-token')).toBeNull();
    expect(await verifySession(admin, undefined)).toBeNull();
  });

  it('rejects a revoked session immediately', async () => {
    const { admin } = fakeSessions();
    const { token } = await createSession(admin, 'contrib-1');
    await revokeSession(admin, token);
    expect(await verifySession(admin, token)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const { admin } = fakeSessions();
    // Mint as if 40 days ago; the 30-day TTL means it is already expired now.
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const { token } = await createSession(admin, 'contrib-1', longAgo);
    expect(await verifySession(admin, token)).toBeNull();
  });
});
