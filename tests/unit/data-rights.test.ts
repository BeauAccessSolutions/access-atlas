import { describe, it, expect } from 'vitest';
import {
  deleteContributorData,
  exportContributorData,
  storagePathFromPublicUrl,
} from '../../src/lib/data-rights';

// Delete/export is safety- AND privacy-critical (§6, BAS invariant #3): it must
// remove ALL of a person's personal data (confirmations + evidence photos),
// keep community listings, and never silently swallow the consensus side effects
// of a departing dissenter (§4). These tests pin that behavior with a fake
// Supabase client — no DB — so the rules can't drift.

// ---- a minimal fake of the SupabaseClient surface these functions touch ------

interface Rows {
  contributors: { id: string }[];
  confirmations: { id: string; claim_id: string; photo_url: string | null; contributor_id: string }[];
  listings: { id: string; submitted_by: string | null }[];
}

function fakeAdmin(rows: Rows) {
  const removedPaths: string[] = [];
  const deletes: { table: string; ids: string[] }[] = [];

  const table = (name: keyof Rows) => {
    let col: string | null = null;
    let val: unknown = null;
    const api: any = {
      select: () => api,
      eq: (c: string, v: unknown) => {
        col = c;
        val = v;
        return api;
      },
      maybeSingle: async () => {
        const match = (rows[name] as any[]).find((r) => r[col!] === val) ?? null;
        return { data: match, error: null };
      },
      // terminal for list selects: resolves the filtered rows
      then: (resolve: (r: any) => void) => {
        const data = (rows[name] as any[]).filter((r) => r[col!] === val);
        resolve({ data, error: null });
      },
      delete: () => ({
        in: async (_c: string, ids: string[]) => {
          deletes.push({ table: name, ids });
          return { error: null };
        },
        eq: async (_c: string, v: string) => {
          deletes.push({ table: name, ids: [v] });
          return { error: null };
        },
      }),
    };
    return api;
  };

  const admin: any = {
    from: (name: keyof Rows) => table(name),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removedPaths.push(...paths);
          return { error: null };
        },
      }),
    },
  };
  return { admin, removedPaths, deletes };
}

const CONTRIB = 'contrib-1';

function seedRows(): Rows {
  return {
    contributors: [{ id: CONTRIB }],
    confirmations: [
      {
        id: 'f1',
        claim_id: 'claim-A',
        contributor_id: CONTRIB,
        photo_url: 'https://x.supabase.co/storage/v1/object/public/evidence/claim-A/aaa.jpg',
      },
      { id: 'f2', claim_id: 'claim-B', contributor_id: CONTRIB, photo_url: null },
      // Two confirmations on the same claim -> claim id must be de-duplicated.
      {
        id: 'f3',
        claim_id: 'claim-A',
        contributor_id: CONTRIB,
        photo_url: 'https://x.supabase.co/storage/v1/object/public/evidence/claim-A/bbb.jpg',
      },
    ],
    listings: [{ id: 'listing-1', submitted_by: CONTRIB }],
  };
}

describe('storagePathFromPublicUrl', () => {
  it('extracts the in-bucket path from an evidence public URL', () => {
    expect(
      storagePathFromPublicUrl(
        'https://x.supabase.co/storage/v1/object/public/evidence/claim-A/aaa.jpg',
      ),
    ).toBe('claim-A/aaa.jpg');
  });
  it('drops query strings and rejects non-evidence URLs', () => {
    expect(storagePathFromPublicUrl('https://x/evidence/c/p.jpg?token=1')).toBe('c/p.jpg');
    expect(storagePathFromPublicUrl('https://x/other/c/p.jpg')).toBeNull();
    expect(storagePathFromPublicUrl(null)).toBeNull();
  });
});

describe('deleteContributorData', () => {
  it('removes evidence photos, deletes the contributor, and keeps listings by default', async () => {
    const { admin, removedPaths, deletes } = fakeAdmin(seedRows());
    const result = await deleteContributorData(admin, CONTRIB);

    expect(result.existed).toBe(true);
    expect(result.deletedConfirmations).toBe(3);
    // Both photo'd confirmations' objects are removed; the null-photo one isn't.
    expect(removedPaths.sort()).toEqual(['claim-A/aaa.jpg', 'claim-A/bbb.jpg']);
    expect(result.deletedPhotos).toBe(2);
    // The contributor row is deleted (FK cascades confirmations); listings are NOT.
    expect(deletes).toContainEqual({ table: 'contributors', ids: [CONTRIB] });
    expect(deletes.find((d) => d.table === 'listings')).toBeUndefined();
    expect(result.keptListingIds).toEqual(['listing-1']);
    // Affected claims are de-duplicated and surfaced for re-review (§4).
    expect(result.affectedClaimIds.sort()).toEqual(['claim-A', 'claim-B']);
  });

  it('is idempotent: a missing contributor no-ops', async () => {
    const rows = seedRows();
    rows.contributors = [];
    const { admin, deletes } = fakeAdmin(rows);
    const result = await deleteContributorData(admin, CONTRIB);
    expect(result.existed).toBe(false);
    expect(result.deletedConfirmations).toBe(0);
    expect(deletes.find((d) => d.table === 'contributors')).toBeUndefined();
  });

  it('erases submitted listings only when explicitly asked', async () => {
    const { admin, deletes } = fakeAdmin(seedRows());
    const result = await deleteContributorData(admin, CONTRIB, { deleteSubmittedListings: true });
    expect(deletes).toContainEqual({ table: 'listings', ids: ['listing-1'] });
    expect(result.keptListingIds).toEqual([]);
  });
});

describe('exportContributorData', () => {
  it('gathers the contributor, their confirmations, and their submitted listings', async () => {
    const { admin } = fakeAdmin(seedRows());
    const data = await exportContributorData(admin, CONTRIB);
    expect(data.contributor).toEqual({ id: CONTRIB });
    expect(data.confirmations).toHaveLength(3);
    expect(data.submittedListings).toHaveLength(1);
    expect(typeof data.exportedAt).toBe('string');
  });
});
