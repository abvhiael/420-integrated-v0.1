import test from 'node:test';
import assert from 'node:assert/strict';
import { createPushDeliveryCoordinator420, createPushReplayGuard420, normalizePushDelivery420 } from '../core/push-delivery.js';

const now = 1_800_000_000_000;
const account = '0x1111111111111111111111111111111111111111';
const reference = { origin: 'https://dapp.example', requestId: 'request-1234', expiresAt: now + 60_000 };
const canonical = {
  id: 'request-1234', origin: 'https://dapp.example', method: 'eth_sendTransaction', params: [],
  account, chainId: '0x420', authorizationEpoch: 7,
};

for (const state of ['foreground', 'background', 'terminated']) {
  test(`${state} push converges on canonical rehydration before approval`, async () => {
    const coordinator = createPushDeliveryCoordinator420({
      nowMs: () => now,
      fetchRequest: async ({ origin, requestId }) => {
        assert.equal(origin, reference.origin);
        assert.equal(requestId, reference.requestId);
        return canonical;
      },
      securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
    });
    const result = await coordinator.activate({ state, reference });
    assert.equal(result.state, state);
    assert.equal(result.request.id, reference.requestId);
  });
}

test('unknown delivery states fail closed', () => {
  assert.throws(() => normalizePushDelivery420({ state: 'silent-execute', reference }, { nowMs: now }), /invalid push delivery state/);
});

test('duplicate push reference is rejected before a second canonical fetch', async () => {
  let fetches = 0;
  const coordinator = createPushDeliveryCoordinator420({
    nowMs: () => now,
    fetchRequest: async () => { fetches += 1; return canonical; },
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  });
  await coordinator.activate({ state: 'background', reference });
  await assert.rejects(() => coordinator.activate({ state: 'foreground', reference }), /replay rejected/);
  assert.equal(fetches, 1);
});

test('stale push is rejected before canonical fetch', async () => {
  let fetches = 0;
  const stale = { ...reference, expiresAt: now - 1 };
  const coordinator = createPushDeliveryCoordinator420({
    nowMs: () => now,
    fetchRequest: async () => { fetches += 1; return canonical; },
    securityContext: async () => ({ account, chainId: '0x420', authorizationEpoch: 7 }),
  });
  await assert.rejects(() => coordinator.activate({ state: 'terminated', reference: stale }), /expired/);
  assert.equal(fetches, 0);
});

test('replay guard releases entries after expiry but expired references still fail closed', () => {
  let clock = now;
  const guard = createPushReplayGuard420({ nowMs: () => clock });
  assert.equal(guard.consume(reference).requestId, reference.requestId);
  assert.throws(() => guard.consume(reference), /replay rejected/);
  clock = reference.expiresAt + 1;
  assert.throws(() => guard.consume(reference), /expired/);
});
