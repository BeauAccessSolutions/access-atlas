// Shared domain types. These mirror supabase/migrations/0001_init.sql — keep
// them in sync. The validation vocabulary here is the ONLY allowed vocabulary
// (§4); do not introduce "verified"/"high confidence" strings elsewhere.

export type ListingKind = 'provider' | 'place';

// Where a representation claim (§1, §12) came from. Deliberately mirrors §4's
// vocabulary rather than inventing a parallel one:
//   'self_attested' — the owner/org told US. The ONLY value that may render
//                     "self-attested"; the phrase is a claim about who spoke.
//   'sourced'       — backed by a certification, audit, or partner org, named in
//                     Listing.representationNote so a reader can check it.
// The absence of a value (null) is meaningful and must fail safe — see
// presentRepresentation() in labeling.ts and migration 0012.
export type RepresentationSource = 'self_attested' | 'sourced';

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
  // Representation axis (§1, §12). Lives on the listing because a business's
  // ownership/leadership is independent of place-vs-provider — a disabled-owned
  // cafe is a place. Applies to BOTH kinds.
  //
  // The boolean alone is NOT publishable: it says a claim exists, not where it
  // came from, and rendering it as "self-attested" is how production ended up
  // asserting attestations nobody made (migration 0012). Always render via
  // presentRepresentation() in labeling.ts, which returns null when the source
  // is unknown.
  disabledOwned: boolean;
  disabledLed: boolean;
  /** Provenance for disabledOwned. null/undefined = unknown → publish nothing. */
  disabledOwnedSource?: RepresentationSource | null;
  /** Provenance for disabledLed. null/undefined = unknown → publish nothing. */
  disabledLedSource?: RepresentationSource | null;
  /** Plain-language citation backing a `sourced` representation claim (§7). */
  representationNote?: string | null;
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

// Everything the "report a fact we don't track yet" form needs (the first-report
// flow, §4): the listing, the attribute's structured question, and — if a claim
// already exists for this pair — its id, so callers can route to the canonical
// per-claim confirm flow instead of creating a duplicate.
export interface AttributeForReport {
  listingId: string;
  listingName: string;
  listingKind: ListingKind;
  attributeDefId: string;
  attributeKey: string;
  attributeLabel: string;
  questionText: string;
  requiresPhoto: boolean;
  relevantIdentityTag: string | null;
  existingClaimId: string | null;
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
