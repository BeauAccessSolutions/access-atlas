import { describe, expect, it } from 'vitest';
import { zipCentroid } from '../../src/lib/zip-centroids';

describe('zipCentroid', () => {
  it('returns an approximate WNY centroid for a known ZIP', () => {
    const c = zipCentroid('14222'); // Elmwood Village
    expect(c).not.toBeNull();
    // In the Buffalo area (sanity bounds, not exact — these are approximate).
    expect(c!.lat).toBeGreaterThan(42.7);
    expect(c!.lat).toBeLessThan(43.1);
    expect(c!.lng).toBeGreaterThan(-79.0);
    expect(c!.lng).toBeLessThan(-78.6);
  });

  it('uses only the 5-digit base of a ZIP+4', () => {
    expect(zipCentroid('14222-1234')).toEqual(zipCentroid('14222'));
  });

  it('returns null for a ZIP outside the curated WNY set (§3 WNY-first)', () => {
    expect(zipCentroid('10001')).toBeNull(); // NYC — deliberately not bundled
    expect(zipCentroid('90210')).toBeNull();
  });

  it('returns null for blank / malformed / non-string input', () => {
    expect(zipCentroid('')).toBeNull();
    expect(zipCentroid('142')).toBeNull(); // too short
    expect(zipCentroid('abcde')).toBeNull();
    expect(zipCentroid(null)).toBeNull();
    expect(zipCentroid(undefined)).toBeNull();
    expect(zipCentroid(14222)).toBeNull(); // not a string
  });
});
