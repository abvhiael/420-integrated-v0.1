import assert from 'node:assert/strict';
import test from 'node:test';
import { createApprovedExtensionExecution420 } from '../core/extension-execution-bridge.js';

const A = '0x0000000000000000000000000000000000000420';
const B = '0x0000000000000000000000000000000000000421';

function provider() {
  return { request: async () => { throw new Error('unexpected provider call'); } };
}

test('personal_sign only signs for an account granted to the requesting origin', async () => {
  const seen = [];
  const execute = createApprovedExtensionExecution420({
    provider: provider(),
    smartAccountConfig: {},
    signMessage: async (input) => { seen.push(input); return '0xsigned'; },
    signTypedData: async () => '0xtyped',
  });
  const result = await execute({ method: 'personal_sign', params: ['0x1234', A] }, { origin: 'https://dapp.example', accounts: [A] });
  assert.equal(result, '0xsigned');
  assert.equal(seen[0].account, A.toLowerCase());
  assert.equal(seen[0].message, '0x1234');
});

test('rejects personal_sign for an account not granted to the origin', async () => {
  const execute = createApprovedExtensionExecution420({
    provider: provider(),
    smartAccountConfig: {},
    signMessage: async () => '0xnever',
    signTypedData: async () => '0xnever',
  });
  await assert.rejects(
    execute({ method: 'personal_sign', params: ['0x1234', B] }, { origin: 'https://dapp.example', accounts: [A] }),
    (error) => error.code === 4100,
  );
});

test('eth_signTypedData_v4 preserves the granted signer and exact payload', async () => {
  const seen = [];
  const execute = createApprovedExtensionExecution420({
    provider: provider(),
    smartAccountConfig: {},
    signMessage: async () => '0xmessage',
    signTypedData: async (input) => { seen.push(input); return '0xtyped'; },
  });
  const typedData = JSON.stringify({ domain: { name: '420' }, types: {}, message: {} });
  assert.equal(await execute({ method: 'eth_signTypedData_v4', params: [A, typedData] }, { accounts: [A] }), '0xtyped');
  assert.equal(seen[0].account, A.toLowerCase());
  assert.equal(seen[0].typedData, typedData);
});

test('approved execution fails closed without an origin account grant', async () => {
  const execute = createApprovedExtensionExecution420({
    provider: provider(),
    smartAccountConfig: {},
    signMessage: async () => '0xnever',
    signTypedData: async () => '0xnever',
  });
  await assert.rejects(execute({ method: 'personal_sign', params: ['0x00', A] }, { accounts: [] }), (error) => error.code === 4100);
});

test('unsupported approved methods fail with EIP-1193 4200', async () => {
  const execute = createApprovedExtensionExecution420({
    provider: provider(),
    smartAccountConfig: {},
    signMessage: async () => '0xnever',
    signTypedData: async () => '0xnever',
  });
  await assert.rejects(execute({ method: 'wallet_getPermissions', params: [] }, { accounts: [A] }), (error) => error.code === 4200);
});
