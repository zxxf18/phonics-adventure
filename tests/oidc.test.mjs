import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { verifyIDToken, issuer, clientId } from '../app/auth/oidc.ts';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key' };
const originalFetch = globalThis.fetch;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims, signingKey = privateKey) {
  const body = `${encode({ alg: 'RS256', kid: key.kid })}.${encode(claims)}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), signingKey).toString('base64url')}`;
}

test('Casdoor ID tokens accept OIDC audiences and reject invalid identities', async t => {
  globalThis.fetch = async url => {
    if (url === `${issuer}/.well-known/openid-configuration`) return Response.json({ jwks_uri: `${issuer}/test-jwks` });
    if (url === `${issuer}/test-jwks`) return Response.json({ keys: [key] });
    throw new Error('unexpected request');
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const now = Math.floor(Date.now() / 1000);
  const valid = { iss: issuer, aud: clientId, azp: clientId, sub: 'test-user', nonce: 'test-nonce', exp: now + 600, nbf: now - 1, iat: now - 1, email: 'user@example.test', email_verified: true };
  for (const aud of [clientId, [clientId], [clientId, 'other-service']]) {
    await t.test(`accept audience ${JSON.stringify(aud)}`, async () => {
      const result = await verifyIDToken(token({ ...valid, aud }), valid.nonce);
      assert.equal(result.sub, valid.sub);
    });
  }
  const invalid = {
    'wrong audience': { aud: ['another-client'] },
    'empty audience': { aud: [] },
    'missing audience': { aud: undefined },
    'invalid audience type': { aud: [clientId, 42] },
    'wrong authorized party': { azp: 'another-client' },
    'multiple audiences without authorized party': { aud: [clientId, 'other'], azp: undefined },
    'wrong nonce': { nonce: 'wrong' },
    'missing subject': { sub: undefined },
    'empty subject': { sub: ' ' },
    'missing expiry': { exp: undefined },
    'expired token': { exp: now - 1 },
    'string expiry': { exp: String(now + 600) },
    'not yet valid': { nbf: now + 600 },
    'future issued time': { iat: now + 600 },
    'unverified email': { email_verified: false },
    'missing verification': { email_verified: undefined },
    'string false verification': { email_verified: 'false' },
    'empty email': { email: ' ' },
    'wrong issuer': { iss: 'https://wrong.example.test' },
  };
  for (const [name, patch] of Object.entries(invalid)) {
    await t.test(`reject ${name}`, () => assert.rejects(verifyIDToken(token({ ...valid, ...patch }), valid.nonce)));
  }
  await t.test('reject wrong signature', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await assert.rejects(verifyIDToken(token(valid, other.privateKey), valid.nonce));
  });
});
