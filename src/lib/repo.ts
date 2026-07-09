// Data access. One boring interface; two backends. When Supabase is configured
// it reads real Postgres; otherwise it serves the local seed so the skeleton
// runs with no backend. Pages should import ONLY from here, never touch the
// supabase client directly — that keeps the fallback honest and the call sites
// simple (§11: boring, legible code).
import type {
  AttributeDefOption,
  AttributeStatus,
  ClaimForConfirm,
  Listing,
  ListingKind,
} from './types';
import { supabase, isDbConfigured } from './supabase';
import {
  LISTINGS,
  seedStatuses,
  seedClaimForConfirm,
  seedAttributeDefinitions,
} from './seed';

export async function getListings(kind?: ListingKind): Promise<Listing[]> {
  if (!isDbConfigured || !supabase) {
    const all = LISTINGS;
    return kind ? all.filter((l) => l.kind === kind) : all;
  }

  let query = supabase
    .from('listings')
    .select(
      'id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led, provider_profiles(disability_literate)',
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
      'id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led, provider_profiles(disability_literate)',
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

// Attributes a submitter can self-report against, for one listing kind. Reads
// the catalog from the DB when configured, else the seed catalog.
export async function getAttributeDefinitions(kind: ListingKind): Promise<AttributeDefOption[]> {
  if (!isDbConfigured || !supabase) return seedAttributeDefinitions(kind);
  const { data, error } = await supabase
    .from('attribute_definitions')
    .select('key, label, category, applies_to_kind')
    .or(`applies_to_kind.is.null,applies_to_kind.eq.${kind}`)
    .order('key');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    key: r.key,
    label: r.label,
    category: r.category,
    appliesToKind: r.applies_to_kind ?? null,
  }));
}

// A claim plus the attribute's structured question — everything the confirmation
// form needs. Falls back to seed data (read-only) so the form renders with no DB;
// actual writes are separately gated (see the confirmations endpoint).
export async function getClaimForConfirm(claimId: string): Promise<ClaimForConfirm | null> {
  if (!isDbConfigured || !supabase) return seedClaimForConfirm(claimId);
  const { data, error } = await supabase
    .from('attribute_claims')
    .select(
      'id, listing_id, listings(name, kind), attribute_definitions(label, question_text, requires_photo, relevant_identity_tag)',
    )
    .eq('id', claimId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const listing = Array.isArray(data.listings) ? data.listings[0] : data.listings;
  const attr = Array.isArray(data.attribute_definitions)
    ? data.attribute_definitions[0]
    : data.attribute_definitions;
  if (!listing || !attr) return null;

  return {
    claimId: data.id,
    listingId: data.listing_id,
    listingName: listing.name,
    listingKind: listing.kind,
    attributeLabel: attr.label,
    questionText: attr.question_text,
    requiresPhoto: !!attr.requires_photo,
    relevantIdentityTag: attr.relevant_identity_tag ?? null,
  };
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
    category: row.category ?? null,
    disabledOwned: !!row.disabled_owned,
    disabledLed: !!row.disabled_led,
    provider:
      row.kind === 'provider' && profile
        ? { disabilityLiterate: !!profile.disability_literate }
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
