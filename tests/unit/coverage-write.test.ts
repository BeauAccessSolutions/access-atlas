// Writing provider coverage (migration 0016).
//
// The rule under test: NEVER STORE WHAT WE COULD NOT PUBLISH.
//
// Migration 0017 moved most of that rule into the schema — source and as_of are
// NOT NULL on provider_coverage_facts, so an unpublishable fact is now
// unstorable rather than merely unrenderable. What is left here is the part SQL
// cannot express: a `sourced` fact needs a citation, a date must be real and not
// in the future, and a write must say who did it and how they know.
//
// The `carriedOverFlags` suite that used to live here is GONE, deliberately: it
// guarded against our own shared-provenance schema, and 0017 removed the schema
// problem. A partial write is now simply safe.
import { describe, it, expect } from 'vitest';
import { isPublishableAsOf, validateCoverageWrite } from '../../src/lib/coverage-write';

const NOW = new Date('2026-08-02T12:00:00Z');

function req(over: Record<string, unknown> = {}) {
  return {
    listingId: '33333333-3333-3333-3333-333333333333',
    values: { acceptsMedicaid: true as const },
    source: 'self_attested' as const,
    asOf: '2026-08-01',
    reason: 'called the office, spoke to reception',
    actor: 'ops-cli:tester',
    ...over,
  } as Parameters<typeof validateCoverageWrite>[0];
}

describe('isPublishableAsOf', () => {
  it('accepts a real past date and today', () => {
    expect(isPublishableAsOf('2026-08-01', NOW)).toBe(true);
    expect(isPublishableAsOf('2026-08-02', NOW)).toBe(true);
  });

  it('rejects the future — a fact cannot be confirmed tomorrow', () => {
    expect(isPublishableAsOf('2026-08-03', NOW)).toBe(false);
  });

  it('rejects a non-date and the wrong format', () => {
    expect(isPublishableAsOf('yesterday', NOW)).toBe(false);
    expect(isPublishableAsOf('01/08/2026', NOW)).toBe(false);
    expect(isPublishableAsOf('2026-8-1', NOW)).toBe(false);
  });

  it('rejects a date that only LOOKS valid', () => {
    // Date.parse rolls 2026-02-31 over to March 3 rather than failing, which
    // would silently store a date nobody typed.
    expect(isPublishableAsOf('2026-02-31', NOW)).toBe(false);
    expect(isPublishableAsOf('2026-13-01', NOW)).toBe(false);
  });
});

describe('validateCoverageWrite — refuses the unpublishable', () => {
  it('accepts a complete self-attested write', () => {
    expect(validateCoverageWrite(req(), NOW)).toEqual([]);
  });

  it('requires a reason — a published money fact must be accountable', () => {
    expect(validateCoverageWrite(req({ reason: '   ' }), NOW)).toContainEqual(
      expect.stringMatching(/reason/i),
    );
  });

  it('requires at least one flag', () => {
    expect(validateCoverageWrite(req({ values: {} }), NOW)).toContainEqual(
      expect.stringMatching(/at least one/i),
    );
  });

  it('requires a date, and rejects a future one', () => {
    expect(validateCoverageWrite(req({ asOf: '' }), NOW)).toContainEqual(
      expect.stringMatching(/undated/i),
    );
    expect(validateCoverageWrite(req({ asOf: '2027-01-01' }), NOW)).toContainEqual(
      expect.stringMatching(/past-or-today/i),
    );
  });

  it('requires a note for a SOURCED claim, so a reader can check it (§7)', () => {
    expect(validateCoverageWrite(req({ source: 'sourced' }), NOW)).toContainEqual(
      expect.stringMatching(/note/i),
    );
    expect(
      validateCoverageWrite(req({ source: 'sourced', note: 'NY State of Health, Aug 2026' }), NOW),
    ).toEqual([]);
  });

  it('rejects an unknown source vocabulary', () => {
    expect(validateCoverageWrite(req({ source: 'i_reckon' }), NOW)).toContainEqual(
      expect.stringMatching(/self_attested/),
    );
  });

  it('reports EVERY problem at once, not one per run', () => {
    // An operator on the phone should not have to re-run four times.
    const problems = validateCoverageWrite(
      // A fact IS set here, so the provenance rules apply: missing reason,
      // sourced-without-note, and an unparseable date should all surface.
      req({ reason: '', asOf: 'nope', source: 'sourced', note: '' }),
      NOW,
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
    expect(problems.some((p) => /reason/i.test(p))).toBe(true);
    expect(problems.some((p) => /note/i.test(p))).toBe(true);
    expect(problems.some((p) => /past-or-today/i.test(p))).toBe(true);
  });

  it('does not nag about source or date when nothing is being set', () => {
    // With no facts supplied the operator's real problem is "you set nothing" —
    // adding provenance complaints on top would bury it.
    const problems = validateCoverageWrite(req({ values: {} }), NOW);
    expect(problems).toEqual([expect.stringMatching(/at least one/i)]);
  });
});

describe('validateCoverageWrite — the retraction path', () => {
  it('lets you clear everything WITHOUT a source or date', () => {
    // "Our note was wrong, take it down" must not be blocked by demanding
    // provenance for a fact that is being removed.
    const problems = validateCoverageWrite(
      req({
        values: {
          acceptingNewPatients: 'unknown',
          acceptsMedicaid: 'unknown',
          acceptsMedicare: 'unknown',
          offersTelehealth: 'unknown',
        },
        source: undefined,
        asOf: '',
      }),
      NOW,
    );
    expect(problems).toEqual([]);
  });

  it('still requires a reason when retracting', () => {
    const problems = validateCoverageWrite(
      req({ values: { acceptsMedicaid: 'unknown' }, source: undefined, asOf: '', reason: '' }),
      NOW,
    );
    expect(problems).toContainEqual(expect.stringMatching(/reason/i));
  });

  it('still demands provenance when a write both clears AND sets', () => {
    // Clearing one fact while setting another is a normal publish, not a pure
    // retraction — the fact being SET needs its own source and date.
    const problems = validateCoverageWrite(
      req({
        values: { acceptsMedicaid: 'unknown', acceptsMedicare: true },
        source: undefined,
        asOf: '',
      }),
      NOW,
    );
    expect(problems.length).toBeGreaterThan(0);
  });
});
