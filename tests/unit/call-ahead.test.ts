// The ask-ahead script (src/lib/call-ahead.ts): the copy-vs-catalog drift guard
// and the ordering that makes the page useful.
//
// Ordering is the whole feature. A list that opens with three facts the
// community already settled, and buries the disputed one at the bottom, is
// worse than no list — it spends the visitor's attention on the wrong question.
import { describe, it, expect } from 'vitest';
import { ASK_AHEAD, buildAskAhead, reasonNote } from '../../src/lib/call-ahead';
import { seedAttributeIdentityTags } from '../../src/lib/seed';
import type { AttributeStatus } from '../../src/lib/types';

const CATALOG = Object.keys(seedAttributeIdentityTags());

function status(over: Partial<AttributeStatus> & { attributeKey: string }): AttributeStatus {
  return {
    claimId: `claim-${over.attributeKey}`,
    listingId: 'listing-1',
    label: over.attributeKey,
    category: 'facility_objective',
    state: 'community_confirmations',
    agreeCount: 1,
    dissentCount: 0,
    weightedAgreeCount: 0,
    lastConfirmedAt: '2026-07-01',
    isStale: false,
    ...over,
  };
}

describe('ask-ahead copy', () => {
  it('covers every attribute in the catalog, and invents none', () => {
    // The catalog lives in the migration chain; this copy lives in TS. That is
    // a deliberate split (copy churns, validation data does not) — so the two
    // have to be checked against each other, or a new attribute silently gets
    // no question and vanishes from the page.
    expect(Object.keys(ASK_AHEAD).sort()).toEqual([...CATALOG].sort());
  });

  it('asks in the present tense, not the catalog\'s past-tense visit question', () => {
    // The catalog asks "On your visit, could you…" — nonsense to say to someone
    // on the phone. Guards against a copy-paste from question_text.
    for (const [key, copy] of Object.entries(ASK_AHEAD)) {
      expect(copy.ask, key).not.toMatch(/on your visit/i);
      expect(copy.ask.length, key).toBeGreaterThan(20);
      expect(copy.followUp.length, key).toBeGreaterThan(20);
    }
  });
});

describe('buildAskAhead ordering', () => {
  it('puts a disputed fact first and a stale one ahead of an unconfirmed one', () => {
    const { ask } = buildAskAhead(
      [
        status({ attributeKey: 'accessible_parking', state: 'self_reported', agreeCount: 0 }),
        status({ attributeKey: 'accessible_restroom', state: 'community_verified', isStale: true }),
        status({ attributeKey: 'entrance_step_free', state: 'disputed', dissentCount: 1 }),
      ],
      [],
    );
    expect(ask.map((a) => a.reason)).toEqual(['disputed', 'stale', 'self_reported']);
    expect(ask[0].attributeKey).toBe('entrance_step_free');
  });

  it('moves settled facts out of the questions and into "already answered"', () => {
    const { ask, settled } = buildAskAhead(
      [
        status({ attributeKey: 'entrance_step_free', state: 'community_verified' }),
        status({ attributeKey: 'accessible_restroom', state: 'sourced' }),
      ],
      [],
    );
    expect(ask).toEqual([]);
    expect(settled.map((s) => s.state).sort()).toEqual(['community_verified', 'sourced']);
  });

  it('treats a STALE settled fact as worth re-asking (§4 time-decay)', () => {
    // A fact confirmed three times in 2019 is not a fact about today. Staleness
    // has to outrank the state, or the page confidently tells someone not to
    // ask about a ramp that was removed two years ago.
    const { ask, settled } = buildAskAhead(
      [status({ attributeKey: 'entrance_step_free', state: 'community_verified', isStale: true })],
      [],
    );
    expect(settled).toEqual([]);
    expect(ask[0].reason).toBe('stale');
  });

  it('generates questions for facts nobody has reported on at all', () => {
    // The listings with no data are exactly the ones a visitor most needs to
    // ask about — the community can tell them nothing.
    const { ask } = buildAskAhead(
      [],
      [
        { key: 'entrance_step_free', label: 'Step-free entrance' },
        { key: 'service_animal_welcomed', label: 'Service animal welcomed' },
      ],
    );
    expect(ask).toHaveLength(2);
    expect(ask.every((a) => a.reason === 'untracked')).toBe(true);
    expect(ask.every((a) => a.ask.length > 0 && a.followUp.length > 0)).toBe(true);
  });

  it('never asks twice about the same attribute', () => {
    // A tracked fact must not reappear via the catalog pass.
    const { ask } = buildAskAhead(
      [status({ attributeKey: 'entrance_step_free', state: 'self_reported' })],
      [{ key: 'entrance_step_free', label: 'Step-free entrance' }],
    );
    expect(ask).toHaveLength(1);
  });

  it('skips an attribute with no copy rather than rendering a blank question', () => {
    const { ask, settled } = buildAskAhead(
      [status({ attributeKey: 'not_a_real_attribute', state: 'self_reported' })],
      [{ key: 'also_not_real', label: 'Nope' }],
    );
    expect(ask).toEqual([]);
    expect(settled).toEqual([]);
  });

  it('gives every reason a plain-language note', () => {
    for (const reason of ['disputed', 'stale', 'self_reported', 'untracked', 'partly_confirmed'] as const) {
      expect(reasonNote(reason).length).toBeGreaterThan(10);
    }
  });
});
