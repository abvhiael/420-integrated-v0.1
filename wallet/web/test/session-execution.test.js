import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSessionBroadcastDisabled,
  encodeSingleSessionCall,
  prepareSessionExecution,
  readSessionNonce,
  sessionNonceKey,
} from '../core/session-execution.js';
import { SESSION_EXECUTE_CAPABILITY_420 } from '../core/capabilities.js';

const owner = '0x1111111111111111111111111111111111111111';
const account = '0x2222222222222222222222222222222222222222';
const key = '0x3333333333333333333333333333333333333333';
const target = '0x4444444444444444444444444444444444444444';
const registry = '0x0000000000000000000000000000000000000421';
const entryPoint = '0x000000000000000000000000000000000000041f';
const factory = '0x0000000000000000000000000000000000000420';
const component = `0x${'55'.repeat(32)}`;
const scope = `0x${'66'.repeat(32)}`;
const grantId = `0x${'77'.repeat(32)}`;

const uintWord = (n) => BigInt(n).toString(16).padStart(64, '0');
const addressWord = (a) => a.slice(2).padStart(64, '0');
const bytes32Word = (b) => b.slice(2);
const boolWord = (b) => uintWord(b ? 1 : 0);
const response = (...words) => `0x${words.join('')}`;

function smartState(overrides = {}) {
  return {
    deployed: true,
    controllerIsOwner: true,
    owner,
    smartAccount: account,
    factoryAddress: factory,
    capabilityRegistry: registry,
    entryPoint,
    recoveryAuthority: null,
    authorizationEpoch: 7n,
    ...overrides,
  };
}

function grantResponse({ revoked = false, perCallLimit = 1000n, periodLimit = 5000n, periodSeconds = 3600n } = {}) {
  return response(
    addressWord(key),
    bytes32Word(component),
    bytes32Word(SESSION_EXECUTE_CAPABILITY_420),
    bytes32Word(scope),
    uintWord(perCallLimit),
    uintWord(periodLimit),
    uintWord(periodSeconds),
    uintWord(0),
    uintWord(0),
    boolWord(revoked),
  );
}

function providerFor({ keyEpoch = 7n, authorized = true, activeGrant = grantId, revoked = false, nonceSequence = 3n } = {}) {
  const calls = [];
  const nonce = (sessionNonceKey(key) << 64n) | nonceSequence;
  return {
    calls,
    request: async (method, params) => {
      calls.push([method, params]);
      if (method === 'eth_getCode') return '0x6001';
      if (method !== 'eth_call') throw new Error(`unexpected method ${method}`);
      const data = params[0].data;
      const selector = data.slice(0, 10);
      if (selector === '0xd557e335') return `0x${uintWord(keyEpoch)}`;
      if (selector === '0xfdb3c749') return scope;
      if (selector === '0x2b081d1d') return component;
      if (selector === '0xfabe3409') return activeGrant;
      if (selector === '0x918e9de3') return grantResponse({ revoked });
      if (selector === '0x4a8f2a54') return response(uintWord(1), uintWord(100));
      if (selector === '0x1e4129c9') return `0x${boolWord(authorized)}`;
      if (selector === '0xd86f2b3c') return `0x${uintWord(nonce)}`;
      throw new Error(`unexpected selector ${selector}`);
    },
  };
}

test('session nonce key is isolated to the session signer address lane', () => {
  assert.equal(sessionNonceKey(key), BigInt(key));
});

test('encodes a single executeSession envelope without enabling general batch execution', () => {
  const data = encodeSingleSessionCall(key, target, 42n, '0x12345678');
  assert.equal(data.slice(0, 10), '0xefff7e19');
  assert.equal(data.slice(10, 74), addressWord(key));
  assert.equal(data.slice(74, 138), uintWord(64));
  assert.match(data, /12345678/);
});

test('reads the canonical nonce lane through SmartAccount420.nonce(uint192)', async () => {
  const provider = providerFor({ nonceSequence: 9n });
  const nonce = await readSessionNonce(provider, account, key);
  assert.equal(nonce >> 64n, sessionNonceKey(key));
  assert.equal(nonce & ((1n << 64n) - 1n), 9n);
  assert.equal(provider.calls[0][1][0].data.slice(0, 10), '0xd86f2b3c');
});

test('session execution preflight verifies current epoch, active canonical grant, limits, scope, and nonce lane', async () => {
  const provider = providerFor();
  const prepared = await prepareSessionExecution(provider, smartState(), key, { target, value: '420', data: '0x12345678' });
  assert.equal(prepared.signer, key);
  assert.equal(prepared.activeGrantId, grantId);
  assert.equal(prepared.scopeHash, scope);
  assert.equal(prepared.spendAmount, 420n);
  assert.equal(prepared.nonce >> 64n, BigInt(key));
  assert.equal(prepared.callData.slice(0, 10), '0xefff7e19');
  assert.equal(prepared.broadcastReady, false);
  assert.match(prepared.blockReason, /EntryPoint420/i);
});

test('stale authorization epoch fails closed before delegated execution preparation', async () => {
  const provider = providerFor({ keyEpoch: 6n });
  await assert.rejects(prepareSessionExecution(provider, smartState(), key, { target, data: '0x12345678' }), /current authorization epoch/i);
});

test('revoked or missing active grant fails closed', async () => {
  await assert.rejects(prepareSessionExecution(providerFor({ revoked: true }), smartState(), key, { target, data: '0x12345678' }), /invalid/i);
  await assert.rejects(prepareSessionExecution(providerFor({ activeGrant: `0x${'0'.repeat(64)}` }), smartState(), key, { target, data: '0x12345678' }), /no active session execution grant/i);
});

test('capability limit or validity failure blocks session execution', async () => {
  await assert.rejects(prepareSessionExecution(providerFor({ authorized: false }), smartState(), key, { target, value: '999', data: '0x12345678' }), /exceeds capability limits or validity window/i);
});

test('wallet authority targets remain forbidden for delegated sessions', async () => {
  await assert.rejects(prepareSessionExecution(providerFor(), smartState(), key, { target: registry, data: '0x12345678' }), /authority contract/i);
});

test('ERC20 amount parsing prevents native-plus-token spend ambiguity', async () => {
  const transfer = `0xa9059cbb${addressWord(owner)}${uintWord(25)}`;
  await assert.rejects(prepareSessionExecution(providerFor(), smartState(), key, { target, value: '1', data: transfer }), /combine token spend and native value/i);
});

test('broadcast is fail-closed until production EntryPoint420 transport and hashing are frozen', async () => {
  const prepared = await prepareSessionExecution(providerFor(), smartState(), key, { target, data: '0x12345678' });
  assert.throws(() => assertSessionBroadcastDisabled(prepared), /broadcast is disabled/i);
});
