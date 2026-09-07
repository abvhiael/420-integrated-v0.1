import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileRuntimeAdapter420, inspectMobileCapabilities420 } from '../core/runtime-adapter.js';

function capabilities() {
  const calls = [];
  return {
    calls,
    value: {
      platform: 'ios',
      rpc: async (method, params) => { calls.push(['rpc', method, params]); return '0x1'; },
      secureStorage: {
        get: async (key) => { calls.push(['get', key]); return null; },
        set: async (key, value) => { calls.push(['set', key, value]); },
        delete: async (key) => { calls.push(['delete', key]); },
      },
      passkeys: {
        create: async (options) => { calls.push(['passkey-create', options]); return { id: 'credential' }; },
        get: async (options) => { calls.push(['passkey-get', options]); return { signature: 'assertion' }; },
      },
      sessionSigner: { signHash: async (address, hash) => { calls.push(['session-sign', address, hash]); return `0x${'1'.repeat(130)}`; } },
      transaction: { submit: async (transaction) => { calls.push(['submit', transaction]); return `0x${'2'.repeat(64)}`; } },
      openExternalUrl: async (url) => { calls.push(['open', url]); },
    },
  };
}

test('mobile adapter exposes only explicit native capabilities', async () => {
  const fixture = capabilities();
  const adapter = createMobileRuntimeAdapter420(fixture.value);
  assert.equal(adapter.platform, 'ios');
  assert.equal(await adapter.request({ method: 'eth_chainId' }), '0x1');
  await adapter.secureStorage.set('wallet.session', { version: 1 });
  await adapter.passkeys.get({ challenge: 'abc' });
  await adapter.openExternalUrl('https://420.example');
  assert.deepEqual(fixture.calls[0], ['rpc', 'eth_chainId', []]);
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(Object.isFrozen(adapter.secureStorage), true);
  assert.equal(Object.isFrozen(adapter.passkeys), true);
});

test('mobile adapter rejects missing secure/passkey capabilities', () => {
  assert.throws(() => createMobileRuntimeAdapter420({ rpc() {}, secureStorage: {}, passkeys: {}, openExternalUrl() {} }), /secureStorage\.get capability required/);
});

test('mobile adapter rejects non-https external URLs', () => {
  const adapter = createMobileRuntimeAdapter420(capabilities().value);
  assert.throws(() => adapter.openExternalUrl('http://example.com'), /https URL required/);
});

test('mobile RPC transport cannot provide signing authority', async () => {
  const adapter = createMobileRuntimeAdapter420(capabilities().value);
  await assert.rejects(async () => adapter.request({ method: 'personal_sign', params: [`0x${'0'.repeat(64)}`, '0x1111111111111111111111111111111111111111'] }), /cannot provide signing authority/);
  await assert.rejects(async () => adapter.request({ method: 'eth_sendTransaction', params: [{ to: '0x1111111111111111111111111111111111111111' }] }), /cannot provide signing authority/);
});

test('mobile capability inspection is fail-closed', () => {
  assert.deepEqual(inspectMobileCapabilities420({}), {
    rpc: false,
    secureStorage: false,
    passkeys: false,
    sessionSigner: false,
    transactionSubmit: false,
    openExternalUrl: false,
    required: ['rpc', 'secureStorage', 'passkeys', 'openExternalUrl'],
  });
});
