// Provider coverage: the blockers that fire BEFORE accessibility (migrations
// 0014-0017). Whether a practice is taking new patients, whether they take
// Medicaid / Medicare, and whether they offer telehealth.
//
// These are NOT §4 attributes. No claims, no confirmations, no
// `community_verified`, no consensus formula. They are attested facts with a
// date on them, and the failure mode is specific and expensive: tell someone a
// practice takes their Medicaid, they travel there, and they are turned away at
// the desk or billed.
//
// WHAT CHANGED IN 0017, and why this file got shorter. Coverage used to be
// three-valued booleans plus ONE shared source/date for the whole provider, so
// the presenter carried a four-branch fail-safe refusing to publish anything
// missing a piece — and a partial update could still relabel facts nobody
// re-confirmed. Now each fact is its own row with NOT NULL source and as_of, so
// **a fact that cannot be published cannot be stored**. The fail-safe lives in
// the schema. What remains here is presentation, plus one belt-and-braces date
// check: degrading to silence beats degrading to a claim.
import type { CoverageFact, CoverageKey, CoverageSource, ProviderCoverage } from './types';

/**
 * How long a coverage fact stays presentable before we flag it as stale.
 *
 * 180 days — deliberately HALF the 365-day attribute re-verification cadence
 * (§13). Physical facts decay when something breaks; coverage decays on a
 * business cycle: plan years turn over annually and a panel can close in a
 * month. A year-old "accepting new patients" is not evidence about today.
 */
export const COVERAGE_STALE_DAYS = 180;

export type { CoverageKey };

/** App camelCase key -> the snake_case key stored in provider_coverage_facts. */
export const COVERAGE_DB_KEYS: Record<CoverageKey, string> = {
  acceptingNewPatients: 'accepting_new_patients',
  acceptsMedicaid: 'accepts_medicaid',
  acceptsMedicare: 'accepts_medicare',
  offersTelehealth: 'offers_telehealth',
};

/** The reverse map, for reading rows back. */
export const COVERAGE_KEY_BY_DB = Object.fromEntries(
  Object.entries(COVERAGE_DB_KEYS).map(([k, v]) => [v, k as CoverageKey]),
) as Record<string, CoverageKey>;

export function isCoverageKey(key: unknown): key is CoverageKey {
  return typeof key === 'string' && key in COVERAGE_DB_KEYS;
}

/** The order a visitor needs these in — see presentAllCoverage. */
export const COVERAGE_ORDER: CoverageKey[] = [
  'acceptingNewPatients',
  'acceptsMedicaid',
  'acceptsMedicare',
  'offersTelehealth',
];

export interface CoveragePresentation {
  key: CoverageKey;
  /** e.g. "Accepting new patients" / "Not accepting new patients". */
  text: string;
  /** true = the good-news reading, false = the blocking reading. */
  value: boolean;
  /** Where it came from, in plain words. */
  provenance: string;
  /** ISO date (YYYY-MM-DD) this fact was last confirmed with the practice. */
  asOf: string;
  /** Past COVERAGE_STALE_DAYS — render the re-check warning. */
  isStale: boolean;
}

const COPY: Record<CoverageKey, { yes: string; no: string }> = {
  acceptingNewPatients: {
    yes: 'Accepting new patients',
    // Stated plainly. A closed panel is the single most trip-saving fact here,
    // so it is never softened into "limited availability".
    no: 'Not accepting new patients',
  },
  acceptsMedicaid: { yes: 'Accepts Medicaid', no: 'Does not accept Medicaid' },
  acceptsMedicare: { yes: 'Accepts Medicare', no: 'Does not accept Medicare' },
  offersTelehealth: {
    yes: 'Offers telehealth appointments',
    // The one fact where `false` is NOT a blocker — it is an absent
    // alternative, not a closed door. Say that, rather than dressing it up as
    // bad news ("does not offer telehealth" reads as a failing; it isn't one).
    no: 'In-person appointments only',
  },
};

/** Days between an ISO date and `now`. NaN if unparseable. */
function daysSince(isoDate: string, now: Date): number {
  const then = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.NaN;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

function provenanceText(source: CoverageSource, note: string | null | undefined): string {
  const cite = note?.trim();
  if (source === 'sourced') {
    return cite
      ? `From: ${cite}. Not confirmed with the practice directly.`
      : 'From a published directory or partner organization. Not confirmed with the practice directly.';
  }
  return 'The practice told us this themselves.';
}

/**
 * What may be published for one coverage fact — or null when we hold none.
 *
 * The schema guarantees a stored fact has a source and a date (0017), so the
 * only refusals left are structural: no fact at all, or a date that is corrupt
 * or in the future.
 */
export function presentCoverage(
  key: CoverageKey,
  coverage: ProviderCoverage | null | undefined,
  now = new Date(),
): CoveragePresentation | null {
  const fact: CoverageFact | undefined = coverage?.[key];
  if (!fact) return null;

  const age = daysSince(fact.asOf, now);
  if (Number.isNaN(age) || age < 0) return null;

  return {
    key,
    text: fact.value ? COPY[key].yes : COPY[key].no,
    value: fact.value,
    provenance: provenanceText(fact.source, fact.note),
    asOf: fact.asOf.slice(0, 10),
    isStale: age > COVERAGE_STALE_DAYS,
  };
}

/** Everything publishable for a provider, in the order a visitor needs it. */
export function presentAllCoverage(
  coverage: ProviderCoverage | null | undefined,
  now = new Date(),
): CoveragePresentation[] {
  // Panel status first: it gates everything else. No point knowing they take
  // your Medicaid if they aren't taking anyone. Telehealth LAST — the three
  // before it decide whether you can be seen at all; this only decides whether
  // you have to travel.
  return COVERAGE_ORDER.map((key) => presentCoverage(key, coverage, now)).filter(
    (p): p is CoveragePresentation => p !== null,
  );
}

/**
 * Does this provider match a coverage filter?
 *
 * Only a PUBLISHABLE `true` matches. Unknown never matches: a filter that
 * silently included "we don't know" would turn a browse into a wasted trip,
 * which is the whole thing this feature exists to prevent. Stale-but-true still
 * matches — it is real information — and every surface renders the date, so the
 * visitor sees how old it is.
 */
export function coverageMatches(
  key: CoverageKey,
  coverage: ProviderCoverage | null | undefined,
  now = new Date(),
): boolean {
  return presentCoverage(key, coverage, now)?.value === true;
}
