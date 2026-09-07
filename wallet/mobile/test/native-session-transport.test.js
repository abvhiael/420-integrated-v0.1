import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileRuntimeAdapter420, createMobileProvider420 } from '../core/runtime-adapter.js';
import { prepareNativeMobileSessionTransport420, sendNativeMobileSessionTransport420 } from '../core/native-session-transport.js';

function baseCapabilities(overrides = {}) {
  return {
    rpc: async () => { throw new Error('unexpected RPC'); },
    secureStorage: { get: async () => null, set: async () => {}, delete: async () => {} },
    passkeys: { create: async () => ({}), get: async () => ({}) },
    sessionSigner: { signHash: async () => `0x${'1'.repeat(130)}` },
    transaction: { submit: async () => `0x${'2'.repeat(64)}` },
    openExternalUrl: async () => {},
    ...overrides,
  };
}

test('native session transport fails closed without native signer capability before RPC', async () => {
  const runtime = createMobileRuntimeAdapter420(baseCapabilities({ sessionSigner: {} }));
  await assert.rejects(
    prepareNativeMobileSessionTransport420({ runtime, provider: createMobileProvider420(runtime), smartAccountState: { deployed: true }, sessionKey: '0x1111111111111111111111111111111111111111' }),
    /native non-exportable session signer capability required/,
  );
});

test('native session transport fails closed without native transaction submission', async () => {
  const runtime = createMobileRuntimeAdapter420(baseCapabilities({ transaction: {} }));
  await assert.rejects(
    prepareNativeMobileSessionTransport420({ runtime, provider: createMobileProvider420(runtime), smartAccountState: { deployed: true }, sessionKey: '0x1111111111111111111111111111111111111111' }),
    /native transaction submission capability required/,
  );
});

test('native session send rejects browser/RPC prepared operations', async () => {
  const runtime = createMobileRuntimeAdapter420(baseCapabilities());
  await assert.rejects(
    sendNativeMobileSessionTransport420({ runtime, provider: createMobileProvider420(runtime), prepared: { broadcastReady: true, entryPointSimulation: { simulationPassed: true } } }),
    /prepared native mobile session execution required/,
  );
});
