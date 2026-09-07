import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileDappConnection420, normalizeMobileDappRequest420, parseMobileDappLink420 } from '../core/dapp-connection.js';

const account = '0x1111111111111111111111111111111111111111';
const target = '0x2222222222222222222222222222222222222222';

test('mobile dApp links require https origin and request id', () => {
  const parsed = parseMobileDappLink420('https://wallet.example/connect?origin=https%3A%2F%2Fdapp.example&requestId=req-1');
  assert.equal(parsed.origin, 'https://dapp.example');
  assert.equal(parsed.requestId, 'req-1');
  assert.throws(() => parseMobileDappLink420('http://wallet.example/connect?origin=https%3A%2F%2Fdapp.example&requestId=req-1'), /must use https/);
});

test('request origin must match connection origin', () => {
  assert.throws(() => normalizeMobileDappRequest420({
    id: 'req-1', origin: 'https://evil.example', method: 'eth_chainId', params: [],
  }, 'https://dapp.example'), /origin mismatch/);
});

test('read methods bypass approval but signing methods require canonical classified review first', async () => {
  const calls = [];
  const connection = createMobileDappConnection420({
    rpcRequest: async (method, _params, context) => { calls.push(['rpc', method, context.authorityClass]); return '0x420'; },
    requestApproval: async (request, context) => {
      calls.push(['approval', request.method, context.origin, context.authorityClass, context.signingReview?.kind]);
      return 'approved';
    },
    accountsFor: async () => [account],
  });
  assert.equal(await connection.handle({ id: '1', origin: 'https://dapp.example', method: 'eth_chainId', params: [] }), '0x420');
  assert.equal(await connection.handle({ id: '2', origin: 'https://dapp.example', method: 'eth_sendTransaction', params: [{ from: account, to: target, value: '0x0' }] }), 'approved');
  assert.deepEqual(calls, [
    ['rpc', 'eth_chainId', 'read-only'],
    ['rpc', 'eth_chainId', 'read-only'],
    ['approval', 'eth_sendTransaction', 'https://dapp.example', 'owner-transaction', 'native-transfer'],
  ]);
});

test('mobile typed-data chain mismatch fails before approval', async () => {
  let approved = false;
  const connection = createMobileDappConnection420({
    rpcRequest: async () => '0x420',
    requestApproval: async () => { approved = true; return 'never'; },
    accountsFor: async () => [account],
  });
  const typed = JSON.stringify({ domain: { chainId: '0x421' }, types: {}, message: {} });
  await assert.rejects(() => connection.handle({ id: 'typed-1', origin: 'https://dapp.example', method: 'eth_signTypedData_v4', params: [account, typed] }), (error) => error?.code === 4901);
  assert.equal(approved, false);
});

test('unknown signing methods fail closed before RPC or approval dispatch', async () => {
  let dispatched = false;
  const connection = createMobileDappConnection420({
    rpcRequest: async () => { dispatched = true; },
    requestApproval: async () => { dispatched = true; },
    accountsFor: async () => [account],
  });
  await assert.rejects(() => connection.handle({ id: '3', origin: 'https://dapp.example', method: 'eth_sign', params: [] }), (error) => error?.code === 4200);
  assert.equal(dispatched, false);
});

test('account access is bound to granted origin accounts', async () => {
  const connection = createMobileDappConnection420({
    rpcRequest: async () => null,
    requestApproval: async () => null,
    accountsFor: async (origin) => origin === 'https://dapp.example' ? [account] : [],
  });
  assert.equal(await connection.assertAccountAccess('https://dapp.example', account), account);
  await assert.rejects(() => connection.assertAccountAccess('https://other.example', account), /not authorized/);
});
