import { describe, it, expect } from 'vitest';
import {
  isValidActor,
  isValidReason,
  recordModerationAudit,
  redactEvidencePhoto,
} from '../../src/lib/moderation';

const ACTOR = 'ops-cli:test';

describe('moderation: reason + actor are mandatory + accountable', () => {
  it('accepts a non-empty reason, rejects empty/whitespace/non-strings', () => {
    expect(isValidReason('off-topic')).toBe(true);
    expect(isValidReason('   ')).toBe(false);
    expect(isValidReason('')).toBe(false);
    expect(isValidReason(undefined)).toBe(false);
    expect(isValidReason(42)).toBe(false);
  });

  it('validates the actor the same way (audit needs a "who")', () => {
    expect(isValidActor('ops-cli:zach')).toBe(true);
    expect(isValidActor('  ')).toBe(false);
    expect(isValidActor('')).toBe(false);
    expect(isValidActor(undefined)).toBe(false);
  });

  it('throws without a reason, even if a target is given', async () => {
    await expect(
      redactEvidencePhoto({} as never, { confirmationId: 'c1' }, '', ACTOR),
    ).rejects.toThrow(/reason/i);
  });

  it('throws when neither confirmationId nor photoUrl is given', async () => {
    await expect(redactEvidencePhoto({} as never, {}, 'abuse', ACTOR)).rejects.toThrow(
      /confirmationId or a photoUrl/i,
    );
  });

  it('throws with a target + reason but no actor (unaccountable action)', async () => {
    await expect(
      redactEvidencePhoto({} as never, { confirmationId: 'c1' }, 'abuse', ''),
    ).rejects.toThrow(/actor/i);
  });
});

// A tiny fake of the Supabase query/storage surface the function touches, so the
// control flow (find → remove storage → null columns → audit insert) is
// exercised without a DB. `from(table)` returns a per-table builder so we can
// capture the confirmations update AND the moderation_audit insert separately.
function fakeAdmin(row: Record<string, unknown> | null) {
  const removed: string[][] = [];
  const updates: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const confirmations = {
    select: () => confirmations,
    not: () => confirmations,
    eq: () => confirmations,
    update(patch: Record<string, unknown>) {
      updates.push(patch);
      return { eq: () => ({ error: null }) };
    },
    maybeSingle: () => ({ data: row, error: null }),
  };
  const audit = {
    insert(patch: Record<string, unknown>) {
      audits.push(patch);
      return { select: () => ({ single: () => ({ data: { id: 'audit-1' }, error: null }) }) };
    },
  };
  const admin = {
    from: (table: string) => (table === 'moderation_audit' ? audit : confirmations),
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { admin, removed, updates, audits };
}

describe('moderation: redactEvidencePhoto behaviour', () => {
  it('removes both storage objects, nulls the photo columns keeping the vote, and audits', async () => {
    const { admin, removed, updates, audits } = fakeAdmin({
      id: 'conf-1',
      claim_id: 'claim-1',
      photo_url: 'https://x/storage/v1/object/public/evidence/claim-1/a.jpg',
      photo_thumb_url: 'https://x/storage/v1/object/public/evidence/claim-1/a-thumb.jpg',
    });
    const res = await redactEvidencePhoto(admin as never, { confirmationId: 'conf-1' }, 'abuse', ACTOR);

    expect(res.found).toBe(true);
    expect(res.confirmationId).toBe('conf-1');
    expect(res.claimId).toBe('claim-1');
    expect(res.removedObjects).toBe(2); // full + thumbnail
    expect(res.auditId).toBe('audit-1');
    // Only the photo columns are nulled — no `agrees`/vote field is touched.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ photo_url: null, photo_thumb_url: null, photo_alt: null });
    expect('agrees' in updates[0]).toBe(false);
    expect(removed[0].sort()).toEqual(['claim-1/a-thumb.jpg', 'claim-1/a.jpg']);
    // Exactly one audit row, of the right action, WITHOUT any contributor id (§6).
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('photo_redaction');
    expect(audits[0].reason).toBe('abuse');
    expect(audits[0].actor).toBe(ACTOR);
    expect(audits[0].confirmation_id).toBe('conf-1');
    expect(audits[0].claim_id).toBe('claim-1');
    expect('contributor_id' in audits[0]).toBe(false);
  });

  it('is idempotent — a missing/already-scrubbed photo returns found:false, no writes, no audit', async () => {
    const { admin, removed, updates, audits } = fakeAdmin(null);
    const res = await redactEvidencePhoto(
      admin as never,
      { photoUrl: 'https://x/evidence/gone.jpg' },
      'dupe',
      ACTOR,
    );
    expect(res.found).toBe(false);
    expect(res.removedObjects).toBe(0);
    expect(res.auditId).toBe(null);
    expect(removed).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(audits).toHaveLength(0); // no action happened → no audit row
  });
});

describe('moderation: recordModerationAudit', () => {
  it('requires reason and actor, and never writes a contributor id', async () => {
    const { admin, audits } = fakeAdmin(null);
    await expect(
      recordModerationAudit(admin as never, { action: 'photo_redaction', reason: '', actor: ACTOR }),
    ).rejects.toThrow(/reason/i);
    await expect(
      recordModerationAudit(admin as never, { action: 'photo_redaction', reason: 'x', actor: '' }),
    ).rejects.toThrow(/actor/i);

    const id = await recordModerationAudit(admin as never, {
      action: 'confirmation_takedown',
      reason: 'fraud',
      actor: ACTOR,
      claimId: 'claim-9',
    });
    expect(id).toBe('audit-1');
    expect(audits[0]).toMatchObject({ action: 'confirmation_takedown', claim_id: 'claim-9' });
    expect('contributor_id' in audits[0]).toBe(false);
  });
});
