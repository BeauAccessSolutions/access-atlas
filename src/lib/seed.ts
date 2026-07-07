// Local seed data — mirrors supabase/seed.sql so the site renders with no DB.
// The `computeStatus` function mirrors the attribute_claim_status SQL view (§4):
// keep the two in lockstep. If you change the working validation formula, change
// it in BOTH the migration view and here.
import type {
  AttributeCategory,
  AttributeState,
  AttributeStatus,
  ClaimForConfirm,
  Listing,
} from './types';

interface AttrDef {
  key: string;
  label: string;
  category: AttributeCategory;
  reverifyIntervalDays: number;
  relevantIdentityTag: string | null;
  questionText: string;
  requiresPhoto: boolean;
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
  },
  accessible_restroom: {
    key: 'accessible_restroom',
    label: 'Accessible restroom present',
    category: 'facility_objective',
    reverifyIntervalDays: 365,
    relevantIdentityTag: 'wheelchair_user',
    questionText: 'On your visit, was there a wheelchair-accessible restroom you could use?',
    requiresPhoto: true,
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
  },
};

export const LISTINGS: Listing[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'place',
    name: 'Elmwood Village Cafe',
    summary: 'Neighborhood cafe on Elmwood Ave.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14222',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    kind: 'place',
    name: 'Central Library — Downtown',
    summary: 'Public library, main branch.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14203',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    kind: 'provider',
    name: 'Lakeshore Family Medicine',
    summary: 'Primary care practice.',
    city: 'Buffalo',
    region: 'Erie County',
    postalCode: '14201',
    provider: { disabilityLiterate: true, disabledOwned: false, disabledLed: true },
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
