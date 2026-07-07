// Data access. One boring interface; two backends. When Supabase is configured
// it reads real Postgres; otherwise it serves the local seed so the skeleton
// runs with no backend. Pages should import ONLY from here, never touch the
// supabase client directly — that keeps the fallback honest and the call sites
// simple (§11: boring, legible code).
import type { AttributeStatus, Listing, ListingKind } from './types';
import { supabase, isDbConfigured } from './supabase';
import { LISTINGS, seedStatuses } from './seed';

export async function getListings(kind?: ListingKind): Promise<Listing[]> {
  if (!isDbConfigured || !supabase) {
    const all = LISTINGS;
    return kind ? all.filter((l) => l.kind === kind) : all;
  }

  let query = supabase
    .from('listings')
    .select(
      'id, kind, name, summary, city, region, postal_code, provider_profiles(disability_literate, disabled_owned, disabled_led)',
    )
    .order('name');
  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | null> {
  if (!isDbConfigured || !supabase) {
    return LISTINGS.find((l) => l.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, kind, name, summary, city, region, postal_code, provider_profiles(disability_literate, disabled_owned, disabled_led)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data) : null;
}

export async function getStatusesForListing(
  listingId: string,
  now = new Date(),
): Promise<AttributeStatus[]> {
  if (!isDbConfigured || !supabase) {
    return seedStatuses(now).filter((s) => s.listingId === listingId);
  }
  const { data, error } = await supabase
    .from('attribute_claim_status')
    .select('*')
    .eq('listing_id', listingId);
  if (error) throw error;
  return (data ?? []).map(rowToStatus);
}

// --- row mappers (snake_case DB -> camelCase domain) ------------------------

function rowToListing(row: any): Listing {
  const profile = Array.isArray(row.provider_profiles)
    ? row.provider_profiles[0]
    : row.provider_profiles;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    summary: row.summary ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    postalCode: row.postal_code ?? null,
    provider:
      row.kind === 'provider' && profile
        ? {
            disabilityLiterate: !!profile.disability_literate,
            disabledOwned: !!profile.disabled_owned,
            disabledLed: !!profile.disabled_led,
          }
        : undefined,
  };
}

function rowToStatus(row: any): AttributeStatus {
  return {
    claimId: row.claim_id,
    listingId: row.listing_id,
    attributeKey: row.attribute_key,
    label: row.label,
    category: row.category,
    state: row.state,
    agreeCount: row.agree_count ?? 0,
    dissentCount: row.dissent_count ?? 0,
    weightedAgreeCount: row.weighted_agree_count ?? 0,
    lastConfirmedAt: row.last_confirmed_at ?? null,
    isStale: row.is_stale ?? null,
    sourcedNote: row.sourced_note ?? null,
  };
}
