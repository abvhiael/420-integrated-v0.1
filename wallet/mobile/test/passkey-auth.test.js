import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMobilePasskeyExecution420, sendMobilePasskeyExecution420 } from '../core/passkey-auth.js';

const account = '0x1111111111111111111111111111111111111111';
const entryPoint = '0x2222222222222222222222222222222222222222';

function runtime(overrides = {}) {
  return {
    request: async () => { throw new Error('unexpected rpc'); },
    passkeys: { get: async () => ({}) },
    ...overrides,
  };
}

test('rejects missing mobile runtime', async () => {
  await assert.rejects(() => prepareMobilePasskeyExecution420({}), /mobile runtime adapter required/);
});

test('rejects malformed passkey binding before native ceremony', async () => {
  await assert.rejects(() => prepareMobilePasskeyExecution420({
    runtime: runtime(),
    smartAccountState: { deployed: true, smartAccount: account, entryPoint },
    binding: { credentialId: '', credentialIdHash: '0x0', rpId: '', origin: 'http://example.com' },
    request: { target: '0x3333333333333333333333333333333333333333' },
  }), /passkey credential id required/);
});

test('send requires a prepared passkey execution', async () => {
  await assert.rejects(() => sendMobilePasskeyExecution420({ runtime: runtime(), prepared: { signerType: 'owner' } }), /prepared mobile passkey execution required/);
});
