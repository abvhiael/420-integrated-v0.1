import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import {
  MAX_BATCH_CALLS,
  MAX_BATCH_CALLDATA_BYTES,
  encodeExecuteBatch,
  normalizeBatchCalls,
  prepareSmartAccountBatch,
  sendSmartAccountBatch,
} from '../core/batch-execution.js';

const controller = '0x1111111111111111111111111111111111111111';
const account = '0x2222222222222222222222222222222222222222';
const factory = '0x0000000000000000000000000000000000000420';
const registry = '0x0000000000000000000000000000000000000421';
const entryPoint = '0x000000000000000000000000000000000000041f';
const targetA = '0x3333333333333333333333333333333333333333';
const targetB = '0x4444444444444444444444444444444444444444';
const txHash = `0x${'ab'.repeat(32)}`;
const wordAddress = (a) => `0x${'0'.repeat(24)}${a.slice(2)}`;
const wordUint = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;

const state = {
  controller,
  factoryAddress: factory,
  smartAccount: account,
  deployed: true,
  owner: controller,
  controllerIsOwner: true,
  recoveryAuthority: ZERO_ADDRESS,
  entryPoint,
  capabilityRegistry: registry,
  authorizationEpoch: 7n,
  salt: ZERO_BYTES32,
};

test('executeBatch ABI uses canonical SmartAccount420 selector and dynamic tuple array encoding', () => {
  const data = encodeExecuteBatch([
    { target: targetA, value: 1n, data: '0x1234' },
    { target: targetB, value: 2n, data: '0xabcd' },
  ]);
  assert.equal(data.slice(0, 10), '0x34fcd5be');
  assert.equal(BigInt(`0x${data.slice(10, 74)}`), 32n);
  assert.equal(BigInt(`0x${data.slice(74, 138)}`), 2n);
  assert.equal(BigInt(`0x${data.slice(138, 202)}`), 64n);
  assert.match(data, /1234/);
  assert.match(data, /abcd/);
});

test('batch normalization enforces non-empty bounded batches and aggregate accounting', () => {
  assert.throws(() => normalizeBatchCalls(state, []), /at least one call/i);
  assert.throws(() => normalizeBatchCalls(state, Array.from({ length: MAX_BATCH_CALLS + 1 }, () => ({ target: targetA }))), /call wallet limit/i);
  const normalized = normalizeBatchCalls(state, [
    { target: targetA, value: '4', data: '0x1234' },
    { target: targetB, value: '20', data: '0xabcdef' },
  ]);
  assert.equal(normalized.totalValue, 24n);
  assert.equal(normalized.totalCalldataBytes, 5);
});

test('batch normalization blocks wallet authority targets in any position', () => {
  for (const denied of [account, factory, entryPoint, registry]) {
    assert.throws(() => normalizeBatchCalls(state, [
      { target: targetA, value: 0, data: '0x' },
      { target: denied, value: 0, data: '0x' },
    ]), /wallet authority contract/i);
  }
});

test('aggregate calldata limit fails closed', () => {
  const perCallBytes = 4096;
  const payload = `0x${'11'.repeat(perCallBytes)}`;
  const callCount = Math.floor(MAX_BATCH_CALLDATA_BYTES / perCallBytes) + 1;
  assert.ok(callCount <= MAX_BATCH_CALLS);
  assert.throws(() => normalizeBatchCalls(state, Array.from({ length: callCount }, (_, index) => ({
    target: index % 2 === 0 ? targetA : targetB,
    data: payload,
  }))), /aggregate batch calldata/i);
});

test('prepare batch requires owner boundary and simulates before readiness', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return '0x';
    if (method === 'eth_estimateGas') return '0x12345';
    throw new Error(method);
  } };
  await assert.rejects(
    prepareSmartAccountBatch(provider, controller, { ...state, controllerIsOwner: false }, [{ target: targetA }]),
    /not the on-chain/i,
  );
  const prepared = await prepareSmartAccountBatch(provider, controller, state, [
    { target: targetA, value: 1, data: '0x1234' },
    { target: targetB, value: 2, data: '0xabcd' },
  ]);
  assert.equal(prepared.transaction.data.slice(0, 10), '0x34fcd5be');
  assert.equal(prepared.totalValue, 3n);
  assert.equal(prepared.simulation.passed, true);
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_estimateGas']);
});

test('owner or authorization epoch drift after batch simulation blocks broadcast', async () => {
  let sends = 0;
  const provider = { request: async (method, params) => {
    if (method === 'eth_call') {
      if (params[0]?.data === '0x8da5cb5b') return wordAddress(controller);
      if (params[0]?.data === '0x6d5f87be') return wordUint(8);
      return '0x';
    }
    if (method === 'eth_estimateGas') return '0x12345';
    if (method === 'eth_sendTransaction') { sends += 1; return txHash; }
    throw new Error(method);
  } };
  await assert.rejects(
    sendSmartAccountBatch(provider, controller, state, [{ target: targetA, value: 1, data: '0x' }]),
    /authorization epoch changed after batch simulation/i,
  );
  assert.equal(sends, 0);
});

test('qualified batch requests explicit provider transaction approval only after simulation and revalidation', async () => {
  const methods = [];
  const provider = { request: async (method, params) => {
    methods.push(method);
    if (method === 'eth_call') {
      if (params[0]?.data === '0x8da5cb5b') return wordAddress(controller);
      if (params[0]?.data === '0x6d5f87be') return wordUint(7);
      return '0x';
    }
    if (method === 'eth_estimateGas') return '0x12345';
    if (method === 'eth_sendTransaction') return txHash;
    throw new Error(method);
  } };
  const submitted = await sendSmartAccountBatch(provider, controller, state, [
    { target: targetA, value: 4, data: '0x1234' },
    { target: targetB, value: 20, data: '0xabcd' },
  ]);
  assert.equal(submitted.txHash, txHash);
  assert.deepEqual(methods, ['eth_call', 'eth_estimateGas', 'eth_call', 'eth_call', 'eth_sendTransaction']);
});
