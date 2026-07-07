// The contributor-identity SEAM. Everything that needs "who is contributing"
// goes through here, so that swapping the provisional mechanism for the platform
// Keycloak IdP (BAS invariant #1, docs/platform-membership.md) is a change to
// THIS file only.
//
// SAFETY / ABUSE NOTE (§6, and platform §1): there is no real authentication yet
// — Keycloak is Phase 0. A cookie-based pseudonym is trivially resettable, so it
// is NOT an anti-abuse control. We therefore HARD-GATE writes: the endpoint only
// accepts contributions when `ALLOW_PROVISIONAL_CONTRIBUTIONS === 'true'`
// (intended for local/preview ONLY — never set it in production). Default off →
// the flow renders but submitting says "not yet enabled". This makes it
// impossible to accidentally ship an unauthenticated write endpoint.
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';

const COOKIE = 'aa_contributor';

export function provisionalContributionsAllowed(): boolean {
  return import.meta.env.ALLOW_PROVISIONAL_CONTRIBUTIONS === 'true';
}

/** Why contributions are (not) open — surfaced to the UI honestly. */
export function contributionGateReason(): string | null {
  if (provisionalContributionsAllowed()) return null;
  return 'Contributions are not open yet — the community sign-in (identity provider) is still being set up.';
}

export interface Contributor {
  id: string;
  provisional: boolean;
}

// Resolve the current contributor, creating a provisional pseudonymous record on
// first contribution. When Keycloak lands, this reads the verified session and
// keys the contributor by the IdP `sub` instead of a cookie.
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
