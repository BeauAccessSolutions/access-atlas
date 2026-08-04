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
 * How long each coverage fact stays presentable before we flag it as stale.
 *
 * PER FACT, not one number, because these decay at genuinely different rates
 * and a single window was wrong in both directions at once:
 *
 *   * `acceptingNewPatients` — 90 days. The fastest-moving and the most
 *     trip-wasting: a panel can close in a month. A five-month-old "accepting
 *     new patients" was being published with no warning at all.
 *   * `acceptsMedicaid` / `acceptsMedicare` — 180 days. These move on a
 *     contract cycle; plan years turn over annually, and mid-year network
 *     changes happen but are not monthly.
 *   * `offersTelehealth` — 365 days. A service line, not a cycle. A practice
 *     offering telehealth in March is almost certainly still offering it in
 *     December, and warning "this is old" about a stable fact trains people to
 *     ignore the warning where it actually matters.
 *
 * The attribute side keeps its interval in the DB (`reverify_interval_days`,
 * per row) because attributes are extensible data. Coverage fact keys are a
 * FIXED app-side vocabulary (migration 0017), and this is presentation policy
 * that will be tuned, so it lives here — guarded by a test that it covers
 * exactly the key vocabulary.
 *
 * Still a judgement, not evidence: nobody has watched real coverage data decay
 * yet. Tune once there is a calling campaign's worth of history.
 */
export const COVERAGE_STALE_DAYS: Record<CoverageKey, number> = {
  acceptingNewPatients: 90,
  acceptsMedicaid: 180,
  acceptsMedicare: 180,
  offersTelehealth: 365,
};

/**
 * The staleness window in words, e.g. "three months".
 *
 * Exists so the warning copy is DERIVED from the actual window. It used to be
 * hardcoded as "over six months old" in two separate files, which meant any
 * change to the number silently made the sentence a lie.
 */
export function stalenessWindowPhrase(key: CoverageKey): string {
  const days = COVERAGE_STALE_DAYS[key];
  if (days >= 365) return 'a year';
  const months = Math.round(days / 30);
  const WORDS: Record<number, string> = { 1: 'a month', 2: 'two months', 3: 'three months', 6: 'six months', 9: 'nine months' };
  return WORDS[months] ?? `${months} months`;
}

/** Is this fact past its own window? Shared by the presenter and the call sheet. */
export function isCoverageStale(key: CoverageKey, asOf: string, now = new Date()): boolean {
  const age = daysSince(asOf, now);
  return !Number.isNaN(age) && age > COVERAGE_STALE_DAYS[key];
}

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
  /** Past this fact's own window — render the re-check warning. */
  isStale: boolean;
  /** The window in words ("three months"), so copy can't drift from the number. */
  staleAfter: string;
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
    isStale: age > COVERAGE_STALE_DAYS[key],
    staleAfter: stalenessWindowPhrase(key),
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
