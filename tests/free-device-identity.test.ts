import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { deviceProofMac, issueInstallationToken, verifiedBrowserKeyHash, verifiedInstallationHash } from '../lib/access/free-device-identity';

test('installation tokens are random, signed, and store only a stable hash', () => {
  const secret = 'test-only-server-secret';
  const first = issueInstallationToken(secret);
  const second = issueInstallationToken(secret);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.identityHash, second.identityHash);
  assert.match(first.identityHash, /^[0-9a-f]{64}$/);
  assert.equal(verifiedInstallationHash(first.token, secret), first.identityHash);
  assert.equal(verifiedInstallationHash(first.token, 'wrong-secret'), null);
  const forged = (first.token[0] === 'A' ? 'B' : 'A') + first.token.slice(1);
  assert.equal(verifiedInstallationHash(forged, secret), null);
  assert.equal(verifiedInstallationHash('client-chosen-device-id', secret), null);
});

test('browser key continuity requires a valid private-key signature and account-bound challenge', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const challenge = randomBytes(32).toString('base64url');
  const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  const signature = sign('sha256', Buffer.from(challenge, 'base64url'),
    { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  assert.match(verifiedBrowserKeyHash(spki, signature, challenge) ?? '', /^[0-9a-f]{64}$/);
  assert.equal(verifiedBrowserKeyHash(spki, signature, randomBytes(32).toString('base64url')), null);
  assert.equal(verifiedBrowserKeyHash(spki, randomBytes(64).toString('base64url'), challenge), null);
  const mac = deviceProofMac('secret', 'user-1', 'device-1', challenge, 123);
  assert.notEqual(mac, deviceProofMac('secret', 'user-2', 'device-1', challenge, 123));
  assert.notEqual(mac, deviceProofMac('secret', 'user-1', 'device-2', challenge, 123));
});
