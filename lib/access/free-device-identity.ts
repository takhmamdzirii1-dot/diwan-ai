import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

function signature(nonce: string, secret: string) {
  return createHmac('sha256', secret).update(`vantra-installation-v1:${nonce}`).digest('base64url');
}

function identityHash(nonce: string) {
  return createHash('sha256').update(`vantra-installation-v1:${nonce}`).digest('hex');
}

export function issueInstallationToken(secret: string) {
  const nonce = randomBytes(32).toString('base64url');
  return { token: `${nonce}.${signature(nonce, secret)}`, identityHash: identityHash(nonce) };
}

export function verifiedInstallationHash(value: string | undefined, secret: string) {
  const match = value?.match(TOKEN_PATTERN);
  if (!match) return null;
  const expected = Buffer.from(signature(match[1], secret), 'base64url');
  const received = Buffer.from(match[2], 'base64url');
  return received.length === expected.length && timingSafeEqual(received, expected)
    ? identityHash(match[1]) : null;
}

export function deviceProofMac(secret: string, userId: string, installationHash: string,
  challenge: string, expires: number) {
  return createHmac('sha256', secret)
    .update(`vantra-device-proof-v1:${userId}:${installationHash}:${challenge}:${expires}`)
    .digest('base64url');
}

export function verifiedBrowserKeyHash(spkiBase64url: string, signatureBase64url: string, challenge: string) {
  try {
    const spki = Buffer.from(spkiBase64url, 'base64url');
    const publicKey = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
      || !verify('sha256', Buffer.from(challenge, 'base64url'),
        { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signatureBase64url, 'base64url'))) {
      return null;
    }
    return createHash('sha256').update(spki).digest('hex');
  } catch { return null; }
}
