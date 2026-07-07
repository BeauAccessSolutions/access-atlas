import { describe, it, expect } from 'vitest';
import { presentState, staleness, ALLOWED_STATES } from '../../src/lib/labeling';
import type { AttributeState, AttributeStatus } from '../../src/lib/types';

// Build a status with sane defaults; override per test.
function make(state: AttributeState, over: Partial<AttributeStatus> = {}): AttributeStatus {
  return {
    claimId: 'c',
    listingId: 'l',
    attributeKey: 'entrance_step_free',
    label: 'Step-free entrance',
    category: 'facility_objective',
    state,
    agreeCount: 0,
    dissentCount: 0,
    weightedAgreeCount: 0,
    lastConfirmedAt: null,
    isStale: null,
    sourcedNote: null,
    ...over,
  };
}

describe('presentState — trust mapping', () => {
  it('marks only sourced and community_verified as trustworthy claims', () => {
    expect(presentState(make('community_verified', { agreeCount: 3 })).isTrustworthyClaim).toBe(true);
    expect(presentState(make('sourced')).isTrustworthyClaim).toBe(true);
    expect(presentState(make('community_confirmations', { agreeCount: 2 })).isTrustworthyClaim).toBe(false);
    expect(presentState(make('self_reported')).isTrustworthyClaim).toBe(false);
    expect(presentState(make('disputed', { dissentCount: 1 })).isTrustworthyClaim).toBe(false);
  });

  it('reserves "high confidence" for the sourced state ONLY (§4)', () => {
    for (const state of ALLOWED_STATES) {
      const p = presentState(make(state, { agreeCount: 3, dissentCount: state === 'disputed' ? 1 : 0 }));
      const text = `${p.text} ${p.description}`.toLowerCase();
      if (state === 'sourced') {
        expect(text).toContain('high confidence');
      } else {
        expect(text).not.toContain('high confidence');
      }
    }
  });

  it('labels unconfirmed data as "self-reported / awaiting verification", never "verified"', () => {
    const p = presentState(make('self_reported'));
    expect(p.text).toBe('Self-reported / awaiting verification');
    // The honest label may say "awaiting verification"; it must NOT claim it IS verified.
    expect(p.text.toLowerCase()).not.toMatch(/community-verified|\bis verified\b/);
    expect(p.tone).toBe('unverified');
  });

  it('a disputed claim tells the reader not to rely on it (§4 favor dissent)', () => {
    const p = presentState(make('disputed', { dissentCount: 1, agreeCount: 3 }));
    expect(p.tone).toBe('disputed');
    expect(p.isTrustworthyClaim).toBe(false);
    expect(p.description.toLowerCase()).toMatch(/not accessible|do not rely|re-review/);
  });

  it('counts confirmations honestly in community_confirmations text', () => {
    expect(presentState(make('community_confirmations', { agreeCount: 1 })).text).toBe('1 community confirmation');
    expect(presentState(make('community_confirmations', { agreeCount: 2 })).text).toBe('2 community confirmations');
  });

  it('names the source when sourced', () => {
    const p = presentState(make('sourced', { sourcedNote: 'Erie County ADA audit, 2026' }));
    expect(p.description).toContain('Erie County ADA audit, 2026');
  });
});

describe('staleness', () => {
  it('surfaces staleness only when isStale is true, orthogonal to state', () => {
    expect(staleness(make('community_verified', { isStale: true, agreeCount: 3 }))).toMatch(/re-confirm/i);
    expect(staleness(make('community_verified', { isStale: false }))).toBeNull();
    expect(staleness(make('community_verified', { isStale: null }))).toBeNull();
  });
});
