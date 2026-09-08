import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePushReference420, normalizePushRegistration420, rehydratePushAuthorization420 } from '../core/push-authorization.js';

const now = 1_800_000_000_000;
const account = '0x1111111111111111111111111111111111111111';
const reference = { origin: 'https://dapp.example', requestId: 'request-1234', expiresAt: now + 60_000 };

function request(overrides = {}) {
  return {
    id: 'request-1234',
    origin: 'https://dapp.example',
    method: 'eth_sendTransaction',
    params: [],
    account,
    chainId: '0x420',
    authorizationEpoch: 7,
    ...overrides,
  };
}

test('push reference is reference-only, https-bound and expiry-bounded', () => {
  assert.deepEqual(normalizePushReference420(reference, { nowMs: now }), reference);
  assert.throws(() => normalizePushReference420({ ...reference, signature: '0xdead' }, { nowMs: now }), /forbidden field/);
  assert.throws(() => normalizePushReference420({ ...reference, origin: 'http://dapp.example' }, { nowMs: now }), /must use https/);
  assert.throws(() => normalizePushReference420({ ...reference, expiresAt: now - 1 }, { nowMs: now }), /expired/);
});

test('APNs and FCM registration tokens are normalized without wallet authority', () => {
  assert.equal(normalizePushRegistration420({ platform: 'apns', token: 'abcdef0123456789abcdef0123456789' }).platform, 'apns');
  assert.equal(normalizePushRegistration420({ platform: 'fcm', token: 'fcm:abcdef0123456789-token' }).platform, 'fcm');
  assert.throws(() => normalizePushRegistration420({ platform: 'other', token: 'abcdef0123456789' }), /unsupported/);
});

test('foreground push rehydration revalidates origin, request, account, chain and authorization epoch', async () => {
  const result = await rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request(),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  });
  assert.equal(result.request.id, reference.requestId);
  assert.equal(result.securityContext.account, account);

  await assert.rejects(() => rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request({ origin: 'https://evil.example' }),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  }), /origin mismatch/);
  await assert.rejects(() => rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request({ id: 'request-9999' }),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  }), /request id mismatch/);
  await assert.rejects(() => rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request({ account: '0x2222222222222222222222222222222222222222' }),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  }), /account drift/);
  await assert.rejects(() => rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request({ chainId: '0x421' }),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  }), /chain drift/);
  await assert.rejects(() => rehydratePushAuthorization420(reference, {
    nowMs: now,
    fetchRequest: async () => request({ authorizationEpoch: 8 }),
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  }), /authorization epoch drift/);
});
