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
