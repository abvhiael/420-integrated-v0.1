import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmSessionManagementTransaction,
  normalizeSessionGrantRequest,
  prepareSessionGrantCreation,
  prepareSessionKeyEnablement,
  prepareSessionKeyRevocation,
  readSessionEpoch,
  readSessionScope,
  sendSessionKeyEnablement,
} from '../core/session-management.js';

const owner = '0x1111111111111111111111111111111111111111';
const account = '0x2222222222222222222222222222222222222222';
const key = '0x3333333333333333333333333333333333333333';
const target = '0x4444444444444444444444444444444444444444';
const factory = '0x0000000000000000000000000000000000000420';
const registry = '0x0000000000000000000000000000000000000421';
const entryPoint = '0x000000000000000000000000000000000000041f';
const scope = `0x${'aa'.repeat(32)}`;
const grantId = `0x${'bb'.repeat(32)}`;
const txHash = `0x${'cc'.repeat(32)}`;
const wordUint = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;

function smartState(overrides = {}) {
  return {
    deployed: true,
    controllerIsOwner: true,
    owner,
    smartAccount: account,
    factoryAddress: factory,
    capabilityRegistry: registry,
    entryPoint,
    recoveryAuthority: '0x5555555555555555555555555555555555555555',
    authorizationEpoch: 7n,
    ...overrides,
  };
}

function providerFor({ sessionEpoch = 0n, scopeHash = scope, simulationResult = '0x', receipt = { status: '0x1' } } = {}) {
  const calls = [];
  return {
    calls,
    request: async (method, params) => {
      calls.push([method, params]);
      if (method === 'eth_call') {
        const data = params[0].data;
        const selector = data.slice(0, 10);
        if (selector === '0xd557e335') return wordUint(sessionEpoch);
        if (selector === '0xfdb3c749') return scopeHash;
        if (selector === '0x388c930c') return simulationResult;
        if (selector === '0x8d08b1a4' || selector === '0x5ae7ab32') return '0x';
        throw new Error(`unexpected call selector ${selector}`);
      }
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_sendTransaction') return txHash;
      if (method === 'eth_getTransactionReceipt') return receipt;
      throw new Error(method);
    },
  };
}

test('reads canonical session epoch and session scope from SmartAccount420', async () => {
  const provider = providerFor({ sessionEpoch: 7n });
  assert.equal(await readSessionEpoch(provider, account, key), 7n);
  assert.equal(await readSessionScope(provider, account, target, '0xa9059cbb'), scope);
  assert.equal(provider.calls[0][1][0].data.slice(0, 10), '0xd557e335');
  assert.equal(provider.calls[1][1][0].data.slice(0, 10), '0xfdb3c749');
});

test('session key enablement is owner-bound, simulated, and uses canonical selector', async () => {
  const provider = providerFor({ sessionEpoch: 0n });
  const prepared = await prepareSessionKeyEnablement(provider, owner, smartState(), key);
  assert.equal(prepared.transaction.from, owner);
  assert.equal(prepared.transaction.to, account);
  assert.equal(prepared.transaction.data.slice(0, 10), '0x8d08b1a4');
  assert.equal(prepared.simulation.passed, true);
});

test('session key enablement rejects an already-enabled key in current authorization epoch', async () => {
  const provider = providerFor({ sessionEpoch: 7n });
  await assert.rejects(prepareSessionKeyEnablement(provider, owner, smartState(), key), /already enabled/i);
});

test('session key enablement rejects owner and recovery authority as session keys', async () => {
  const provider = providerFor();
  await assert.rejects(prepareSessionKeyEnablement(provider, owner, smartState(), owner), /owner cannot/i);
  await assert.rejects(prepareSessionKeyEnablement(provider, owner, smartState(), smartState().recoveryAuthority), /recovery authority/i);
});

test('session key revocation requires a currently enabled key and canonical revoke selector', async () => {
  const provider = providerFor({ sessionEpoch: 7n });
  const prepared = await prepareSessionKeyRevocation(provider, owner, smartState(), key);
  assert.equal(prepared.transaction.data.slice(0, 10), '0x5ae7ab32');
  assert.equal(prepared.previousEpoch, 7n);
});

test('session grant request rejects wallet authority targets and invalid period configuration', () => {
  assert.throws(() => normalizeSessionGrantRequest({ key, target: registry, selector: '0xa9059cbb' }, smartState()), /authority contract/i);
  assert.throws(() => normalizeSessionGrantRequest({ key, target, selector: '0xa9059cbb', periodLimit: 1, periodSeconds: 0 }, smartState()), /both be zero/i);
});

test('session grant creation binds enabled key, target selector, epoch-derived scope and simulated grant id', async () => {
  const provider = providerFor({ sessionEpoch: 7n, simulationResult: grantId });
  const prepared = await prepareSessionGrantCreation(provider, owner, smartState(), {
    key,
    target,
    selector: '0xa9059cbb',
    perCallLimit: '100',
    periodLimit: '1000',
    periodSeconds: '3600',
    validFrom: '10',
    validUntil: '1000',
  });
  assert.equal(prepared.transaction.data.slice(0, 10), '0x388c930c');
  assert.equal(prepared.expectedScope, scope);
  assert.equal(prepared.expectedGrantId, grantId);
  assert.equal(prepared.currentEpoch, 7n);
});

test('session grant creation fails closed when key is from a stale authorization epoch', async () => {
  const provider = providerFor({ sessionEpoch: 6n, simulationResult: grantId });
  await assert.rejects(prepareSessionGrantCreation(provider, owner, smartState(), { key, target, selector: '0xa9059cbb' }), /current authorization epoch/i);
});

test('send enablement uses eth_sendTransaction only after simulation', async () => {
  const provider = providerFor({ sessionEpoch: 0n });
  const sent = await sendSessionKeyEnablement(provider, owner, smartState(), key);
  assert.equal(sent.txHash, txHash);
  assert.equal(provider.calls.some(([method]) => method === 'eth_call'), true);
  assert.equal(provider.calls.some(([method]) => method === 'eth_estimateGas'), true);
  assert.equal(provider.calls.at(-1)[0], 'eth_sendTransaction');
});

test('post-confirmation enablement verifies key epoch matches account authorization epoch', async () => {
  const provider = providerFor({ sessionEpoch: 7n });
  const confirmed = await confirmSessionManagementTransaction(provider, txHash, smartState(), { enabledKey: key }, { attempts: 1, delayMs: 0 });
  assert.equal(confirmed.epoch, 7n);
  assert.equal(confirmed.sessionKey, key);
});

test('post-confirmation revocation fails closed if session epoch is not cleared', async () => {
  const provider = providerFor({ sessionEpoch: 7n });
  await assert.rejects(
    confirmSessionManagementTransaction(provider, txHash, smartState(), { revokedKey: key }, { attempts: 1, delayMs: 0 }),
    /revocation failed/i,
  );
});
