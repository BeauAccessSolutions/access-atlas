import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from '../../src/lib/auth/oidc';

const FALLBACK = '/contribute/submit/';

describe('sanitizeReturnTo', () => {
  it('keeps clean same-origin paths, with query and hash', () => {
    expect(sanitizeReturnTo('/account/')).toBe('/account/');
    expect(sanitizeReturnTo('/contribute/submit/?kind=place')).toBe('/contribute/submit/?kind=place');
    expect(sanitizeReturnTo('/places/?q=cafe&owned=1')).toBe('/places/?q=cafe&owned=1');
  });

  it('falls back on empty / nullish input', () => {
    expect(sanitizeReturnTo(null)).toBe(FALLBACK);
    expect(sanitizeReturnTo(undefined)).toBe(FALLBACK);
    expect(sanitizeReturnTo('')).toBe(FALLBACK);
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('//evil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('http:evil.com')).toBe(FALLBACK);
  });

  // The regression this hardening exists for: a browser normalizes "\" to "/"
  // when parsing a redirect target, so these must NOT survive as a path.
  it('rejects backslash open-redirect bypasses', () => {
    expect(sanitizeReturnTo('/\\evil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('\\/evil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('/\\/evil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('/path\\..\\evil')).toBe(FALLBACK);
  });

  it('rejects control characters a browser might strip into an authority', () => {
    expect(sanitizeReturnTo('/\tevil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('/\nevil.com')).toBe(FALLBACK);
    expect(sanitizeReturnTo('/\r/evil.com')).toBe(FALLBACK);
  });
});
