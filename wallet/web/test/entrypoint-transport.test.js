import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_OPERATION_HANDLED_TOPIC,
  confirmEntryPointUserOperation,
  decodeHandleOpSuccess,
  encodeGetUserOpHash,
  encodeHandleOp,
  prepareEntryPointTransport,
} from '../core/entrypoint-transport.js';

const account = '0x1111111111111111111111111111111111111111';
const signer = '0x2222222222222222222222222222222222222222';
const entryPoint = '0x3333333333333333333333333333333333333333';
const hash = `0x${'44'.repeat(32)}`;
const signature = `0x${'55'.repeat(65)}`;
const zero32 = `0x${'00'.repeat(32)}`;
const nonceKey = BigInt(signer);
const nonce = nonceKey << 64n;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressTopic = (value) => `0x${value.slice(2).padStart(64, '0')}`;
const successResult = `0x${word(1)}${word(64)}${word(0)}`;

function userOperation(overrides = {}) {
  return {
    sender: account,
    nonce,
    initCode: '0x',
    callData: '0xefff7e19',
    accountGasLimits: zero32,
    preVerificationGas: 0n,
    gasFees: zero32,
    paymasterAndData: '0x',
    signature: '0x',
    ...overrides,
  };
}

function preflight() {
  return {
    signer,
    nonce,
    nonceKey,
    callData: '0xefff7e19',
    userOperation: userOperation(),
    broadcastReady: false,
    blockReason: 'production EntryPoint420 submission/hash transport is not frozen',
  };
}

test('EntryPoint420 transport uses the frozen getUserOpHash and handleOp selectors with canonical tuple ABI', () => {
  const hashData = encodeGetUserOpHash(userOperation());
  const handleData = encodeHandleOp(userOperation({ signature }));
  assert.equal(hashData.slice(0, 10), '0x22cdde4c');
  assert.equal(handleData.slice(0, 10), '0x9eec012b');
  assert.equal(hashData.slice(10, 74), word(32));
  assert.equal(handleData.slice(10, 74), word(32));
  assert.ok(handleData.length > hashData.length);
});

test('handleOp simulation decoder distinguishes target execution success from validation transport success', () => {
  assert.equal(decodeHandleOpSuccess(successResult), true);
  assert.equal(decodeHandleOpSuccess(`0x${word(0)}${word(64)}${word(0)}`), false);
  assert.throws(() => decodeHandleOpSuccess('0x01'), /invalid EntryPoint420 handleOp simulation result/i);
});

test('qualified transport obtains canonical hash, requests session-key signature, and simulates signed handleOp before broadcast readiness', async () => {
  const calls = [];
  const provider = { request: async (method, params = []) => {
    calls.push({ method, params });
    if (method === 'eth_accounts') return [signer];
    if (method === 'personal_sign') {
      assert.deepEqual(params, [hash, signer]);
      return signature;
    }
    if (method === 'eth_call') {
      const data = params[0].data;
      if (data.startsWith('0x22cdde4c')) return hash;
      if (data.startsWith('0x9eec012b')) return successResult;
      throw new Error(`unexpected eth_call ${data.slice(0, 10)}`);
    }
    if (method === 'eth_estimateGas') return '0x5208';
    throw new Error(method);
  } };
  const prepared = await prepareEntryPointTransport(provider, { smartAccount: account, entryPoint }, signer, preflight());
  assert.equal(prepared.userOpHash, hash);
  assert.equal(prepared.signature, signature);
  assert.equal(prepared.userOperation.signature, signature);
  assert.equal(prepared.broadcastReady, true);
  assert.equal(prepared.entryPointSimulation.simulationPassed, true);
  assert.equal(prepared.entryPointSimulation.gas, '0x5208');
  assert.ok(calls.some((call) => call.method === 'personal_sign'));
  assert.ok(calls.some((call) => call.method === 'eth_estimateGas'));
});

test('transport fails closed when the session signer is not exposed by the connected wallet', async () => {
  const provider = { request: async (method) => method === 'eth_accounts' ? [] : (() => { throw new Error(method); })() };
  await assert.rejects(
    prepareEntryPointTransport(provider, { smartAccount: account, entryPoint }, signer, preflight()),
    /session signer is not available/i,
  );
});

test('confirmation requires canonical UserOperationHandled success and exact nonce advancement', async () => {
  const submitted = {
    ...preflight(),
    entryPoint,
    userOpHash: hash,
    txHash: `0x${'66'.repeat(32)}`,
    userOperation: userOperation({ signature }),
    broadcastReady: true,
  };
  const receipt = {
    status: '0x1',
    logs: [{
      address: entryPoint,
      topics: [USER_OPERATION_HANDLED_TOPIC, hash, addressTopic(account), `0x${word(nonceKey)}`],
      data: `0x${word(0)}${word(1)}`,
    }],
  };
  const provider = { request: async (method, params = []) => {
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_call' && params[0].data.startsWith('0xd86f2b3c')) return `0x${word(nonce + 1n)}`;
    throw new Error(method);
  } };
  const confirmed = await confirmEntryPointUserOperation(provider, submitted, { attempts: 1 });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.handled.success, true);
  assert.equal(confirmed.nonceAfter, nonce + 1n);
});

test('confirmation surfaces execution failure even though EntryPoint420 consumed the nonce to prevent replay', async () => {
  const submitted = {
    ...preflight(),
    entryPoint,
    userOpHash: hash,
    txHash: `0x${'77'.repeat(32)}`,
    userOperation: userOperation({ signature }),
    broadcastReady: true,
  };
  const receipt = {
    status: '0x1',
    logs: [{
      address: entryPoint,
      topics: [USER_OPERATION_HANDLED_TOPIC, hash, addressTopic(account), `0x${word(nonceKey)}`],
      data: `0x${word(0)}${word(0)}`,
    }],
  };
  const provider = { request: async (method, params = []) => {
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_call' && params[0].data.startsWith('0xd86f2b3c')) return `0x${word(nonce + 1n)}`;
    throw new Error(method);
  } };
  await assert.rejects(confirmEntryPointUserOperation(provider, submitted, { attempts: 1 }), /consumed the session nonce to prevent replay/i);
});
