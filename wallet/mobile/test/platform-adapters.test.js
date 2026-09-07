import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosPlatformAdapter420, createAndroidPlatformAdapter420 } from '../core/platform-adapters.js';

function bridge() {
  return {
    rpc: async (method) => method,
    secureStorage: { get: async () => null, set: async () => {}, delete: async () => {} },
    passkeys: { create: async () => ({}), get: async () => ({}) },
    openExternalUrl: async () => {},
    lifecycle: { onResume: () => () => {}, onPause: () => () => {} },
  };
}

test('iOS adapter exposes qualified runtime and lifecycle', async () => {
  const adapter = createIosPlatformAdapter420(bridge());
  assert.equal(adapter.platform, 'ios');
  assert.equal(await adapter.runtime.request({ method: 'eth_chainId', params: [] }), 'eth_chainId');
  assert.equal(typeof adapter.lifecycle.onResume(() => {}), 'function');
});

test('Android adapter exposes qualified runtime and fails closed on missing lifecycle', () => {
  const adapter = createAndroidPlatformAdapter420(bridge());
  assert.equal(adapter.platform, 'android');
  const bad = bridge();
  delete bad.lifecycle.onResume;
  assert.throws(() => createAndroidPlatformAdapter420(bad), /onResume capability required/);
});
