import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import type { KeyLike } from 'jose';
import { verifyIdToken } from '../../src/lib/auth/verify';

// The ID-token check is the trust boundary of the whole login. These tests prove
// it accepts a genuine token and REJECTS the ways an attacker would forge one:
// wrong audience, wrong issuer, expired, or signed by the wrong key.

const ISSUER = 'https://id.test/realms/bas';
const AUD = 'access-atlas';

async function makeToken(
  key: KeyLike,
  overrides: { iss?: string; aud?: string; sub?: string; expSecs?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ acr: '1' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(overrides.sub ?? 'user-123')
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUD)
    .setIssuedAt(now)
    .setExpirationTime(now + (overrides.expSecs ?? 300))
    .sign(key);
}

describe('verifyIdToken', () => {
  it('accepts a valid token and returns the sub + acr', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await makeToken(privateKey);
    const id = await verifyIdToken(token, publicKey, { issuer: ISSUER, audience: AUD });
    expect(id.sub).toBe('user-123');
    expect(id.acr).toBe('1');
  });

  it('rejects a wrong audience', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await makeToken(privateKey, { aud: 'some-other-app' });
    await expect(
      verifyIdToken(token, publicKey, { issuer: ISSUER, audience: AUD }),
    ).rejects.toThrow();
  });

  it('rejects a wrong issuer', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await makeToken(privateKey, { iss: 'https://evil/realms/x' });
    await expect(
      verifyIdToken(token, publicKey, { issuer: ISSUER, audience: AUD }),
    ).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await makeToken(privateKey, { expSecs: -10 });
    await expect(
      verifyIdToken(token, publicKey, { issuer: ISSUER, audience: AUD }),
    ).rejects.toThrow();
  });

  it('rejects a token signed by a different key', async () => {
    const signer = await generateKeyPair('RS256');
    const impostor = await generateKeyPair('RS256');
    const token = await makeToken(signer.privateKey);
    await expect(
      verifyIdToken(token, impostor.publicKey, { issuer: ISSUER, audience: AUD }),
    ).rejects.toThrow();
  });
});
