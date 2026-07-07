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
  // Provider-only, self-attested (§6, §12). Absent for places.
  provider?: {
    disabilityLiterate: boolean;
    disabledOwned: boolean;
    disabledLed: boolean;
  };
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
