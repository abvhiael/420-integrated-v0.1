import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_OPERATION_HANDLED_TOPIC,
  confirmEntryPointUserOperation,
  revalidatePreparedSession,
} from '../core/entrypoint-transport.js';
import { SESSION_EXECUTE_CAPABILITY_420 } from '../core/capabilities.js';

const account = '0x1111111111111111111111111111111111111111';
const signer = '0x2222222222222222222222222222222222222222';
const owner = '0x3333333333333333333333333333333333333333';
const target = '0x4444444444444444444444444444444444444444';
const entryPoint = '0x5555555555555555555555555555555555555555';
const registry = '0x0000000000000000000000000000000000000421';
const scope = `0x${'66'.repeat(32)}`;
const grantId = `0x${'77'.repeat(32)}`;
const otherGrantId = `0x${'88'.repeat(32)}`;
const component = `0x${'99'.repeat(32)}`;
const hash = `0x${'aa'.repeat(32)}`;
const signature = `0x${'bb'.repeat(65)}`;
const txHash = `0x${'cc'.repeat(32)}`;
const nonceKey = BigInt(signer);
const nonce = nonceKey << 64n;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const bytes32Word = (value) => value.slice(2);
const response = (...words) => `0x${words.join('')}`;
const addressTopic = (value) => `0x${addressWord(value)}`;

function prepared(overrides = {}) {
  return {
    signer,
    target,
    selector: '0x12345678',
    spendAmount: 42n,
    scopeHash: scope,
    activeGrantId: grantId,
    authorizationEpoch: 7n,
    nonce,
    nonceKey,
    entryPoint,
    userOpHash: hash,
    txHash,
    userOperation: {
      sender: account,
      nonce,
      initCode: '0x',
      callData: '0xefff7e19',
      accountGasLimits: `0x${'00'.repeat(32)}`,
      preVerificationGas: 0n,
      gasFees: `0x${'00'.repeat(32)}`,
      paymasterAndData: '0x',
      signature,
    },
    broadcastReady: true,
    entryPointSimulation: { simulationPassed: true },
    ...overrides,
  };
}

function accountStateProvider({ epoch = 7n, keyEpoch = 7n, activeGrant = grantId, authorized = true } = {}) {
  return {
    request: async (method, params = []) => {
      if (method === 'eth_getCode') return '0x6001';
      if (method !== 'eth_call') throw new Error(`unexpected method ${method}`);
      const selector = params[0].data.slice(0, 10);
      if (selector === '0x8da5cb5b') return `0x${addressWord(owner)}`;
      if (selector === '0x8a957938') return `0x${'0'.repeat(64)}`;
      if (selector === '0x6d5f87be') return `0x${word(epoch)}`;
      if (selector === '0x7d5366f4') return `0x${word(1)}`;
      if (selector === '0xe5f1af38') return `0x${'0'.repeat(64)}`;
      if (selector === '0x93261b5b') return `0x${word(0)}`;
      if (selector === '0xb0d691fe') return `0x${addressWord(entryPoint)}`;
      if (selector === '0xc9de3b48') return `0x${addressWord(registry)}`;
      if (selector === '0xd557e335') return `0x${word(keyEpoch)}`;
      if (selector === '0xfdb3c749') return scope;
      if (selector === '0x2b081d1d') return component;
      if (selector === '0xfabe3409') return activeGrant;
      if (selector === '0x918e9de3') {
        return response(
          addressWord(signer),
          bytes32Word(component),
          bytes32Word(SESSION_EXECUTE_CAPABILITY_420),
          bytes32Word(scope),
          word(1000), word(5000), word(3600), word(0), word(0), word(0),
        );
      }
      if (selector === '0x4a8f2a54') return response(word(1), word(0));
      if (selector === '0x1e4129c9') return `0x${word(authorized ? 1 : 0)}`;
      if (selector === '0xd86f2b3c') return `0x${word(nonce)}`;
      throw new Error(`unexpected selector ${selector}`);
    },
  };
}

test('recovery-driven authorization epoch drift invalidates an already signed delegated operation', async () => {
  await assert.rejects(
    revalidatePreparedSession(accountStateProvider({ epoch: 8n }), prepared()),
    /authorization epoch changed after user operation preparation/i,
  );
});

test('revoked session keys are detected during the final pre-broadcast revalidation', async () => {
  await assert.rejects(
    revalidatePreparedSession(accountStateProvider({ keyEpoch: 0n }), prepared()),
    /session key was revoked or invalidated/i,
  );
});

test('active grant replacement invalidates stale signed user operations', async () => {
  await assert.rejects(
    revalidatePreparedSession(accountStateProvider({ activeGrant: otherGrantId }), prepared()),
    /active session grant changed/i,
  );
});

test('receipt confirmation rejects ambiguous duplicate UserOperationHandled evidence', async () => {
  const log = {
    address: entryPoint,
    topics: [USER_OPERATION_HANDLED_TOPIC, hash, addressTopic(account), `0x${word(nonceKey)}`],
    data: `0x${word(0)}${word(1)}`,
  };
  const provider = { request: async (method) => {
    if (method === 'eth_getTransactionReceipt') return { status: '0x1', logs: [log, { ...log }] };
    throw new Error(method);
  } };
  await assert.rejects(confirmEntryPointUserOperation(provider, prepared(), { attempts: 1 }), /ambiguous duplicate/i);
});

test('receipt confirmation rejects malformed execution-success words instead of guessing', async () => {
  const provider = { request: async (method) => {
    if (method === 'eth_getTransactionReceipt') return {
      status: '0x1',
      logs: [{
        address: entryPoint,
        topics: [USER_OPERATION_HANDLED_TOPIC, hash, addressTopic(account), `0x${word(nonceKey)}`],
        data: `0x${word(0)}${word(2)}`,
      }],
    };
    throw new Error(method);
  } };
  await assert.rejects(confirmEntryPointUserOperation(provider, prepared(), { attempts: 1 }), /malformed EntryPoint420 UserOperationHandled success value/i);
});
