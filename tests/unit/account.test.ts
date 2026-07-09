import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { getAccountContributor } from '../../src/lib/contributor';
import { confirmsDeletion } from '../../src/lib/data-rights';

// The self-service data-rights door (§6 CCPA/CPRA, BAS invariant #3) hangs off
// two pieces of logic pinned here:
//   * getAccountContributor — WHOSE data this browser may manage. It must never
//     create a contributor, never honor a provisional cookie unless the
//     provisional mode is explicitly enabled, and never resurrect a deleted
//     contributor from a stale cookie.
//   * confirmsDeletion — the typed destructive-action confirmation. Nothing is
//     erased without it.

afterEach(() => vi.unstubAllEnvs());

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');

function fakeCookies(initial: Record<string, string> = {}) {
  const jar: Record<string, string> = { ...initial };
  return {
    get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
    set: (n: string, v: string) => {
      jar[n] = v;
    },
    delete: (n: string) => {
      delete jar[n];
    },
  } as any;
}

function fakeAdmin(data: {
  sessions?: Array<{
    token_hash: string;
    contributor_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>;
  contributors?: Array<{ id: string; pseudonym: string | null }>;
}) {
  const sessions = data.sessions ?? [];
  const contributors = data.contributors ?? [];
  const inserts: string[] = [];
  const admin: any = {
    from: (t: string) => {
      let col = '';
      let val: unknown = null;
      const api: any = {
        insert: () => {
          inserts.push(t);
          throw new Error('getAccountContributor must never insert');
        },
        select: () => api,
        eq: (c: string, v: unknown) => {
          col = c;
          val = v;
          return api;
        },
        maybeSingle: async () => {
          const pool = t === 'contributor_sessions' ? sessions : contributors;
          return { data: (pool as any[]).find((r) => r[col] === val) ?? null, error: null };
        },
      };
      return api;
    },
  };
  return { admin, inserts };
}

const KC = () => {
  vi.stubEnv('KEYCLOAK_ISSUER', 'https://id.test/realms/bas');
  vi.stubEnv('KEYCLOAK_CLIENT_ID', 'access-atlas');
  vi.stubEnv('KEYCLOAK_REDIRECT_URI', 'https://app/api/auth/callback');
};

describe('getAccountContributor', () => {
  it('resolves a verified session to its contributor (with pseudonym)', async () => {
    KC();
    const token = 'tok-1';
    const { admin } = fakeAdmin({
      sessions: [
        {
          token_hash: sha256(token),
          contributor_id: 'contrib-9',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          revoked_at: null,
        },
      ],
      contributors: [{ id: 'contrib-9', pseudonym: 'RampScout' }],
    });
    const who = await getAccountContributor(fakeCookies({ aa_session: token }), admin);
    expect(who).toEqual({ id: 'contrib-9', provisional: false, pseudonym: 'RampScout' });
  });

  it('honors the provisional cookie only when provisional mode is enabled', async () => {
    const { admin } = fakeAdmin({ contributors: [{ id: 'prov-1', pseudonym: null }] });
    const cookies = fakeCookies({ aa_contributor: 'prov-1' });

    // Not enabled → the cookie is ignored.
    expect(await getAccountContributor(cookies, admin)).toBeNull();

    // Enabled → the cookie resolves.
    vi.stubEnv('ALLOW_PROVISIONAL_CONTRIBUTIONS', 'true');
    expect(await getAccountContributor(cookies, admin)).toEqual({
      id: 'prov-1',
      provisional: true,
      pseudonym: null,
    });
  });

  it('ignores the provisional cookie when Keycloak is configured (real auth only)', async () => {
    KC();
    vi.stubEnv('ALLOW_PROVISIONAL_CONTRIBUTIONS', 'true');
    const { admin } = fakeAdmin({ contributors: [{ id: 'prov-1', pseudonym: null }] });
    const who = await getAccountContributor(fakeCookies({ aa_contributor: 'prov-1' }), admin);
    expect(who).toBeNull();
  });

  it('a stale cookie for a deleted contributor resolves to null, never resurrects', async () => {
    vi.stubEnv('ALLOW_PROVISIONAL_CONTRIBUTIONS', 'true');
    const { admin, inserts } = fakeAdmin({ contributors: [] }); // row already deleted
    const who = await getAccountContributor(fakeCookies({ aa_contributor: 'gone-1' }), admin);
    expect(who).toBeNull();
    expect(inserts).toEqual([]); // and nothing was created
  });

  it('no session and no cookie → null', async () => {
    vi.stubEnv('ALLOW_PROVISIONAL_CONTRIBUTIONS', 'true');
    const { admin } = fakeAdmin({});
    expect(await getAccountContributor(fakeCookies(), admin)).toBeNull();
  });
});

describe('confirmsDeletion (destructive-action confirmation)', () => {
  it('accepts the typed word, tolerant of case and whitespace (§5 cognitive access)', () => {
    expect(confirmsDeletion('delete')).toBe(true);
    expect(confirmsDeletion('  DELETE ')).toBe(true);
    expect(confirmsDeletion('Delete')).toBe(true);
  });

  it('rejects everything else — nothing is erased without the word', () => {
    expect(confirmsDeletion('')).toBe(false);
    expect(confirmsDeletion('yes')).toBe(false);
    expect(confirmsDeletion('delete my data')).toBe(false);
    expect(confirmsDeletion(null)).toBe(false);
    expect(confirmsDeletion(undefined)).toBe(false);
    expect(confirmsDeletion(true)).toBe(false);
  });
});
