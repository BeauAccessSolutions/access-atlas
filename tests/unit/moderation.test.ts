import { describe, it, expect } from 'vitest';
import { isValidReason, redactEvidencePhoto } from '../../src/lib/moderation';

describe('moderation: reason is mandatory + accountable', () => {
  it('accepts a non-empty reason, rejects empty/whitespace/non-strings', () => {
    expect(isValidReason('off-topic')).toBe(true);
    expect(isValidReason('   ')).toBe(false);
    expect(isValidReason('')).toBe(false);
    expect(isValidReason(undefined)).toBe(false);
    expect(isValidReason(42)).toBe(false);
  });

  it('throws without a reason, even if a target is given', async () => {
    await expect(
      redactEvidencePhoto({} as never, { confirmationId: 'c1' }, ''),
    ).rejects.toThrow(/reason/i);
  });

  it('throws when neither confirmationId nor photoUrl is given', async () => {
    await expect(redactEvidencePhoto({} as never, {}, 'abuse')).rejects.toThrow(
      /confirmationId or a photoUrl/i,
    );
  });
});

// A tiny fake of the Supabase query/storage surface the function touches, so the
// control flow (find → remove storage → null columns) is exercised without a DB.
function fakeAdmin(row: Record<string, unknown> | null) {
  const removed: string[][] = [];
  const updates: Array<Record<string, unknown>> = [];
  const builder = {
    select: () => builder,
    not: () => builder,
    eq: () => builder,
    update(patch: Record<string, unknown>) {
      updates.push(patch);
      return { eq: () => ({ error: null }) };
    },
    maybeSingle: () => ({ data: row, error: null }),
  };
  const admin = {
    from: () => builder,
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { admin, removed, updates };
}

describe('moderation: redactEvidencePhoto behaviour', () => {
  it('removes both storage objects and nulls the photo columns, keeping the vote', async () => {
    const { admin, removed, updates } = fakeAdmin({
      id: 'conf-1',
      claim_id: 'claim-1',
      photo_url: 'https://x/storage/v1/object/public/evidence/claim-1/a.jpg',
      photo_thumb_url: 'https://x/storage/v1/object/public/evidence/claim-1/a-thumb.jpg',
    });
    const res = await redactEvidencePhoto(admin as never, { confirmationId: 'conf-1' }, 'abuse');

    expect(res.found).toBe(true);
    expect(res.confirmationId).toBe('conf-1');
    expect(res.claimId).toBe('claim-1');
    expect(res.removedObjects).toBe(2); // full + thumbnail
    // Only the photo columns are nulled — no `agrees`/vote field is touched.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ photo_url: null, photo_thumb_url: null, photo_alt: null });
    expect('agrees' in updates[0]).toBe(false);
    expect(removed[0].sort()).toEqual(['claim-1/a-thumb.jpg', 'claim-1/a.jpg']);
  });

  it('is idempotent — a missing/already-scrubbed photo returns found:false, no writes', async () => {
    const { admin, removed, updates } = fakeAdmin(null);
    const res = await redactEvidencePhoto(admin as never, { photoUrl: 'https://x/evidence/gone.jpg' }, 'dupe');
    expect(res.found).toBe(false);
    expect(res.removedObjects).toBe(0);
    expect(removed).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
