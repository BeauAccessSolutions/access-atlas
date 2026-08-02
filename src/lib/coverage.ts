// Provider coverage: the blockers that fire BEFORE accessibility (migration
// 0014). Whether a practice is taking new patients, and whether they take
// Medicaid / Medicare.
//
// These are NOT §4 attributes. No claims, no confirmations, no
// `community_verified`, no consensus formula. They are attested facts with a
// date on them, and everything here exists to make sure we never say more than
// that. The failure mode is specific and expensive: tell someone a practice
// takes their Medicaid, they travel there, and they are turned away at the desk
// or billed. So the presenter below is fail-safe in the same way
// presentRepresentation is (migration 0012) — no value, no source, or no date
// publishes NOTHING.
import type { CoverageSource, ProviderCoverage } from './types';

/**
 * How long a coverage fact stays presentable before we flag it as stale.
 *
 * 180 days — deliberately HALF the 365-day attribute re-verification cadence
 * (§13). Physical facts decay when something breaks; coverage decays on a
 * business cycle: plan years turn over annually and a panel can close in a
 * month. A year-old "accepting new patients" is not evidence about today.
 */
export const COVERAGE_STALE_DAYS = 180;

export type CoverageKey = 'acceptingNewPatients' | 'acceptsMedicaid' | 'acceptsMedicare';

export interface CoveragePresentation {
  key: CoverageKey;
  /** e.g. "Accepting new patients" / "Not accepting new patients". */
  text: string;
  /** true = the good-news reading, false = the blocking reading. */
  value: boolean;
  /** Where it came from, in plain words. */
  provenance: string;
  /** ISO date (YYYY-MM-DD) this was last confirmed with the practice. */
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
};

/** Days between an ISO date and `now`. Negative for future dates. */
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
 * What may be published for one coverage fact — or null.
 *
 * FAIL-SAFE, in this order:
 *   * value is null/undefined  -> nobody asked. Publish nothing.
 *   * no source                -> we can't say where it came from. Publish nothing.
 *   * no / unparseable date    -> an undated coverage claim is exactly the
 *                                 unverifiable trust claim §14 forbids. Publish
 *                                 nothing.
 *   * a FUTURE date            -> corrupt data; refuse rather than render a fact
 *                                 confirmed tomorrow.
 *
 * Do NOT add a "helpful" fallback to any of these branches. The fallback is the
 * bug (migration 0012).
 */
export function presentCoverage(
  key: CoverageKey,
  coverage: ProviderCoverage | null | undefined,
  now = new Date(),
): CoveragePresentation | null {
  if (!coverage) return null;
  const value = coverage[key];
  if (value === null || value === undefined) return null;
  if (!coverage.source) return null;
  if (!coverage.asOf) return null;

  const age = daysSince(coverage.asOf, now);
  if (Number.isNaN(age) || age < 0) return null;

  return {
    key,
    text: value ? COPY[key].yes : COPY[key].no,
    value,
    provenance: provenanceText(coverage.source, coverage.note),
    asOf: coverage.asOf.slice(0, 10),
    isStale: age > COVERAGE_STALE_DAYS,
  };
}

/** Everything publishable for a provider, in the order a visitor needs it. */
export function presentAllCoverage(
  coverage: ProviderCoverage | null | undefined,
  now = new Date(),
): CoveragePresentation[] {
  // Panel status first: it gates everything else. No point knowing they take
  // your Medicaid if they aren't taking anyone.
  const order: CoverageKey[] = ['acceptingNewPatients', 'acceptsMedicaid', 'acceptsMedicare'];
  return order
    .map((key) => presentCoverage(key, coverage, now))
    .filter((p): p is CoveragePresentation => p !== null);
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
