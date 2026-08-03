// Writing provider coverage (migration 0016).
//
// The rule under test: NEVER STORE WHAT WE COULD NOT PUBLISH. coverage.ts
// already refuses to render an unsourced or undated fact, but a database full of
// unpublishable rows is its own problem — it looks like data and reports like
// data. So the same rules are enforced at the door, and these tests are mostly
// about what the write path REFUSES.
import { describe, it, expect } from 'vitest';
import {
  carriedOverFlags,
  isPublishableAsOf,
  validateCoverageWrite,
} from '../../src/lib/coverage-write';
import type { ProviderCoverage } from '../../src/lib/types';

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
      req({ reason: '', asOf: 'nope', source: 'sourced', values: {} }),
      NOW,
    );
    expect(problems.length).toBeGreaterThanOrEqual(4);
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

  it('still demands provenance when only SOME flags are cleared', () => {
    // One flag cleared and another set is a normal publish, not a retraction —
    // the surviving fact needs a source and a date like any other.
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

describe('carriedOverFlags — the relabelling trap', () => {
  // Found by verifying against Postgres, not by reasoning: updating ONE flag
  // with a new source relabelled the other three, because migration 0014 stores
  // one source/date for the whole record. The practice's own self-attested
  // panel status was published as "From: NY State of Health directory" — a
  // provenance nobody had. Migration 0012's bug, in a new place.
  const before: ProviderCoverage = {
    acceptingNewPatients: true,
    acceptsMedicaid: true,
    acceptsMedicare: null,
    offersTelehealth: true,
    source: 'self_attested',
    asOf: '2026-07-03',
    note: null,
  };

  it('flags the facts a new source would silently relabel', () => {
    const carried = carriedOverFlags(before, {
      values: { acceptsMedicare: true },
      source: 'sourced',
      asOf: '2026-08-02',
      note: 'NY State of Health directory',
    });
    expect(carried.sort()).toEqual([
      'acceptingNewPatients',
      'acceptsMedicaid',
      'offersTelehealth',
    ]);
  });

  it('allows a partial add under the SAME provenance', () => {
    // Same call, same batch: extending provenance that already describes these
    // facts is correct, and must stay frictionless.
    expect(
      carriedOverFlags(before, {
        values: { acceptsMedicare: true },
        source: 'self_attested',
        asOf: '2026-07-03',
        note: null,
      }),
    ).toEqual([]);
  });

  it('allows a new provenance when everything is re-stated', () => {
    expect(
      carriedOverFlags(before, {
        values: {
          acceptingNewPatients: false,
          acceptsMedicaid: true,
          acceptsMedicare: true,
          offersTelehealth: true,
        },
        source: 'sourced',
        asOf: '2026-08-02',
        note: 'directory',
      }),
    ).toEqual([]);
  });

  it('counts an explicit retraction as re-stating', () => {
    // Clearing a flag is a decision about it, not a silent carry-over.
    expect(
      carriedOverFlags(before, {
        values: {
          acceptingNewPatients: 'unknown',
          acceptsMedicaid: 'unknown',
          acceptsMedicare: true,
          offersTelehealth: 'unknown',
        },
        source: 'sourced',
        asOf: '2026-08-02',
        note: 'directory',
      }),
    ).toEqual([]);
  });

  it('has nothing to carry over on a first write', () => {
    expect(
      carriedOverFlags(null, {
        values: { acceptsMedicaid: true },
        source: 'sourced',
        asOf: '2026-08-02',
        note: 'x',
      }),
    ).toEqual([]);
  });

  it('treats an empty note and a null note as the same provenance', () => {
    // Otherwise a cosmetic --note "" would trip the guard on an identical batch.
    expect(
      carriedOverFlags(before, {
        values: { acceptsMedicare: true },
        source: 'self_attested',
        asOf: '2026-07-03',
        note: '   ',
      }),
    ).toEqual([]);
  });
});
