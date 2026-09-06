import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { credentialIdHash } from '../core/passkey-envelope.js';
import { PASSKEY_BINDING_SCHEMA } from '../core/passkey-metadata.js';
import {
  preparePasskeyUserOperationTransport,
  sendPreparedPasskeyUserOperation,
} from '../core/passkey-entrypoint-transport.js';
import { base64urlEncode } from '../core/passkeys.js';

const account = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const entryPoint = '0x3333333333333333333333333333333333333333';
const capabilityRegistry = '0x4444444444444444444444444444444444444444';
const target = '0x5555555555555555555555555555555555555555';
const rpId = 'wallet.420.example';
const origin = 'https://wallet.420.example';
const userOpHash = `0x${'66'.repeat(32)}`;
const driftHash = `0x${'77'.repeat(32)}`;
const txHash = `0x${'88'.repeat(32)}`;
const zeroAddress = `0x${'00'.repeat(20)}`;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const boolWord = (value) => `0x${word(value ? 1 : 0)}`;
const uintResult = (value) => `0x${word(value)}`;
const addressResult = (value) => `0x${addressWord(value)}`;
const successResult = `0x${word(1)}${word(64)}${word(0)}`;
const credentialBytes = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
const credentialId = base64urlEncode(credentialBytes);

function binding(overrides = {}) {
  return {
    schema: PASSKEY_BINDING_SCHEMA,
    credentialId,
    credentialIdHash: credentialIdHash(credentialId),
    publicKeyX: `0x${'11'.repeat(32)}`,
    publicKeyY: `0x${'22'.repeat(32)}`,
    smartAccount: account,
    authorizationEpoch: '1',
    rpId,
    origin,
    transports: ['internal'],
    signCount: '0',
    ...overrides,
  };
}

function smartAccountState(overrides = {}) {
  return {
    deployed: true,
    smartAccount: account,
    owner,
    controller: owner,
    controllerIsOwner: true,
    entryPoint,
    capabilityRegistry,
    authorizationEpoch: 1n,
    authorizationPolicyVersion: 1n,
    pendingRecoveryOwner: zeroAddress,
    recoveryExecutableAt: 0n,
    recoveryAuthority: zeroAddress,
    ...overrides,
  };
}

function assertionCredential(hash = userOpHash, overrides = {}) {
  const challenge = base64urlEncode(Uint8Array.from(Buffer.from(hash.slice(2), 'hex')));
  const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
  const rpHash = createHash('sha256').update(rpId).digest();
  const authenticatorData = Buffer.concat([rpHash, Buffer.from([0x05, 0, 0, 0, 1])]);
  const signature = Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
  return {
    type: 'public-key',
    id: credentialId,
    rawId: credentialBytes.buffer,
    response: {
      clientDataJSON: client,
      authenticatorData,
      signature,
      userHandle: null,
    },
    ...overrides,
  };
}

function navigatorFor(providerState, credentialFactory = () => assertionCredential()) {
  return {
    credentials: {
      create: async () => { throw new Error('unexpected credentials.create'); },
      get: async () => {
        const credential = credentialFactory();
        if (providerState.afterCeremony) providerState.afterCeremony();
        return credential;
      },
    },
  };
}

function makeProvider(overrides = {}) {
  const state = {
    active: true,
    epoch: 1n,
    nonce: 0n,
    entryPoint,
    canonicalReads: 0,
    calls: [],
    afterCeremony: null,
    ...overrides,
  };
  const provider = {
    state,
    request: async (method, params = []) => {
      state.calls.push({ method, params });
      if (method === 'personal_sign') throw new Error('personal_sign must never be used by passkey transport');
      if (method === 'eth_getCode') return '0x6001';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_sendTransaction') return txHash;
      if (method !== 'eth_call') throw new Error(`unexpected RPC method ${method}`);

      const data = params[0]?.data || '';
      if (data.startsWith('0x22cdde4c')) {
        state.canonicalReads += 1;
        if (state.hashDrift && state.canonicalReads > 1) return driftHash;
        return userOpHash;
      }
      if (data.startsWith('0x9eec012b')) return successResult;
      if (data.startsWith('0xd86f2b3c')) return uintResult(state.nonce);
      if (data === '0x8da5cb5b') return addressResult(owner);
      if (data === '0x8a957938') return addressResult(zeroAddress);
      if (data === '0x6d5f87be') return uintResult(state.epoch);
      if (data === '0x7d5366f4') return uintResult(1n);
      if (data === '0xe5f1af38') return addressResult(zeroAddress);
      if (data === '0x93261b5b') return uintResult(0n);
      if (data === '0xb0d691fe') return addressResult(state.entryPoint);
      if (data === '0xc9de3b48') return addressResult(capabilityRegistry);
      if (/^0x[0-9a-f]{8}[0-9a-f]{64}$/i.test(data)) return boolWord(state.active);
      throw new Error(`unexpected eth_call selector ${data.slice(0, 10)}`);
    },
  };
  return provider;
}

const request = { target, value: 0n, data: '0x12345678' };

test('W7.10 prepares and submits a PK42 owner-lane UserOperation without personal_sign', async () => {
  const provider = makeProvider();
  const prepared = await preparePasskeyUserOperationTransport(
    provider,
    navigatorFor(provider.state),
    smartAccountState(),
    binding(),
    request,
  );
  assert.equal(prepared.signerType, 'passkey');
  assert.equal(prepared.nonceKey, 0n);
  assert.equal(prepared.userOpHash, userOpHash);
  assert.ok(prepared.signature.startsWith('0x504b3432'));
  assert.equal(prepared.userOperation.signature, prepared.signature);
  assert.equal(prepared.entryPointSimulation.simulationPassed, true);
  assert.equal(prepared.advancedBinding.signCount, '1');

  const submitted = await sendPreparedPasskeyUserOperation(provider, prepared, owner);
  assert.equal(submitted.submitted, true);
  assert.equal(submitted.txHash, txHash);
  assert.equal(provider.state.calls.some((call) => call.method === 'personal_sign'), false);
});

test('W7.10 fails closed if the credential is revoked during the WebAuthn ceremony', async () => {
  const provider = makeProvider();
  provider.state.afterCeremony = () => { provider.state.active = false; };
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state), smartAccountState(), binding(), request),
    /passkey credential is not active/i,
  );
});

test('W7.10 fails closed if authorizationEpoch changes during the WebAuthn ceremony', async () => {
  const provider = makeProvider();
  provider.state.afterCeremony = () => { provider.state.epoch = 2n; };
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state), smartAccountState(), binding(), request),
    /authorization epoch changed/i,
  );
});

test('W7.10 fails closed if the owner nonce changes during the WebAuthn ceremony', async () => {
  const provider = makeProvider();
  provider.state.afterCeremony = () => { provider.state.nonce = 1n; };
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state), smartAccountState(), binding(), request),
    /owner nonce changed during passkey ceremony/i,
  );
});

test('W7.10 fails closed if the canonical UserOperation hash drifts after the WebAuthn ceremony', async () => {
  const provider = makeProvider({ hashDrift: true });
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state), smartAccountState(), binding(), request),
    /canonical user operation hash changed during passkey ceremony/i,
  );
});

test('W7.10 rejects a WebAuthn assertion with the wrong origin before PK42 construction', async () => {
  const provider = makeProvider();
  const badCredential = () => {
    const credential = assertionCredential();
    credential.response.clientDataJSON = Buffer.from(JSON.stringify({
      type: 'webauthn.get',
      challenge: base64urlEncode(Uint8Array.from(Buffer.from(userOpHash.slice(2), 'hex'))),
      origin: 'https://evil.example',
      crossOrigin: false,
    }));
    return credential;
  };
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state, badCredential), smartAccountState(), binding(), request),
    /WebAuthn origin mismatch/i,
  );
});

test('W7.10 rejects malformed P-256 DER signatures before EntryPoint simulation', async () => {
  const provider = makeProvider();
  const malformed = () => {
    const credential = assertionCredential();
    credential.response.signature = Buffer.from([0x30, 0x01, 0x00]);
    return credential;
  };
  await assert.rejects(
    preparePasskeyUserOperationTransport(provider, navigatorFor(provider.state, malformed), smartAccountState(), binding(), request),
    /invalid P-256 DER signature/i,
  );
  assert.equal(provider.state.calls.some((call) => call.method === 'eth_estimateGas'), false);
});

test('W7.10 revalidates credential activity immediately before broadcast', async () => {
  const provider = makeProvider();
  const prepared = await preparePasskeyUserOperationTransport(
    provider,
    navigatorFor(provider.state),
    smartAccountState(),
    binding(),
    request,
  );
  provider.state.active = false;
  await assert.rejects(sendPreparedPasskeyUserOperation(provider, prepared, owner), /passkey credential is not active/i);
  assert.equal(provider.state.calls.some((call) => call.method === 'eth_sendTransaction'), false);
});
