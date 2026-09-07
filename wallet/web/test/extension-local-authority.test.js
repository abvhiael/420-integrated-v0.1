import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionLocalAuthority420, serializeExtensionUserOperation420 } from '../core/extension-local-authority.js';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const SMART = '0x2222222222222222222222222222222222222222';

function baseAuthority(overrides = {}) {
  return createExtensionLocalAuthority420({
    provider: { request: async () => { throw new Error('unexpected provider request'); } },
    navigatorLike: { credentials: { get: async () => ({}) } },
    smartAccountConfig: { factoryAddress: '0x3333333333333333333333333333333333333333' },
    loadPasskeyBinding: async () => null,
    persistPasskeyBinding: async () => {},
    ...overrides,
  });
}

test('generic message signing fails closed without a local ECDSA authority', async () => {
  const authority = baseAuthority();
  await assert.rejects(
    authority({ method: 'personal_sign', params: ['0x1234', ACCOUNT] }, { accounts: [ACCOUNT] }),
    /RPC fallback is forbidden/,
  );
});

test('typed-data signing fails closed without a local ECDSA authority', async () => {
  const authority = baseAuthority();
  await assert.rejects(
    authority({ method: 'eth_signTypedData_v4', params: [ACCOUNT, '{}'] }, { accounts: [ACCOUNT] }),
    /RPC fallback is forbidden/,
  );
});

test('configured local message signer receives only an origin-granted account', async () => {
  let seen;
  const authority = baseAuthority({ signMessage: async (input) => { seen = input; return '0xsigned'; } });
  const result = await authority(
    { method: 'personal_sign', params: ['0x1234', ACCOUNT] },
    { accounts: [ACCOUNT], origin: 'https://dapp.example' },
  );
  assert.equal(result, '0xsigned');
  assert.equal(seen.account, ACCOUNT);
  assert.equal(seen.context.origin, 'https://dapp.example');
});

test('local signer cannot use an account that is not granted to the origin', async () => {
  const authority = baseAuthority({ signMessage: async () => '0xsigned' });
  await assert.rejects(
    authority(
      { method: 'personal_sign', params: ['0x1234', '0x4444444444444444444444444444444444444444'] },
      { accounts: [ACCOUNT] },
    ),
    /not granted to this origin/,
  );
});

test('UserOperation serialization emits RPC quantities and preserves signed envelope', () => {
  const serialized = serializeExtensionUserOperation420({
    sender: SMART,
    nonce: 4n,
    initCode: '0x',
    callData: '0x1234',
    accountGasLimits: `0x${'0'.repeat(64)}`,
    preVerificationGas: 21000n,
    gasFees: `0x${'0'.repeat(64)}`,
    paymasterAndData: '0x',
    signature: '0xdeadbeef',
  });
  assert.equal(serialized.nonce, '0x4');
  assert.equal(serialized.preVerificationGas, '0x5208');
  assert.equal(serialized.signature, '0xdeadbeef');
});
