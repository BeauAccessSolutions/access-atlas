// Data access. One boring interface; two backends. When Supabase is configured
// it reads real Postgres; otherwise it serves the local seed so the skeleton
// runs with no backend. Pages should import ONLY from here, never touch the
// supabase client directly — that keeps the fallback honest and the call sites
// simple (§11: boring, legible code).
import type {
  AttributeDefOption,
  AttributeForReport,
  AttributeStatus,
  ClaimForConfirm,
  EvidencePhoto,
  Listing,
  ListingKind,
} from './types';
import { supabase, isDbConfigured } from './supabase';
import {
  LISTINGS,
  seedStatuses,
  seedClaimForConfirm,
  seedAttributeDefinitions,
  seedAttributeForReport,
} from './seed';

export async function getListings(kind?: ListingKind): Promise<Listing[]> {
  if (!isDbConfigured || !supabase) {
    const all = LISTINGS;
    return kind ? all.filter((l) => l.kind === kind) : all;
  }

  let query = supabase
    .from('listings')
    .select(
      'id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led, created_at, lat, lng, coords_source, provider_profiles(disability_literate)',
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
      'id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led, created_at, lat, lng, coords_source, provider_profiles(disability_literate)',
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

// Public evidence photos for one listing, grouped by claim, newest first (§4:
// the photos ARE the evidence base — this is how pages find them). Reads the
// evidence_photos view (migration 0007), which exposes only photo fields —
// never notes/tags/contributor ids (§6). The seed ships no photos, so the
// no-DB fallback is honestly empty.
export async function getEvidenceForListing(
  listingId: string,
): Promise<Map<string, EvidencePhoto[]>> {
  const byClaim = new Map<string, EvidencePhoto[]>();
  if (!isDbConfigured || !supabase) return byClaim;

  const { data, error } = await supabase
    .from('evidence_photos')
    .select('claim_id, photo_url, photo_thumb_url, photo_alt, agrees, observed_on')
    .eq('listing_id', listingId)
    .order('observed_on', { ascending: false });
  if (error) throw error;

  for (const row of data ?? []) {
    const photo: EvidencePhoto = {
      claimId: row.claim_id,
      photoUrl: row.photo_url,
      photoThumbUrl: row.photo_thumb_url ?? null,
      photoAlt: row.photo_alt ?? null,
      agrees: !!row.agrees,
      observedOn: row.observed_on,
    };
    const list = byClaim.get(photo.claimId);
    if (list) list.push(photo);
    else byClaim.set(photo.claimId, [photo]);
  }
  return byClaim;
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

// Everything the first-report form needs: the listing + one attribute's
// structured question, for a (listing, attribute) pair that may have NO claim
// yet (§4 — the entry point for listings nobody has reported on). Returns null
// when either half is missing or the attribute doesn't apply to the listing's
// kind. If a claim already exists, its id is surfaced so callers route to the
// canonical per-claim confirm flow instead of duplicating it.
export async function getAttributeForReport(
  listingId: string,
  attributeKey: string,
): Promise<AttributeForReport | null> {
  if (!isDbConfigured || !supabase) return seedAttributeForReport(listingId, attributeKey);

  const [listingRes, defRes] = await Promise.all([
    supabase.from('listings').select('id, name, kind').eq('id', listingId).maybeSingle(),
    supabase
      .from('attribute_definitions')
      .select('id, key, label, question_text, requires_photo, relevant_identity_tag, applies_to_kind')
      .eq('key', attributeKey)
      .maybeSingle(),
  ]);
  if (listingRes.error) throw listingRes.error;
  if (defRes.error) throw defRes.error;
  const listing = listingRes.data;
  const def = defRes.data;
  if (!listing || !def) return null;
  if (def.applies_to_kind !== null && def.applies_to_kind !== listing.kind) return null;

  const claimRes = await supabase
    .from('attribute_claims')
    .select('id')
    .eq('listing_id', listingId)
    .eq('attribute_def_id', def.id)
    .maybeSingle();
  if (claimRes.error) throw claimRes.error;

  return {
    listingId: listing.id,
    listingName: listing.name,
    listingKind: listing.kind,
    attributeDefId: def.id,
    attributeKey: def.key,
    attributeLabel: def.label,
    questionText: def.question_text,
    requiresPhoto: !!def.requires_photo,
    relevantIdentityTag: def.relevant_identity_tag ?? null,
    existingClaimId: claimRes.data?.id ?? null,
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
    createdAt: row.created_at ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    coordsSource: row.coords_source ?? null,
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
