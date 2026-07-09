import { describe, it, expect } from 'vitest';
import { challengeFromVerifier, generateVerifier, randomToken } from '../../src/lib/auth/oidc';

// PKCE is the CSRF/interception defense for the public OIDC client. A wrong S256
// derivation silently breaks login, so pin it to the RFC's known-answer vector.
describe('PKCE (RFC 7636, S256)', () => {
  it('derives the RFC 7636 Appendix B challenge for its verifier', () => {
    expect(challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('generates URL-safe verifiers of adequate entropy/length', () => {
    const v = generateVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    expect(v.length).toBeGreaterThanOrEqual(43); // RFC 7636 minimum
  });

  it('randomToken is URL-safe and unique per call', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });
});
