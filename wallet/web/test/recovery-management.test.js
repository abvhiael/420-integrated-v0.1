import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS } from '../core/abi.js';
import {
  confirmCancelRecovery,
  confirmFinalizeRecovery,
  confirmProposeRecovery,
  confirmSetRecoveryAuthority,
  prepareCancelRecovery,
  prepareFinalizeRecovery,
  prepareProposeRecovery,
  prepareSetRecoveryAuthority,
  sendFinalizeRecovery,
} from '../core/recovery-management.js';

const account = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const authority = '0x3333333333333333333333333333333333333333';
const nextAuthority = '0x4444444444444444444444444444444444444444';
const newOwner = '0x5555555555555555555555555555555555555555';
const entryPoint = '0x6666666666666666666666666666666666666666';
const registry = '0x0000000000000000000000000000000000000421';
const txHash = `0x${'ab'.repeat(32)}`;

const wordAddress = (value) => `0x${'0'.repeat(24)}${value.slice(2)}`;
const wordUint = (value) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

function state(overrides = {}) {
  return {
    smartAccount: account,
    deployed: true,
    owner,
    controller: owner,
    controllerIsOwner: true,
    recoveryAuthority: authority,
    authorizationEpoch: 7n,
    authorizationPolicyVersion: 1n,
    pendingRecoveryOwner: ZERO_ADDRESS,
    recoveryExecutableAt: 0n,
    entryPoint,
    capabilityRegistry: registry,
    ...overrides,
  };
}

function stateProvider(after, calls = []) {
  return { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_getTransactionReceipt') return { status: '0x1', transactionHash: txHash };
    if (method === 'eth_getCode') return '0x6001';
    if (method === 'eth_call') {
      const selector = params[0].data.slice(0, 10);
      const results = {
        '0x8da5cb5b': wordAddress(after.owner),
        '0x8a957938': wordAddress(after.recoveryAuthority),
        '0x6d5f87be': wordUint(after.authorizationEpoch),
        '0x7d5366f4': wordUint(after.authorizationPolicyVersion ?? 1n),
        '0xe5f1af38': wordAddress(after.pendingRecoveryOwner),
        '0x93261b5b': wordUint(after.recoveryExecutableAt),
        '0xb0d691fe': wordAddress(after.entryPoint ?? entryPoint),
        '0xc9de3b48': wordAddress(after.capabilityRegistry ?? registry),
      };
      if (results[selector]) return results[selector];
      return '0x';
    }
    if (method === 'eth_estimateGas') return '0x15000';
    if (method === 'eth_sendTransaction') return txHash;
    throw new Error(method);
  } };
}

test('set recovery authority is owner-only, simulated, and uses canonical selector', async () => {
  const calls = [];
  const provider = stateProvider(state(), calls);
  const prepared = await prepareSetRecoveryAuthority(provider, owner, state(), nextAuthority);
  assert.equal(prepared.transaction.data.slice(0, 10), '0x67bdcc3f');
  assert.equal(prepared.transaction.from, owner);
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_estimateGas']);
  await assert.rejects(prepareSetRecoveryAuthority(provider, authority, state(), nextAuthority), /not the on-chain/i);
});

test('set recovery authority post-confirmation verifies authority, pending reset, owner and epoch', async () => {
  const before = state();
  const prepared = { smartAccount: account, actor: owner, newAuthority: nextAuthority, before };
  const after = state({ recoveryAuthority: nextAuthority });
  const confirmed = await confirmSetRecoveryAuthority(stateProvider(after), txHash, prepared, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.smartAccount.recoveryAuthority, nextAuthority);
  assert.equal(confirmed.smartAccount.authorizationEpoch, 7n);
});

test('propose recovery is recovery-authority-only and verifies pending owner after confirmation', async () => {
  const before = state();
  const calls = [];
  const prepared = await prepareProposeRecovery(stateProvider(before, calls), authority, before, newOwner);
  assert.equal(prepared.transaction.data.slice(0, 10), '0x7ee76082');
  assert.equal(prepared.transaction.from, authority);
  assert.match(prepared.transaction.data, new RegExp(`${newOwner.slice(2)}$`));
  await assert.rejects(prepareProposeRecovery(stateProvider(before), owner, before, newOwner), /recovery authority/i);

  const after = state({ pendingRecoveryOwner: newOwner, recoveryExecutableAt: 200000n });
  const confirmed = await confirmProposeRecovery(stateProvider(after), txHash, prepared, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.smartAccount.pendingRecoveryOwner, newOwner);
  assert.equal(confirmed.smartAccount.authorizationEpoch, 7n);
});

test('cancel recovery is owner-only and clears pending state without advancing epoch', async () => {
  const before = state({ pendingRecoveryOwner: newOwner, recoveryExecutableAt: 200000n });
  const prepared = await prepareCancelRecovery(stateProvider(before), owner, before);
  assert.equal(prepared.transaction.data, '0x0ba234d6');
  await assert.rejects(prepareCancelRecovery(stateProvider(before), authority, { ...before, controllerIsOwner: false }), /not the on-chain/i);
  const confirmed = await confirmCancelRecovery(stateProvider(state()), txHash, prepared, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.smartAccount.pendingRecoveryOwner, ZERO_ADDRESS);
  assert.equal(confirmed.smartAccount.authorizationEpoch, 7n);
});

test('finalize recovery requires ready state, recovery authority, and advances epoch exactly once', async () => {
  const before = state({ pendingRecoveryOwner: newOwner, recoveryExecutableAt: 100n });
  const prepared = await prepareFinalizeRecovery(stateProvider(before), authority, before, 101);
  assert.equal(prepared.transaction.data, '0xe2ccb305');
  assert.equal(prepared.expectedOwner, newOwner);
  await assert.rejects(prepareFinalizeRecovery(stateProvider(before), authority, before, 99), /not ready/i);
  await assert.rejects(prepareFinalizeRecovery(stateProvider(before), owner, before, 101), /recovery authority/i);

  const after = state({ owner: newOwner, controller: null, controllerIsOwner: false, pendingRecoveryOwner: ZERO_ADDRESS, recoveryExecutableAt: 0n, authorizationEpoch: 8n });
  const confirmed = await confirmFinalizeRecovery(stateProvider(after), txHash, prepared, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.smartAccount.owner, newOwner);
  assert.equal(confirmed.smartAccount.authorizationEpoch, 8n);
});

test('finalize recovery re-simulates before explicit transaction submission', async () => {
  const before = state({ pendingRecoveryOwner: newOwner, recoveryExecutableAt: 100n });
  const calls = [];
  const submitted = await sendFinalizeRecovery(stateProvider(before, calls), authority, before, 101);
  assert.equal(submitted.txHash, txHash);
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_estimateGas', 'eth_sendTransaction']);
});

test('finalize recovery fails closed if post-confirmation epoch does not advance', async () => {
  const before = state({ pendingRecoveryOwner: newOwner, recoveryExecutableAt: 100n });
  const prepared = { smartAccount: account, actor: authority, expectedOwner: newOwner, before };
  const badAfter = state({ owner: newOwner, pendingRecoveryOwner: ZERO_ADDRESS, recoveryExecutableAt: 0n, authorizationEpoch: 7n });
  await assert.rejects(confirmFinalizeRecovery(stateProvider(badAfter), txHash, prepared, { attempts: 1, delayMs: 0 }), /did not advance authorization epoch/i);
});
