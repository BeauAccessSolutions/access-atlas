// Provider coverage (migration 0014) — the blockers that fire BEFORE
// accessibility.
//
// The failure mode these guard is specific and expensive: tell someone a
// practice takes their Medicaid, they travel there, and they are turned away at
// the desk or billed. So most of this file is about what we must REFUSE to
// publish, not what we render.
import { describe, it, expect } from 'vitest';
import {
  COVERAGE_STALE_DAYS,
  coverageMatches,
  presentAllCoverage,
  presentCoverage,
} from '../../src/lib/coverage';
import { buildCoverageQuestions } from '../../src/lib/call-ahead';
import { applyListingFilters, parseListingFilters } from '../../src/lib/filters';
import type { Listing, ProviderCoverage } from '../../src/lib/types';

const NOW = new Date('2026-08-02T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

function coverage(over: Partial<ProviderCoverage> = {}): ProviderCoverage {
  return {
    acceptingNewPatients: true,
    acceptsMedicaid: true,
    acceptsMedicare: null,
    source: 'self_attested',
    asOf: daysAgo(30),
    ...over,
  };
}

describe('presentCoverage — fail-safe (§4, §14)', () => {
  it('publishes a sourced, dated fact', () => {
    const p = presentCoverage('acceptsMedicaid', coverage(), NOW);
    expect(p?.text).toBe('Accepts Medicaid');
    expect(p?.value).toBe(true);
    expect(p?.isStale).toBe(false);
    expect(p?.asOf).toBe(daysAgo(30));
  });

  it('publishes a NO as a real answer, not as silence', () => {
    // "Does not accept Medicaid" saves exactly the trip this feature exists to
    // prevent. It must never be softened or suppressed.
    const p = presentCoverage('acceptsMedicaid', coverage({ acceptsMedicaid: false }), NOW);
    expect(p?.text).toBe('Does not accept Medicaid');
    expect(p?.value).toBe(false);
  });

  it('publishes NOTHING when the value is unknown', () => {
    expect(presentCoverage('acceptsMedicare', coverage(), NOW)).toBeNull();
  });

  it('publishes NOTHING without a source', () => {
    // A flag with no provenance is the migration-0012 bug in a new place.
    expect(presentCoverage('acceptsMedicaid', coverage({ source: null }), NOW)).toBeNull();
  });

  it('publishes NOTHING without a date', () => {
    // An undated coverage claim is the unverifiable trust claim §14 forbids.
    expect(presentCoverage('acceptsMedicaid', coverage({ asOf: null }), NOW)).toBeNull();
  });

  it('publishes NOTHING for an unparseable or future date', () => {
    expect(presentCoverage('acceptsMedicaid', coverage({ asOf: 'not-a-date' }), NOW)).toBeNull();
    expect(presentCoverage('acceptsMedicaid', coverage({ asOf: '2027-01-01' }), NOW)).toBeNull();
  });

  it('flags a fact older than the staleness window', () => {
    const fresh = presentCoverage('acceptsMedicaid', coverage({ asOf: daysAgo(COVERAGE_STALE_DAYS) }), NOW);
    const stale = presentCoverage('acceptsMedicaid', coverage({ asOf: daysAgo(COVERAGE_STALE_DAYS + 1) }), NOW);
    expect(fresh?.isStale).toBe(false);
    expect(stale?.isStale).toBe(true);
  });

  it('decays twice as fast as an attribute claim', () => {
    // Coverage moves on a business cycle, not a breakage cycle (§13 uses 365).
    expect(COVERAGE_STALE_DAYS).toBe(180);
  });
});

describe('presentAllCoverage', () => {
  it('puts panel status first and drops the unknowns', () => {
    // No point knowing they take your Medicaid if they aren't taking anyone.
    const all = presentAllCoverage(coverage(), NOW);
    expect(all.map((c) => c.key)).toEqual(['acceptingNewPatients', 'acceptsMedicaid']);
  });

  it('returns nothing at all when there is no coverage record', () => {
    expect(presentAllCoverage(null, NOW)).toEqual([]);
  });
});

describe('coverage filters', () => {
  function provider(over: Partial<ProviderCoverage> | null): Listing {
    return {
      id: 'p1',
      kind: 'provider',
      name: 'Test Practice',
      summary: null,
      city: null,
      region: null,
      postalCode: null,
      category: null,
      disabledOwned: false,
      disabledLed: false,
      provider: {
        disabilityLiterate: false,
        coverage: over === null ? null : coverage(over),
      },
    };
  }

  it('parses the query params', () => {
    const f = parseListingFilters(new URLSearchParams('new_patients=1&medicaid=1&medicare=1'));
    expect([f.newPatients, f.medicaid, f.medicare]).toEqual([true, true, true]);
  });

  it('matches only a publishable true', () => {
    expect(coverageMatches('acceptsMedicaid', coverage(), NOW)).toBe(true);
    expect(coverageMatches('acceptsMedicaid', coverage({ acceptsMedicaid: false }), NOW)).toBe(false);
    expect(coverageMatches('acceptsMedicare', coverage(), NOW)).toBe(false); // unknown
    expect(coverageMatches('acceptsMedicaid', coverage({ source: null }), NOW)).toBe(false);
    expect(coverageMatches('acceptsMedicaid', coverage({ asOf: null }), NOW)).toBe(false);
  });

  it('EXCLUDES providers with no coverage data rather than guessing', () => {
    // The dangerous alternative is including unknowns "helpfully" — that turns a
    // filtered browse into the wasted trip the feature exists to prevent.
    const f = parseListingFilters(new URLSearchParams('medicaid=1'));
    const listings = [provider({}), provider(null)];
    expect(applyListingFilters(listings, f)).toHaveLength(1);
  });

  it('keeps a stale-but-true fact in the results (it is still information)', () => {
    const f = parseListingFilters(new URLSearchParams('medicaid=1'));
    const stale = provider({ asOf: daysAgo(COVERAGE_STALE_DAYS + 60) });
    expect(applyListingFilters([stale], f)).toHaveLength(1);
  });
});

describe('buildCoverageQuestions', () => {
  it('asks about commercial insurance, which is deliberately never stored', () => {
    const qs = buildCoverageQuestions(coverage(), NOW);
    const insurance = qs.find((q) => /in network/i.test(q.ask));
    expect(insurance).toBeDefined();
    // Nothing is ever "held" for commercial plans — that is the point.
    expect(insurance?.weAreTold).toBeNull();
  });

  it('annotates a question with what we hold, and stays silent when we hold nothing', () => {
    const qs = buildCoverageQuestions(coverage(), NOW);
    expect(qs[0].weAreTold).toMatch(/What we hold — Accepting new patients/);
    // Medicare is unknown in the fixture -> no claim repeated.
    expect(qs[2].weAreTold).toBeNull();
  });

  it('repeats nothing at all when the record is unsourced', () => {
    const qs = buildCoverageQuestions(coverage({ source: null }), NOW);
    expect(qs.every((q) => q.weAreTold === null)).toBe(true);
  });

  it('still asks every question when we hold no data (places aside)', () => {
    const qs = buildCoverageQuestions(null, NOW);
    expect(qs).toHaveLength(4);
    expect(qs.every((q) => q.weAreTold === null)).toBe(true);
  });
});
