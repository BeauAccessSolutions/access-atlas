import { describe, it, expect } from 'vitest';
import { sanitizeTags, IDENTITY_TAGS } from '../../src/lib/identity-tags';

describe('sanitizeTags (coarse, optional access tags — §6)', () => {
  it('keeps only recognized tags and drops anything else', () => {
    // A free-form value (e.g. an attempt to store a diagnosis) is discarded.
    expect(sanitizeTags(['wheelchair_user', 'multiple sclerosis', 'deaf_hoh'])).toEqual([
      'wheelchair_user',
      'deaf_hoh',
    ]);
  });

  it('de-duplicates', () => {
    expect(sanitizeTags(['wheelchair_user', 'wheelchair_user'])).toEqual(['wheelchair_user']);
  });

  it('returns empty for no/invalid input (tags are always optional)', () => {
    expect(sanitizeTags([])).toEqual([]);
    expect(sanitizeTags(['nonsense'])).toEqual([]);
  });

  it('the catalog stays coarse and access-oriented, not medical', () => {
    // Guard against the catalog drifting toward diagnoses/disability types (§6, §14).
    expect(IDENTITY_TAGS.length).toBeLessThanOrEqual(8);
    for (const t of IDENTITY_TAGS) {
      expect(t.key).toMatch(/^[a-z_]+$/);
    }
  });
});
