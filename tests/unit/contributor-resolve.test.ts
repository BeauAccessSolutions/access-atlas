import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { resolveContributor } from '../../src/lib/contributor';

// resolveContributor is the single gate every write endpoint asks "may this
// proceed, and as whom?". Its precedence is safety-critical (§6): a verified
// session wins; else Keycloak-configured means you MUST sign in; else the
// provisional stand-in only when explicitly enabled; else refuse. Pin all four.

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

function fakeAdmin(session?: {
  token_hash: string;
  contributor_id: string;
  expires_at: string;
  revoked_at: string | null;
}) {
  const sessions = session ? [session] : [];
  const contributors: Array<Record<string, unknown>> = [];
  let n = 0;
  const admin: any = {
    from: (t: string) => {
      let col = '';
      let val: unknown = null;
      const api: any = {
        insert: (row: Record<string, unknown>) => {
          if (t === 'contributors') {
            const id = `c${++n}`;
            contributors.push({ id, ...row });
            return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
          }
          return Promise.resolve({ error: null });
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
  return { admin, contributors };
}

const KC = () => {
  vi.stubEnv('KEYCLOAK_ISSUER', 'https://id.test/realms/bas');
  vi.stubEnv('KEYCLOAK_CLIENT_ID', 'access-atlas');
  vi.stubEnv('KEYCLOAK_REDIRECT_URI', 'https://app/api/auth/callback');
};

describe('resolveContributor precedence', () => {
  it('1. a verified session wins, even with Keycloak configured', async () => {
    KC();
    const token = 'tok-1';
    const { admin } = fakeAdmin({
      token_hash: sha256(token),
      contributor_id: 'contrib-9',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      revoked_at: null,
    });
    const r = await resolveContributor(fakeCookies({ aa_session: token }), admin, {
      pseudonym: null,
    });
    expect(r).toEqual({ contributor: { id: 'contrib-9', provisional: false } });
  });

  it('2. Keycloak configured + no session → need_signin', async () => {
    KC();
    const { admin } = fakeAdmin();
    const r = await resolveContributor(fakeCookies(), admin, { pseudonym: null });
    expect(r).toEqual({ gate: 'need_signin' });
  });

  it('3. no Keycloak + provisional enabled → a provisional contributor', async () => {
    vi.stubEnv('ALLOW_PROVISIONAL_CONTRIBUTIONS', 'true');
    const { admin } = fakeAdmin();
    const cookies = fakeCookies();
    const r = await resolveContributor(cookies, admin, { pseudonym: 'Anon' });
    expect('contributor' in r && r.contributor.provisional).toBe(true);
    expect(cookies.get('aa_contributor')).toBeTruthy(); // provisional cookie set
  });

  it('4. neither configured → disabled', async () => {
    const { admin } = fakeAdmin();
    const r = await resolveContributor(fakeCookies(), admin, { pseudonym: null });
    expect(r).toEqual({ gate: 'disabled' });
  });
});
