import { describe, it, expect } from 'vitest';
import { seedStatuses } from '../../src/lib/seed';

// The consensus formula lives in TWO places that must agree: the SQL view
// (attribute_claim_status) and the TS mirror in seed.ts. The SQL side is
// verified against real Postgres; these tests pin the TS mirror so the no-DB
// fallback can't silently drift from the safety-critical rule (§4, §13).

const NOW = new Date('2026-07-07T00:00:00Z');
const byClaim = (now: Date) => {
  const m = new Map<string, ReturnType<typeof seedStatuses>[number]>();
  for (const s of seedStatuses(now)) m.set(s.claimId, s);
  return m;
};

const VERIFIED = 'c1111111-1111-1111-1111-111111111111';
const CONFIRMATIONS = 'c2222222-2222-2222-2222-222222222222';
const DISPUTED = 'c3333333-3333-3333-3333-333333333333';
const SOURCED = 'c4444444-4444-4444-4444-444444444444';
const SELF = 'c5555555-5555-5555-5555-555555555555';

describe('consensus formula (seed mirror of the SQL view)', () => {
  it('derives all five labeling states from the seed', () => {
    const m = byClaim(NOW);
    expect(m.get(VERIFIED)?.state).toBe('community_verified');
    expect(m.get(CONFIRMATIONS)?.state).toBe('community_confirmations');
    expect(m.get(DISPUTED)?.state).toBe('disputed');
    expect(m.get(SOURCED)?.state).toBe('sourced');
    expect(m.get(SELF)?.state).toBe('self_reported');
  });

  it('requires >= 3 agreements AND a lived-experience-weighted one to verify', () => {
    const v = byClaim(NOW).get(VERIFIED)!;
    expect(v.agreeCount).toBeGreaterThanOrEqual(3);
    expect(v.weightedAgreeCount).toBeGreaterThanOrEqual(1); // wheelchair_user among them
  });

  it('freezes to disputed on any dissent, even with an agreement present', () => {
    const d = byClaim(NOW).get(DISPUTED)!;
    expect(d.dissentCount).toBeGreaterThan(0);
    expect(d.agreeCount).toBeGreaterThan(0); // had an agree, but dissent wins
    expect(d.state).toBe('disputed');
  });

  it('holds two agreements below the verified bar', () => {
    const c = byClaim(NOW).get(CONFIRMATIONS)!;
    expect(c.agreeCount).toBe(2);
    expect(c.state).toBe('community_confirmations');
  });

  it('applies time-decay independently of state (§4)', () => {
    const fresh = byClaim(NOW).get(VERIFIED)!;
    expect(fresh.isStale).toBe(false); // confirmed within the 12-month window

    const future = byClaim(new Date('2030-01-01T00:00:00Z')).get(VERIFIED)!;
    expect(future.state).toBe('community_verified'); // still verified…
    expect(future.isStale).toBe(true); //             …but now stale

    // Sourced claim has no first-person confirmations → no staleness clock.
    expect(byClaim(NOW).get(SOURCED)!.isStale).toBeNull();
  });
});
