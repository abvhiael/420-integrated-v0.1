import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeExecute, ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import { confirmSmartAccountExecution, normalizeCallData, normalizeNativeValue, prepareSmartAccountExecution, sendSmartAccountExecution } from '../core/execution.js';

const controller = '0x1111111111111111111111111111111111111111';
const factory = '0x0000000000000000000000000000000000000420';
const account = '0x3333333333333333333333333333333333333333';
const registry = '0x4444444444444444444444444444444444444444';
const entryPoint = '0x5555555555555555555555555555555555555555';
const target = '0x6666666666666666666666666666666666666666';
const txHash = `0x${'cd'.repeat(32)}`;
const wordAddress = (a) => `0x${'0'.repeat(24)}${a.slice(2)}`;
const wordUint = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;

const accountState = {
  controller,
  factoryAddress: factory,
  smartAccount: account,
  deployed: true,
  owner: controller,
  controllerIsOwner: true,
  recoveryAuthority: ZERO_ADDRESS,
  entryPoint,
  capabilityRegistry: registry,
  salt: ZERO_BYTES32,
};

function readResult(selector) {
  const results = {
    '0x8da5cb5b': wordAddress(controller),
    '0x8a957938': wordAddress(ZERO_ADDRESS),
    '0x6d5f87be': wordUint(1),
    '0x7d5366f4': wordUint(1),
    '0xe5f1af38': wordAddress(ZERO_ADDRESS),
    '0x93261b5b': wordUint(0),
    '0xb0d691fe': wordAddress(entryPoint),
    '0xc9de3b48': wordAddress(registry),
  };
  return results[selector];
}

test('execute ABI uses SmartAccount420 execute selector and dynamic bytes encoding', () => {
  const data = encodeExecute(target, 42n, '0x1234');
  assert.equal(data.slice(0, 10), '0xb61d27f6');
  assert.equal(data.slice(10, 74).endsWith(target.slice(2)), true);
  assert.equal(BigInt(`0x${data.slice(74, 138)}`), 42n);
  assert.equal(BigInt(`0x${data.slice(138, 202)}`), 96n);
  assert.equal(BigInt(`0x${data.slice(202, 266)}`), 2n);
});

test('execution input normalization rejects malformed calldata and negative value', () => {
  assert.equal(normalizeCallData('0x1234'), '0x1234');
  assert.equal(normalizeNativeValue('42'), 42n);
  assert.throws(() => normalizeCallData('0x123'));
  assert.throws(() => normalizeNativeValue('-1'));
});

test('prepare execution requires deployed account owned by connected controller', async () => {
  const provider = { request: async () => { throw new Error('should not call provider'); } };
  await assert.rejects(prepareSmartAccountExecution(provider, controller, { ...accountState, controllerIsOwner: false }, { target, value: 0, data: '0x' }), /not the on-chain/i);
  await assert.rejects(prepareSmartAccountExecution(provider, controller, { ...accountState, deployed: false }, { target, value: 0, data: '0x' }), /must be deployed/i);
});

test('prepare execution blocks direct calls to wallet authority contracts', async () => {
  const provider = { request: async () => { throw new Error('should not call provider'); } };
  for (const denied of [account, factory, entryPoint, registry]) {
    await assert.rejects(prepareSmartAccountExecution(provider, controller, accountState, { target: denied, value: 0, data: '0x' }), /authority contract/i);
  }
});

test('prepare execution simulates before producing an executable transaction', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return '0x';
    if (method === 'eth_estimateGas') return '0x5208';
    throw new Error(method);
  } };
  const prepared = await prepareSmartAccountExecution(provider, controller, accountState, { target, value: '42', data: '0x1234' });
  assert.equal(prepared.transaction.from, controller);
  assert.equal(prepared.transaction.to, account);
  assert.equal(prepared.transaction.value, '0x0');
  assert.equal(prepared.transaction.data.slice(0, 10), '0xb61d27f6');
  assert.equal(prepared.simulation.passed, true);
  assert.equal(prepared.simulation.gas, '0x5208');
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_estimateGas']);
});

test('simulation failure prevents transaction submission', async () => {
  let sends = 0;
  const provider = { request: async (method) => {
    if (method === 'eth_call') throw new Error('target reverted');
    if (method === 'eth_sendTransaction') { sends += 1; return txHash; }
    throw new Error(method);
  } };
  await assert.rejects(sendSmartAccountExecution(provider, controller, accountState, { target, value: 0, data: '0x' }), /simulation reverted/i);
  assert.equal(sends, 0);
});

test('send execution re-simulates then requests explicit provider transaction approval', async () => {
  const calls = [];
  let sent;
  const provider = { request: async (method, params) => {
    calls.push(method);
    if (method === 'eth_call') return '0x';
    if (method === 'eth_estimateGas') return '0x10000';
    if (method === 'eth_sendTransaction') { sent = params[0]; return txHash; }
    throw new Error(method);
  } };
  const submitted = await sendSmartAccountExecution(provider, controller, accountState, { target, value: 1, data: '0xabcd' });
  assert.equal(submitted.txHash, txHash);
  assert.equal(sent.to, account);
  assert.equal(sent.from, controller);
  assert.deepEqual(calls, ['eth_call', 'eth_estimateGas', 'eth_sendTransaction']);
});

test('confirmed execution re-reads owner boundary after successful receipt', async () => {
  const provider = { request: async (method, params) => {
    if (method === 'eth_getTransactionReceipt') return { status: '0x1', transactionHash: txHash };
    if (method === 'eth_getCode') return '0x6001';
    if (method === 'eth_call') {
      const selector = params[0].data.slice(0, 10);
      if (selector === '0x49d27e27') return wordAddress(account);
      return readResult(selector);
    }
    throw new Error(method);
  } };
  const confirmed = await confirmSmartAccountExecution(provider, txHash, controller, { factoryAddress: factory, recoveryAuthority: ZERO_ADDRESS, salt: ZERO_BYTES32 }, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.smartAccount.controllerIsOwner, true);
});

test('confirmed execution fails closed on reverted receipt', async () => {
  const provider = { request: async (method) => method === 'eth_getTransactionReceipt' ? { status: '0x0' } : (() => { throw new Error(method); })() };
  await assert.rejects(confirmSmartAccountExecution(provider, txHash, controller, { factoryAddress: factory }, { attempts: 1, delayMs: 0 }), /reverted/i);
});
