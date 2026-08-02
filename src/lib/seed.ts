// Local seed data — mirrors supabase/seed.sql so the site renders with no DB.
// The `computeStatus` function mirrors the attribute_claim_status SQL view (§4):
// keep the two in lockstep. If you change the working validation formula, change
// it in BOTH the migration view and here.
import type {
  AttributeCategory,
  AttributeDefOption,
  AttributeForReport,
  AttributeState,
  AttributeStatus,
  ClaimForConfirm,
  Listing,
  ListingKind,
} from './types';

interface AttrDef {
  key: string;
  label: string;
  category: AttributeCategory;
  reverifyIntervalDays: number;
  relevantIdentityTag: string | null;
  questionText: string;
  requiresPhoto: boolean;
  appliesToKind: ListingKind | null; // null = both places and providers
}

interface Confirmation {
  agrees: boolean;
  tags: string[];
  createdAt: string; // ISO
}

interface Claim {
  id: string;
  listingId: string;
  attr: AttrDef;
  sourced?: boolean;
  sourcedNote?: string;
  confirmations: Confirmation[];
}

const ATTR: Record<string, AttrDef> = {
  entrance_step_free: {
    key: 'entrance_step_free',
    label: 'Step-free entrance',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText: 'On your visit, could you enter with zero steps (level or ramped)?',
    requiresPhoto: true,
    appliesToKind: null,
  },
  accessible_restroom: {
    key: 'accessible_restroom',
    label: 'Accessible restroom present',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText: 'On your visit, was there a wheelchair-accessible restroom you could use?',
    requiresPhoto: true,
    appliesToKind: null,
  },
  accessible_parking: {
    key: 'accessible_parking',
    label: 'Accessible parking',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText: 'On your visit, was there designated accessible parking that was usable?',
    requiresPhoto: true,
    // Both kinds (§8b lists provider parking as objective too — Gap B).
    appliesToKind: null,
  },
  height_adjustable_exam_table: {
    key: 'height_adjustable_exam_table',
    label: 'Height-adjustable exam table',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText:
      'On your visit, did the provider have a height-adjustable / low-transfer exam table?',
    requiresPhoto: true,
    appliesToKind: 'provider',
  },
  accessible_scale: {
    key: 'accessible_scale',
    label: 'Wheelchair-accessible scale',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText:
      'On your visit, was there a weight scale you could use as a wheelchair user (roll-on / seated)?',
    requiresPhoto: true,
    // Core ADA MDE attribute (§8). No public registry -> zero seed claims by
    // design; a recruitment/first-person target (Gap C).
    appliesToKind: 'provider',
  },
  communicated_directly: {
    key: 'communicated_directly',
    label: 'Communicated directly with me',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: null,
    questionText: 'On your visit, did staff speak directly to you (not only to a companion)?',
    requiresPhoto: false,
    appliesToKind: 'provider',
  },
  staff_knew_equipment: {
    key: 'staff_knew_equipment',
    label: 'Staff knew how to use accessible equipment',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText: 'On your visit, did staff know how to use their accessible equipment?',
    requiresPhoto: false,
    appliesToKind: 'provider',
  },

  // ---- Multi-disability rows (migration 0013) -------------------------------
  // Everything above weights `wheelchair_user` (or nobody), while
  // src/lib/identity-tags.ts offers five tags — so four of the five weighted
  // nothing at all and those contributors were second-class in the §4 consensus
  // math. Rationale, wording caveat and the single-tag limitation are documented
  // in supabase/migrations/0013_attribute_catalog_multi_disability.sql.
  interpreter_on_request: {
    key: 'interpreter_on_request',
    label: 'ASL interpreter arranged on request',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'deaf_hoh',
    questionText:
      'On your visit, did the provider arrange an ASL interpreter when you asked for one?',
    requiresPhoto: false,
    appliesToKind: 'provider',
  },
  staff_communicate_in_writing: {
    key: 'staff_communicate_in_writing',
    label: 'Staff will communicate in writing',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'deaf_hoh',
    questionText:
      'On your visit, were staff willing to communicate in writing (notes, or typing on a phone or tablet)?',
    requiresPhoto: false,
    appliesToKind: null,
  },
  captions_on_screens: {
    key: 'captions_on_screens',
    label: 'Captions turned on for video screens',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'deaf_hoh',
    questionText: 'On your visit, were the video screens showing captions?',
    requiresPhoto: true,
    appliesToKind: null,
  },
  service_animal_welcomed: {
    key: 'service_animal_welcomed',
    label: 'Service animal welcomed',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'blind_low_vision',
    questionText:
      'On your visit, was your service animal welcomed without being questioned or refused entry?',
    requiresPhoto: false,
    appliesToKind: null,
  },
  staff_read_aloud: {
    key: 'staff_read_aloud',
    label: 'Staff read printed information aloud',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'blind_low_vision',
    questionText: 'On your visit, did staff read the menu, forms, or signage aloud when you asked?',
    requiresPhoto: false,
    appliesToKind: null,
  },
  quiet_waiting_space: {
    key: 'quiet_waiting_space',
    label: 'Quieter space to wait',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'neurodivergent',
    questionText:
      'On your visit, was there a quieter area, away from noise and crowds, where you could wait?',
    requiresPhoto: true,
    appliesToKind: null,
  },
  plain_language_help: {
    key: 'plain_language_help',
    label: 'Staff explained things in plain language',
    category: 'provider_behavior',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'cognitive_access',
    questionText:
      'On your visit, did staff explain things in plain language and help you with forms when you asked?',
    requiresPhoto: false,
    appliesToKind: null,
  },
  seating_available: {
    key: 'seating_available',
    label: 'Seating available while waiting',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    // null: seating blocks chronic-illness / fatigue / ambulatory-disabled
    // visitors, who the coarse tag list does not name. Privilege nobody rather
    // than mislabel them (same semantics as 'communicated_directly').
    relevantIdentityTag: null,
    questionText: 'On your visit, was there somewhere to sit while you waited?',
    requiresPhoto: true,
    appliesToKind: null,
  },
};

// The attribute catalog a submitter can self-report against, filtered by kind
// (null appliesToKind = both). Mirrors supabase/seed.sql's attribute_definitions.
/**
 * attribute key -> the reviewer identity tag it weights (§4), or null.
 *
 * Exported so a test can hold the line on the inequity migration 0013 fixed: if
 * a tag is offered on the visit-report form but no attribute weights it, that
 * contributor's lived experience counts for nothing in the consensus math.
 * Also backs the supabase/seed.sql parity check (the catalog has two mirrors).
 */
export function seedAttributeIdentityTags(): Record<string, string | null> {
  return Object.fromEntries(Object.values(ATTR).map((a) => [a.key, a.relevantIdentityTag]));
}

export function seedAttributeDefinitions(kind: ListingKind): AttributeDefOption[] {
  return Object.values(ATTR)
    .filter((a) => a.appliesToKind === null || a.appliesToKind === kind)
    .map((a) => ({
      key: a.key,
      label: a.label,
      category: a.category,
      appliesToKind: a.appliesToKind,
    }));
}

export const LISTINGS: Listing[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'place',
    name: 'Elmwood Village Cafe',
    summary: 'Neighborhood cafe on Elmwood Ave.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14222',
    category: 'business',
    disabledOwned: false,
    disabledLed: false,
    // Approximate Buffalo coords (see supabase/seed.sql) — demo the distance sort.
    lat: 42.918,
    lng: -78.8784,
    coordsSource: 'approximate',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    kind: 'place',
    name: 'Central Library — Downtown',
    summary: 'Public library, main branch.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14203',
    category: 'library',
    disabledOwned: false,
    disabledLed: false,
    lat: 42.8867,
    lng: -78.8739,
    coordsSource: 'approximate',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    kind: 'provider',
    name: 'Lakeshore Family Medicine',
    summary: 'Primary care practice.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14201',
    category: 'healthcare',
    disabledOwned: false,
    disabledLed: true,
    // Provenance travels WITH the flag (§4; migration 0012). A demo row exercises
    // the `sourced` branch so the fallback renders what real data will.
    disabledLedSource: 'sourced',
    representationNote:
      'its designation as a Center for Independent Living, where consumer control — 51% or more of staff and board being disabled people — is a condition of the designation',
    provider: { disabilityLiterate: true },
    lat: 42.901,
    lng: -78.876,
    coordsSource: 'approximate',
  },
  // Deliberately CLAIMLESS (zero attribute claims): exercises the "no facts
  // reported yet — be the first" entry into the report flow, which is the
  // dominant real-data case (§4). Keep it claimless.
  {
    id: '44444444-4444-4444-4444-444444444444',
    kind: 'place',
    name: 'Example Test Place — claimless fixture',
    summary:
      'Not a real business. A test fixture with no accessibility reports, used to exercise the "be the first to report" flow.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14213',
    category: 'business',
    disabledOwned: true,
    // Deliberately left WITHOUT a source: exercises the fail-safe path, where a
    // claimed flag with unknown provenance must render nothing at all.
    disabledOwnedSource: null,
    disabledLed: false,
    lat: 42.916,
    lng: -78.895,
    coordsSource: 'approximate',
  },
];

const CLAIMS: Claim[] = [
  // community_verified: 3 agreeing, one wheelchair user
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    listingId: '11111111-1111-1111-1111-111111111111',
    attr: ATTR.entrance_step_free,
    confirmations: [
      { agrees: true, tags: ['wheelchair_user'], createdAt: '2026-05-01' },
      { agrees: true, tags: [], createdAt: '2026-05-10' },
      { agrees: true, tags: [], createdAt: '2026-06-01' },
    ],
  },
  // community_confirmations: 2 agreeing (below the >=3 bar)
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    listingId: '11111111-1111-1111-1111-111111111111',
    attr: ATTR.accessible_restroom,
    confirmations: [
      { agrees: true, tags: ['wheelchair_user'], createdAt: '2026-05-01' },
      { agrees: true, tags: [], createdAt: '2026-05-20' },
    ],
  },
  // disputed: a credible dissent freezes it
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    listingId: '22222222-2222-2222-2222-222222222222',
    attr: ATTR.entrance_step_free,
    confirmations: [
      { agrees: true, tags: [], createdAt: '2026-04-01' },
      { agrees: false, tags: ['wheelchair_user'], createdAt: '2026-06-15' },
    ],
  },
  // sourced: partner audit
  {
    id: 'c4444444-4444-4444-4444-444444444444',
    listingId: '22222222-2222-2222-2222-222222222222',
    attr: ATTR.accessible_restroom,
    sourced: true,
    sourcedNote: 'Erie County facilities ADA audit, 2026',
    confirmations: [],
  },
  // self_reported: zero confirmations
  {
    id: 'c5555555-5555-5555-5555-555555555555',
    listingId: '33333333-3333-3333-3333-333333333333',
    attr: ATTR.height_adjustable_exam_table,
    confirmations: [],
  },
];

// Read-only claim details for the confirmation form, from seed (no DB). Writes
// still require a real DB + the contribution gate — this only renders the form.
export function seedClaimForConfirm(claimId: string): ClaimForConfirm | null {
  const claim = CLAIMS.find((c) => c.id === claimId);
  if (!claim) return null;
  const listing = LISTINGS.find((l) => l.id === claim.listingId);
  if (!listing) return null;
  return {
    claimId: claim.id,
    listingId: claim.listingId,
    listingName: listing.name,
    listingKind: listing.kind,
    attributeLabel: claim.attr.label,
    questionText: claim.attr.questionText,
    requiresPhoto: claim.attr.requiresPhoto,
    relevantIdentityTag: claim.attr.relevantIdentityTag,
  };
}

// Read-only details for the first-report form (report a fact that has no claim
// yet), from seed (no DB). Mirrors repo.getAttributeForReport: validates the
// attribute applies to the listing's kind and surfaces an existing claim id so
// the caller can route to the canonical confirm flow instead. The seed has no
// def uuids, so the key stands in — writes are separately gated on a real DB.
export function seedAttributeForReport(
  listingId: string,
  attributeKey: string,
): AttributeForReport | null {
  const listing = LISTINGS.find((l) => l.id === listingId);
  const attr = ATTR[attributeKey];
  if (!listing || !attr) return null;
  if (attr.appliesToKind !== null && attr.appliesToKind !== listing.kind) return null;
  const existing = CLAIMS.find(
    (c) => c.listingId === listingId && c.attr.key === attributeKey,
  );
  return {
    listingId: listing.id,
    listingName: listing.name,
    listingKind: listing.kind,
    attributeDefId: attr.key,
    attributeKey: attr.key,
    attributeLabel: attr.label,
    questionText: attr.questionText,
    requiresPhoto: attr.requiresPhoto,
    relevantIdentityTag: attr.relevantIdentityTag,
    existingClaimId: existing?.id ?? null,
  };
}

// Mirrors the SQL view's derived state (§4). Precedence: dissent > sourced >
// verified (>=3 agree, +1 weighted if a tag is privileged) > confirmations > self.
function computeStatus(claim: Claim): AttributeState {
  const agree = claim.confirmations.filter((c) => c.agrees);
  const dissent = claim.confirmations.filter((c) => !c.agrees);
  if (dissent.length > 0) return 'disputed';
  if (claim.sourced) return 'sourced';
  const tag = claim.attr.relevantIdentityTag;
  const weighted = tag ? agree.filter((c) => c.tags.includes(tag)).length : 0;
  if (agree.length >= 3 && (tag === null || weighted >= 1)) return 'community_verified';
  if (agree.length >= 1) return 'community_confirmations';
  return 'self_reported';
}

function lastConfirmedAt(claim: Claim): string | null {
  const dates = claim.confirmations.filter((c) => c.agrees).map((c) => c.createdAt);
  return dates.length ? dates.sort().at(-1)! : null;
}

// Note: staleness compares to "now". We intentionally do NOT compute it here
// against a frozen date — the repo layer stamps it so seed and DB behave alike.
export function seedStatuses(now: Date): AttributeStatus[] {
  return CLAIMS.map((claim) => {
    const agree = claim.confirmations.filter((c) => c.agrees);
    const last = lastConfirmedAt(claim);
    const tag = claim.attr.relevantIdentityTag;
    const isStale =
      last === null
        ? null
        : new Date(last).getTime() <
          now.getTime() - claim.attr.reverifyIntervalDays * 24 * 60 * 60 * 1000;
    return {
      claimId: claim.id,
      listingId: claim.listingId,
      attributeKey: claim.attr.key,
      label: claim.attr.label,
      category: claim.attr.category,
      state: computeStatus(claim),
      agreeCount: agree.length,
      dissentCount: claim.confirmations.length - agree.length,
      weightedAgreeCount: tag ? agree.filter((c) => c.tags.includes(tag)).length : 0,
      lastConfirmedAt: last,
      isStale,
      sourcedNote: claim.sourcedNote ?? null,
    };
  });
}
