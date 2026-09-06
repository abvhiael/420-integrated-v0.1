import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { credentialIdHash } from '../core/passkey-envelope.js';
import { keccak256Hex } from '../core/keccak.js';
import {
  prepareEnrollPasskey,
  prepareReenrollPasskey,
} from '../core/passkey-management.js';

const account = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const entryPoint = '0x3333333333333333333333333333333333333333';
const capabilityRegistry = '0x0000000000000000000000000000000000000421';
const credentialId = 'AQIDBA';
const publicKeyX = `0x${'11'.repeat(32)}`;
const publicKeyY = `0x${'22'.repeat(32)}`;
const rpId = 'wallet.420.example';
const origin = 'https://wallet.420.example';
const zeroAddress = `0x${'0'.repeat(40)}`;

function state(epoch = 1n, overrides = {}) {
  return {
    smartAccount: account,
    deployed: true,
    owner,
    controller: owner,
    controllerIsOwner: true,
    authorizationEpoch: epoch,
    pendingRecoveryOwner: zeroAddress,
    recoveryExecutableAt: 0n,
    entryPoint,
    capabilityRegistry,
    ...overrides,
  };
}

function binding(epoch = 1n, overrides = {}) {
  return {
    schema: '420-wallet-passkey-binding-v1',
    credentialId,
    credentialIdHash: credentialIdHash(credentialId),
    publicKeyX,
    publicKeyY,
    smartAccount: account,
    authorizationEpoch: String(epoch),
    rpId,
    origin,
    transports: ['internal'],
    signCount: '0',
    ...overrides,
  };
}

function rpHash() {
  return `0x${createHash('sha256').update(Buffer.from(rpId)).digest('hex')}`;
}

function originHash() {
  return keccak256Hex(new TextEncoder().encode(origin));
}

function word(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function credentialResult(epoch, { rp = rpHash(), org = originHash(), x = publicKeyX, y = publicKeyY } = {}) {
  return `0x${word(epoch)}${rp.slice(2)}${org.slice(2)}${x.slice(2)}${y.slice(2)}`;
}

function providerForCredential(result) {
  const calls = [];
  return {
    calls,
    request: async (method, params = []) => {
      calls.push({ method, params });
      if (method === 'eth_call') {
        const data = params[0]?.data || '';
        if (data.length === 74) return result;
        return '0x';
      }
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_sendTransaction') throw new Error('prepare path must not broadcast');
      throw new Error(method);
    },
  };
}

test('fresh passkey enrollment builder validates binding, proves credential absence, and only simulates owner transaction', async () => {
  const provider = providerForCredential(credentialResult(0n, {
    rp: `0x${'00'.repeat(32)}`,
    org: `0x${'00'.repeat(32)}`,
    x: `0x${'00'.repeat(32)}`,
    y: `0x${'00'.repeat(32)}`,
  }));
  const prepared = await prepareEnrollPasskey(provider, owner, state(1n), binding(1n));
  assert.equal(prepared.action, 'enrollPasskey');
  assert.equal(prepared.actor, owner);
  assert.equal(prepared.smartAccount, account);
  assert.equal(prepared.hashes.rpIdHash, rpHash());
  assert.equal(prepared.hashes.originHash, originHash());
  assert.equal(prepared.simulationPassed, true);
  assert.equal(prepared.gas, '0x5208');
  assert.ok(prepared.transaction.data.length > 300);
  assert.equal(provider.calls.some((call) => call.method === 'eth_sendTransaction'), false);
});

test('fresh enrollment rejects a credential already known by SmartAccount420 before simulation', async () => {
  const provider = providerForCredential(credentialResult(1n));
  await assert.rejects(
    prepareEnrollPasskey(provider, owner, state(1n), binding(1n)),
    /credential already exists/i,
  );
  assert.equal(provider.calls.some((call) => call.method === 'eth_estimateGas'), false);
});

test('passkey management is blocked while account recovery is pending', async () => {
  const provider = providerForCredential(credentialResult(0n));
  await assert.rejects(
    prepareEnrollPasskey(provider, owner, state(1n, { pendingRecoveryOwner: '0x4444444444444444444444444444444444444444' }), binding(1n)),
    /blocked while recovery is pending/i,
  );
  assert.equal(provider.calls.length, 0);
});

test('re-enrollment only reactivates stale credential with identical stored RP/origin/P-256 material', async () => {
  const provider = providerForCredential(credentialResult(1n));
  const prepared = await prepareReenrollPasskey(provider, owner, state(2n), binding(1n));
  assert.equal(prepared.action, 'reenrollPasskey');
  assert.equal(prepared.staleCredential.epoch, 1n);
  assert.equal(prepared.validated.authorizationEpoch, 1n);
  assert.equal(prepared.simulationPassed, true);
  assert.ok(prepared.transaction.data.length === 74);
});

test('re-enrollment rejects stale metadata if on-chain public material changed', async () => {
  const provider = providerForCredential(credentialResult(1n, { x: `0x${'99'.repeat(32)}` }));
  await assert.rejects(
    prepareReenrollPasskey(provider, owner, state(2n), binding(1n)),
    /P-256 x coordinate changed/i,
  );
  assert.equal(provider.calls.some((call) => call.method === 'eth_estimateGas'), false);
});

test('re-enrollment refuses current-epoch binding and cannot silently overwrite an active credential', async () => {
  const provider = providerForCredential(credentialResult(2n));
  await assert.rejects(
    prepareReenrollPasskey(provider, owner, state(2n), binding(2n)),
    /requires a stale credential binding/i,
  );
});

test('passkey enrollment builder rejects non-owner actor before any chain mutation attempt', async () => {
  const provider = providerForCredential(credentialResult(0n));
  await assert.rejects(
    prepareEnrollPasskey(provider, '0x5555555555555555555555555555555555555555', state(1n), binding(1n)),
    /not the on-chain SmartAccount420 owner/i,
  );
  assert.equal(provider.calls.length, 0);
});
