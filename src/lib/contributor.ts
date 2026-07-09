// The contributor-identity SEAM. Everything that needs "who is contributing"
// goes through here, so swapping the provisional mechanism for the platform
// Keycloak IdP (BAS invariant #1, docs/platform-membership.md) stays a change to
// THIS file only.
//
// Two mechanisms live here, chosen by config:
//   * KEYCLOAK (real): a verified, revocable app session (auth/session.ts) minted
//     after the BFF OIDC flow validates the token (auth/verify.ts). The
//     contributor is keyed by the Keycloak pairwise `sub`.
//   * PROVISIONAL (local/preview only): a cookie-based pseudonym, HARD-GATED by
//     ALLOW_PROVISIONAL_CONTRIBUTIONS so an unauthenticated write endpoint cannot
//     ship by accident. A cookie pseudonym is trivially resettable — it is NOT an
//     anti-abuse control, only a local stand-in until Keycloak is stood up.
//
// `resolveContributor` encodes the precedence (verified session → provisional →
// refuse); the write endpoints call only that. `contributionAccess` tells the
// contribute PAGES which sign-in affordance to show.
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keycloakConfigured } from './auth/config';
import { SESSION_COOKIE, verifySession } from './auth/session';

export const PROVISIONAL_COOKIE = 'aa_contributor';
const COOKIE = PROVISIONAL_COOKIE;

export function provisionalContributionsAllowed(): boolean {
  return import.meta.env.ALLOW_PROVISIONAL_CONTRIBUTIONS === 'true';
}

export interface Contributor {
  id: string;
  provisional: boolean;
}

export type ContributionGate = 'need_signin' | 'disabled';

export interface ContributionAccess {
  /** keycloak = real auth is configured; provisional = local stand-in; closed = neither. */
  mode: 'keycloak' | 'provisional' | 'closed';
  /** whether the visitor can write right now (verified session, or provisional open). */
  signedIn: boolean;
  /** human-readable reason writes are closed (only set in the 'closed' mode). */
  gateReason: string | null;
}

// --- the verified (Keycloak) path -------------------------------------------

/** The contributor behind a verified app session, or null if not signed in. */
export async function getCurrentContributor(
  cookies: AstroCookies,
  admin: SupabaseClient,
): Promise<Contributor | null> {
  const id = await verifySession(admin, cookies.get(SESSION_COOKIE)?.value);
  return id ? { id, provisional: false } : null;
}

/** Find or create the contributor for a verified Keycloak subject (`sub`). */
export async function getOrCreateContributorBySub(
  admin: SupabaseClient,
  sub: string,
  pseudonym: string | null,
): Promise<Contributor> {
  const existing = await admin.from('contributors').select('id').eq('sub', sub).maybeSingle();
  if (existing.data) return { id: existing.data.id as string, provisional: false };

  const { data, error } = await admin
    .from('contributors')
    .insert({ sub, pseudonym: pseudonym?.trim() || null })
    .select('id')
    .single();
  if (error) {
    // Lost an insert race on the unique `sub` — re-read the winner's row.
    if ((error as { code?: string }).code === '23505') {
      const again = await admin.from('contributors').select('id').eq('sub', sub).maybeSingle();
      if (again.data) return { id: again.data.id as string, provisional: false };
    }
    throw error;
  }
  return { id: data.id as string, provisional: false };
}

// --- the provisional (local) path -------------------------------------------

// Resolve the current provisional contributor, creating a pseudonymous record on
// first contribution and keying it by a long-lived httpOnly cookie.
export async function getOrCreateContributor(
  cookies: AstroCookies,
  admin: SupabaseClient,
  pseudonym: string | null,
): Promise<Contributor> {
  const existing = cookies.get(COOKIE)?.value;
  if (existing) {
    return { id: existing, provisional: true };
  }

  const { data, error } = await admin
    .from('contributors')
    .insert({ pseudonym: pseudonym?.trim() || null })
    .select('id')
    .single();
  if (error) throw error;

  // httpOnly so client JS can't read it; SameSite=Lax; long-lived pseudonymous id.
  cookies.set(COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { id: data.id, provisional: true };
}

// --- the seam the rest of the app calls -------------------------------------

/**
 * Resolve who is contributing, or why they can't. Precedence:
 *   1. a verified Keycloak app session  → that contributor;
 *   2. Keycloak configured but no session → 'need_signin' (must sign in);
 *   3. provisional explicitly enabled     → a provisional cookie contributor;
 *   4. otherwise                           → 'disabled'.
 * This is the single place a write endpoint asks "may this write proceed?".
 */
export async function resolveContributor(
  cookies: AstroCookies,
  admin: SupabaseClient,
  opts: { pseudonym: string | null },
): Promise<{ contributor: Contributor } | { gate: ContributionGate }> {
  const current = await getCurrentContributor(cookies, admin);
  if (current) return { contributor: current };

  if (keycloakConfigured()) return { gate: 'need_signin' };

  if (provisionalContributionsAllowed()) {
    return { contributor: await getOrCreateContributor(cookies, admin, opts.pseudonym) };
  }
  return { gate: 'disabled' };
}

/** The contributor whose data the account/data-rights pages may manage. */
export interface AccountContributor {
  id: string;
  provisional: boolean;
  pseudonym: string | null;
}

/**
 * Resolve the contributor whose DATA this browser can manage (the /account
 * data-rights pages) — WITHOUT ever creating one. A verified session wins; the
 * provisional cookie counts only when the provisional stand-in is enabled AND
 * its contributor row still exists. After a deletion the stale cookie must
 * honestly resolve to "nothing held", never resurrect a record (§6).
 */
export async function getAccountContributor(
  cookies: AstroCookies,
  admin: SupabaseClient,
): Promise<AccountContributor | null> {
  const sessionId = await verifySession(admin, cookies.get(SESSION_COOKIE)?.value);
  const provisionalId =
    !sessionId && !keycloakConfigured() && provisionalContributionsAllowed()
      ? (cookies.get(COOKIE)?.value ?? null)
      : null;
  const id = sessionId ?? provisionalId;
  if (!id) return null;

  const { data, error } = await admin
    .from('contributors')
    .select('id, pseudonym')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    provisional: !sessionId,
    pseudonym: (data.pseudonym as string | null) ?? null,
  };
}

/** What the contribute PAGES need to render the right sign-in affordance. */
export async function contributionAccess(
  cookies: AstroCookies,
  admin: SupabaseClient | null,
): Promise<ContributionAccess> {
  if (keycloakConfigured()) {
    const signedIn = admin ? (await getCurrentContributor(cookies, admin)) !== null : false;
    return { mode: 'keycloak', signedIn, gateReason: null };
  }
  if (provisionalContributionsAllowed()) {
    return { mode: 'provisional', signedIn: true, gateReason: null };
  }
  return {
    mode: 'closed',
    signedIn: false,
    gateReason:
      'Contributions are not open yet — the community sign-in (identity provider) is still being set up.',
  };
}
