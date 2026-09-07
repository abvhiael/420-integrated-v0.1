import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileRuntimeAdapter420 } from '../core/runtime-adapter.js';
import { prepareMobileSmartAccountCreation420, sendMobileSmartAccountCreation420 } from '../core/account-bootstrap.js';

function runtimeWithoutSubmit() {
  return createMobileRuntimeAdapter420({
    rpc: async () => { throw new Error('unexpected RPC'); },
    secureStorage: { get: async () => null, set: async () => {}, delete: async () => {} },
    passkeys: { create: async () => ({}), get: async () => ({}) },
    openExternalUrl: async () => {},
  });
}

test('mobile account bootstrap requires native transaction submission before discovery', async () => {
  await assert.rejects(
    prepareMobileSmartAccountCreation420({ runtime: runtimeWithoutSubmit(), controller: '0x1111111111111111111111111111111111111111', config: {} }),
    /native transaction submission capability required/,
  );
});

test('mobile account creation send fails closed without qualified preparation', async () => {
  const runtime = createMobileRuntimeAdapter420({
    rpc: async () => '0x',
    secureStorage: { get: async () => null, set: async () => {}, delete: async () => {} },
    passkeys: { create: async () => ({}), get: async () => ({}) },
    transaction: { submit: async () => `0x${'2'.repeat(64)}` },
    openExternalUrl: async () => {},
  });
  await assert.rejects(
    sendMobileSmartAccountCreation420({ runtime, prepared: { alreadyDeployed: false, broadcastReady: false, simulationPassed: false } }),
    /qualified mobile SmartAccount420 creation required/,
  );
});
