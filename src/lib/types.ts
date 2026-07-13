// Shared domain types. These mirror supabase/migrations/0001_init.sql — keep
// them in sync. The validation vocabulary here is the ONLY allowed vocabulary
// (§4); do not introduce "verified"/"high confidence" strings elsewhere.

export type ListingKind = 'provider' | 'place';

export type AttributeCategory =
  | 'facility_objective'
  | 'provider_behavior'
  | 'provider_self_attested';

// The only allowed labeling states (§4). UI strings live in labeling.ts.
export type AttributeState =
  | 'self_reported'
  | 'community_confirmations'
  | 'community_verified'
  | 'sourced'
  | 'disputed';

export interface Listing {
  id: string;
  kind: ListingKind;
  name: string;
  summary: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  // Coarse scannability category (src/lib/categories.ts). Not part of validation
  // (§4). May be null.
  category: string | null;
  // Representation axis (§1, §12), self-attested. Lives on the listing because a
  // business's ownership/leadership is independent of place-vs-provider — a
  // disabled-owned cafe is a place. Applies to BOTH kinds.
  disabledOwned: boolean;
  disabledLed: boolean;
  // Provider-only competence (§8), self-attested. Absent for places.
  provider?: {
    disabilityLiterate: boolean;
  };
  // When the listing was submitted (ISO). Drives the "recently added" sort so
  // fresh community submissions are discoverable. May be null (seed rows).
  createdAt?: string | null;
  // Coarse coordinates (§5: the map is a progressive enhancement over the list).
  // Optional — most listings have none. Used ONLY by the client "sort by
  // distance" enhancement, which computes distance on-device (§6). Shipped to the
  // browser as card data attributes; the server never receives a visitor's coords.
  lat?: number | null;
  lng?: number | null;
  // How the coordinates were set (§4 honesty): 'exact' = contributor-entered,
  // 'approximate' = derived from the ZIP centroid. null = no coordinates.
  coordsSource?: 'exact' | 'approximate' | null;
}

// One selectable attribute in the submission form (filtered by listing kind).
export interface AttributeDefOption {
  key: string;
  label: string;
  category: AttributeCategory;
  appliesToKind: ListingKind | null;
}

// A claim plus its attribute's structured question — everything the confirmation
// form needs to render.
export interface ClaimForConfirm {
  claimId: string;
  listingId: string;
  listingName: string;
  listingKind: ListingKind;
  attributeLabel: string;
  questionText: string;
  requiresPhoto: boolean;
  relevantIdentityTag: string | null;
}

// One public evidence photo (the evidence_photos view, migration 0007). This is
// the ONLY shape photo evidence reaches pages in — photo fields plus a coarse
// date and the agree/dissent flag, never notes/tags/contributor ids (§6).
export interface EvidencePhoto {
  claimId: string;
  photoUrl: string;
  photoThumbUrl: string | null;
  // Contributor-written description — required at upload, so only legacy/null
  // rows can miss it. Render as the img alt.
  photoAlt: string | null;
  // false = this photo documents a PROBLEM (dissent) — label it honestly (§4).
  agrees: boolean;
  // yyyy-mm-dd (date, not timestamp — §6).
  observedOn: string;
}

// One row of attribute_claim_status — a single, separately-labeled claim (§4).
export interface AttributeStatus {
  claimId: string;
  listingId: string;
  attributeKey: string;
  label: string;
  category: AttributeCategory;
  state: AttributeState;
  agreeCount: number;
  dissentCount: number;
  weightedAgreeCount: number;
  lastConfirmedAt: string | null;
  isStale: boolean | null;
  sourcedNote?: string | null;
}
