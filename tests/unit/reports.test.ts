import { afterEach, describe, expect, it } from 'vitest';
import {
  PHOTO_REPORT_REASONS,
  normalizeReportReason,
  safeReturnTo,
} from '../../src/lib/reports';
import { contributionsOpen } from '../../src/lib/contributor';

describe('reports: reason codes are a fixed allow-list (§6 — no free text)', () => {
  it('accepts every advertised reason code', () => {
    for (const r of PHOTO_REPORT_REASONS) {
      expect(normalizeReportReason(r.code)).toBe(r.code);
    }
  });

  it('rejects unknown / missing / non-string reasons', () => {
    expect(normalizeReportReason('spam')).toBe(null);
    expect(normalizeReportReason('')).toBe(null);
    expect(normalizeReportReason(undefined)).toBe(null);
    expect(normalizeReportReason(42)).toBe(null);
    // A code that isn't in the enum must not slip through.
    expect(normalizeReportReason('OFF_TOPIC')).toBe(null);
  });
});

describe('reports: safeReturnTo blocks open redirects', () => {
  it('keeps a same-origin absolute path', () => {
    expect(safeReturnTo('/places/abc', '/')).toBe('/places/abc');
    expect(safeReturnTo('/providers/x?y=1', '/')).toBe('/providers/x?y=1');
  });

  it('falls back for anything that could leave the origin', () => {
    expect(safeReturnTo('//evil.example', '/')).toBe('/'); // protocol-relative
    expect(safeReturnTo('/\\evil.example', '/')).toBe('/'); // backslash trick
    expect(safeReturnTo('https://evil.example', '/')).toBe('/');
    expect(safeReturnTo('javascript:alert(1)', '/')).toBe('/');
    expect(safeReturnTo('', '/fallback')).toBe('/fallback');
    expect(safeReturnTo(undefined, '/fallback')).toBe('/fallback');
  });
});

describe('reports: contributionsOpen gate', () => {
  const prev = process.env.ALLOW_PROVISIONAL_CONTRIBUTIONS;
  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_PROVISIONAL_CONTRIBUTIONS;
    else process.env.ALLOW_PROVISIONAL_CONTRIBUTIONS = prev;
  });

  it('is closed by default (no auth configured, provisional off) — reporting stays hidden', () => {
    delete process.env.ALLOW_PROVISIONAL_CONTRIBUTIONS;
    expect(contributionsOpen()).toBe(false);
  });

  it('opens when provisional contributions are explicitly enabled', () => {
    process.env.ALLOW_PROVISIONAL_CONTRIBUTIONS = 'true';
    expect(contributionsOpen()).toBe(true);
  });
});
