// Provider coverage presentation (migrations 0014-0017).
//
// The failure mode these guard is specific and expensive: tell someone a
// practice takes their Medicaid, they travel there, and they are turned away at
// the desk or billed.
//
// WHAT MIGRATION 0017 CHANGED HERE. This file used to be mostly about the
// presenter refusing to publish an unsourced or undated fact. Those refusals are
// gone — not weakened, RELOCATED: `provider_coverage_facts.source` and `.as_of`
// are NOT NULL, so a fact without provenance can no longer exist to be refused.
// What remains is presentation, the belt-and-braces date check, and the new
// property worth protecting: facts are INDEPENDENT, so one fact's provenance
// never speaks for another's.
import { describe, it, expect } from 'vitest';
import {
  COVERAGE_STALE_DAYS,
  coverageMatches,
  presentAllCoverage,
  presentCoverage,
} from '../../src/lib/coverage';
import { buildCoverageQuestions } from '../../src/lib/call-ahead';
import { applyListingFilters, parseListingFilters } from '../../src/lib/filters';
import type { CoverageFact, Listing, ProviderCoverage } from '../../src/lib/types';

const NOW = new Date('2026-08-02T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

/** A self-attested fact confirmed 30 days ago, unless overridden. */
function fact(value: boolean, over: Partial<CoverageFact> = {}): CoverageFact {
  return { value, source: 'self_attested', asOf: daysAgo(30), note: null, ...over };
}

/** The seeded shape: three known facts, Medicare absent (= unknown). */
function coverage(over: ProviderCoverage = {}): ProviderCoverage {
  return {
    acceptingNewPatients: fact(true),
    acceptsMedicaid: fact(true),
    offersTelehealth: fact(true),
    ...over,
  };
}

describe('presentCoverage', () => {
  it('publishes a fact with its own source and date', () => {
    const p = presentCoverage('acceptsMedicaid', coverage(), NOW);
    expect(p?.text).toBe('Accepts Medicaid');
    expect(p?.value).toBe(true);
    expect(p?.isStale).toBe(false);
    expect(p?.asOf).toBe(daysAgo(30));
    expect(p?.provenance).toMatch(/told us this themselves/);
  });

  it('publishes a NO as a real answer, not as silence', () => {
    // "Does not accept Medicaid" saves exactly the trip this feature exists to
    // prevent. It must never be softened or suppressed.
    const p = presentCoverage('acceptsMedicaid', coverage({ acceptsMedicaid: fact(false) }), NOW);
    expect(p?.text).toBe('Does not accept Medicaid');
    expect(p?.value).toBe(false);
  });

  it('publishes NOTHING for a fact we do not hold', () => {
    // Unknown is the ABSENCE of a fact now — no null-value branch to get wrong.
    expect(presentCoverage('acceptsMedicare', coverage(), NOW)).toBeNull();
    expect(presentCoverage('acceptsMedicaid', {}, NOW)).toBeNull();
    expect(presentCoverage('acceptsMedicaid', null, NOW)).toBeNull();
  });

  it('still refuses a corrupt or future date — degrade to silence, not a claim', () => {
    // Belt and braces: the write path validates dates, but a bad row must not
    // become a published claim.
    expect(
      presentCoverage('acceptsMedicaid', coverage({ acceptsMedicaid: fact(true, { asOf: 'nope' }) }), NOW),
    ).toBeNull();
    expect(
      presentCoverage('acceptsMedicaid', coverage({ acceptsMedicaid: fact(true, { asOf: '2027-01-01' }) }), NOW),
    ).toBeNull();
  });

  it('names the citation for a sourced fact (§7)', () => {
    const p = presentCoverage(
      'acceptsMedicaid',
      coverage({ acceptsMedicaid: fact(true, { source: 'sourced', note: 'NY State of Health' }) }),
      NOW,
    );
    expect(p?.provenance).toMatch(/From: NY State of Health/);
    expect(p?.provenance).toMatch(/Not confirmed with the practice directly/);
  });

  it('flags a fact older than the staleness window', () => {
    const fresh = presentCoverage(
      'acceptsMedicaid',
      coverage({ acceptsMedicaid: fact(true, { asOf: daysAgo(COVERAGE_STALE_DAYS) }) }),
      NOW,
    );
    const stale = presentCoverage(
      'acceptsMedicaid',
      coverage({ acceptsMedicaid: fact(true, { asOf: daysAgo(COVERAGE_STALE_DAYS + 1) }) }),
      NOW,
    );
    expect(fresh?.isStale).toBe(false);
    expect(stale?.isStale).toBe(true);
  });

  it('decays twice as fast as an attribute claim', () => {
    // Coverage moves on a business cycle, not a breakage cycle (§13 uses 365).
    expect(COVERAGE_STALE_DAYS).toBe(180);
  });

  it('does not dress telehealth "no" up as bad news', () => {
    // The one fact where false is an ABSENT ALTERNATIVE, not a closed door.
    const p = presentCoverage('offersTelehealth', coverage({ offersTelehealth: fact(false) }), NOW);
    expect(p?.text).toBe('In-person appointments only');
    expect(p?.text).not.toMatch(/does not/i);
  });
});

describe('facts are independent (the point of migration 0017)', () => {
  it('lets each fact carry its OWN source and date', () => {
    // The bug this migration fixed: one shared source meant recording a
    // directory answer for Medicare relabelled the practice's own
    // self-attestation about its panel status.
    const mixed = coverage({
      acceptsMedicare: fact(true, {
        source: 'sourced',
        note: 'NY State of Health',
        asOf: daysAgo(1),
      }),
    });
    const panel = presentCoverage('acceptingNewPatients', mixed, NOW);
    const medicare = presentCoverage('acceptsMedicare', mixed, NOW);

    expect(panel?.provenance).toMatch(/told us this themselves/);
    expect(panel?.asOf).toBe(daysAgo(30));
    expect(medicare?.provenance).toMatch(/From: NY State of Health/);
    expect(medicare?.asOf).toBe(daysAgo(1));
  });

  it('lets one fact be stale while another is fresh', () => {
    const mixed = coverage({
      acceptsMedicaid: fact(true, { asOf: daysAgo(COVERAGE_STALE_DAYS + 30) }),
    });
    expect(presentCoverage('acceptsMedicaid', mixed, NOW)?.isStale).toBe(true);
    expect(presentCoverage('acceptingNewPatients', mixed, NOW)?.isStale).toBe(false);
  });
});

describe('presentAllCoverage', () => {
  it('puts panel status first and telehealth last, dropping the unknowns', () => {
    // No point knowing they take your Medicaid if they aren't taking anyone;
    // telehealth only decides whether you must travel.
    const all = presentAllCoverage(coverage({ acceptsMedicare: fact(true) }), NOW);
    expect(all.map((c) => c.key)).toEqual([
      'acceptingNewPatients',
      'acceptsMedicaid',
      'acceptsMedicare',
      'offersTelehealth',
    ]);
    expect(presentAllCoverage(coverage(), NOW).map((c) => c.key)).not.toContain('acceptsMedicare');
  });

  it('returns nothing at all when we hold no facts', () => {
    expect(presentAllCoverage({}, NOW)).toEqual([]);
    expect(presentAllCoverage(null, NOW)).toEqual([]);
  });
});

describe('coverage filters', () => {
  function provider(cov: ProviderCoverage | null): Listing {
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
      provider: { disabilityLiterate: false, coverage: cov },
    };
  }

  it('parses the query params', () => {
    const f = parseListingFilters(
      new URLSearchParams('new_patients=1&medicaid=1&medicare=1&telehealth=1'),
    );
    expect([f.newPatients, f.medicaid, f.medicare, f.telehealth]).toEqual([true, true, true, true]);
  });

  it('matches only a publishable true', () => {
    expect(coverageMatches('acceptsMedicaid', coverage(), NOW)).toBe(true);
    expect(coverageMatches('acceptsMedicaid', coverage({ acceptsMedicaid: fact(false) }), NOW)).toBe(
      false,
    );
    expect(coverageMatches('acceptsMedicare', coverage(), NOW)).toBe(false); // absent = unknown
    expect(coverageMatches('acceptsMedicaid', {}, NOW)).toBe(false);
  });

  it('EXCLUDES providers with no coverage data rather than guessing', () => {
    // The dangerous alternative is including unknowns "helpfully" — that turns a
    // filtered browse into the wasted trip the feature exists to prevent.
    const f = parseListingFilters(new URLSearchParams('medicaid=1'));
    expect(applyListingFilters([provider(coverage()), provider(null)], f)).toHaveLength(1);
  });

  it('keeps a stale-but-true fact in the results (it is still information)', () => {
    const f = parseListingFilters(new URLSearchParams('medicaid=1'));
    const stale = provider(
      coverage({ acceptsMedicaid: fact(true, { asOf: daysAgo(COVERAGE_STALE_DAYS + 60) }) }),
    );
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
    // Medicare is absent in the fixture -> no claim repeated.
    expect(qs[2].weAreTold).toBeNull();
  });

  it('asks about telehealth, and about who it is actually open to', () => {
    const qs = buildCoverageQuestions(coverage(), NOW);
    const tele = qs.find((q) => /telehealth/i.test(q.ask));
    expect(tele?.weAreTold).toMatch(/Offers telehealth appointments/);
    // The trap this follow-up exists for: "yes" often means established
    // patients only, which is useless to someone trying to become a patient.
    expect(tele?.followUp).toMatch(/new patients or established/i);
  });

  it('still asks every question when we hold no data', () => {
    const qs = buildCoverageQuestions(null, NOW);
    // 3 gates + telehealth availability + commercial insurance.
    expect(qs).toHaveLength(5);
    expect(qs.every((q) => q.weAreTold === null)).toBe(true);
  });
});
