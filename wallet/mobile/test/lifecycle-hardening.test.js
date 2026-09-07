import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffMobileLifecycleSnapshot420,
  hardenMobileResume420,
} from '../core/lifecycle-hardening.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';

function runtimeWithStore(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    secureStorage: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async set(key, value) { store.set(key, value); },
      async delete(key) { store.delete(key); },
    },
    store,
  };
}

test('first mobile resume does not invalidate auth state', () => {
  const diff = diffMobileLifecycleSnapshot420(null, { chainId: '0x1a4', accounts: [A], authorizationEpoch: 1n });
  assert.equal(diff.firstRun, true);
  assert.equal(diff.invalidateSessions, false);
  assert.equal(diff.invalidatePasskey, false);
});

test('chain change invalidates sessions and passkey state', () => {
  const diff = diffMobileLifecycleSnapshot420(
    { chainId: '0x1a4', accounts: [A], authorizationEpoch: 1n },
    { chainId: '0x1a5', accounts: [A], authorizationEpoch: 1n },
  );
  assert.equal(diff.chainChanged, true);
  assert.equal(diff.invalidateSessions, true);
  assert.equal(diff.invalidatePasskey, true);
});

test('account or authorization epoch change invalidates stale auth', () => {
  const accountDiff = diffMobileLifecycleSnapshot420(
    { chainId: '0x1a4', accounts: [A], authorizationEpoch: 1n },
    { chainId: '0x1a4', accounts: [B], authorizationEpoch: 1n },
  );
  assert.equal(accountDiff.accountsChanged, true);
  assert.equal(accountDiff.invalidateSessions, true);

  const epochDiff = diffMobileLifecycleSnapshot420(
    { chainId: '0x1a4', accounts: [A], authorizationEpoch: 1n },
    { chainId: '0x1a4', accounts: [A], authorizationEpoch: 2n },
  );
  assert.equal(epochDiff.authorizationEpochChanged, true);
  assert.equal(epochDiff.invalidatePasskey, true);
});

test('resume handlers are invoked before snapshot refresh', async () => {
  const runtime = runtimeWithStore({
    'wallet.lifecycle.snapshot.v1': { chainId: '0x1a4', accounts: [A], authorizationEpoch: '1', passkeyCredentialIdHash: null },
  });
  const calls = [];
  const diff = await hardenMobileResume420(runtime, {
    chainId: '0x1a4', accounts: [A], authorizationEpoch: 2n, passkeyCredentialIdHash: null,
  }, {
    async invalidateSessions() { calls.push('sessions'); },
    async invalidatePasskey() { calls.push('passkey'); },
  });
  assert.equal(diff.authorizationEpochChanged, true);
  assert.deepEqual(calls, ['sessions', 'passkey']);
  assert.equal(runtime.store.get('wallet.lifecycle.snapshot.v1').authorizationEpoch, '2');
});
