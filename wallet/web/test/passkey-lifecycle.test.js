import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerP256Passkey } from '../core/passkey-p256-browser.js';
import { createPasskeyCredentialBinding } from '../core/passkey-metadata.js';
import {
  sendEnrollPasskey,
  confirmEnrollPasskey,
  sendReenrollPasskey,
  confirmReenrollPasskey,
} from '../core/passkey-management.js';
import {
  preparePasskeyUserOperationTransport,
  sendPreparedPasskeyUserOperation,
} from '../core/passkey-entrypoint-transport.js';
import { base64urlEncode, buildPasskeyChallenge } from '../core/passkeys.js';
import { keccak256Hex } from '../core/keccak.js';

const account = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const recoveredOwner = '0x6666666666666666666666666666666666666666';
const entryPoint = '0x3333333333333333333333333333333333333333';
const capabilityRegistry = '0x4444444444444444444444444444444444444444';
const target = '0x5555555555555555555555555555555555555555';
const zeroAddress = `0x${'00'.repeat(20)}`;
const rpId = 'wallet.420.example';
const origin = 'https://wallet.420.example';
const registrationChallenge = `0x${'12'.repeat(32)}`;
const userOpHash = `0x${'34'.repeat(32)}`;
const rawCredentialId = Uint8Array.from([1, 2, 3, 4]);
const credentialId = base64urlEncode(rawCredentialId);
const x = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const y = Uint8Array.from({ length: 32 }, (_, index) => 0x80 + index);
const publicKeyX = `0x${Array.from(x, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
const publicKeyY = `0x${Array.from(y, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const uintResult = (value) => `0x${word(value)}`;
const addressResult = (value) => `0x${addressWord(value)}`;
const boolResult = (value) => uintResult(value ? 1n : 0n);
const successResult = `0x${word(1)}${word(64)}${word(0)}`;
const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const selector = (signature) => keccak256Hex(new TextEncoder().encode(signature)).slice(2, 10);
const enrollSelector = selector('enrollPasskey(bytes32,bytes32,bytes32,uint256,uint256)');
const reenrollSelector = selector('reenrollPasskey(bytes32)');
const credentialSelector = selector('passkeyCredential(bytes32)');
const activeSelector = selector('isPasskeyActive(bytes32)');

function spki() {
  return Uint8Array.from([
    0x30, 0x59, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x03, 0x42, 0x00, 0x04,
    ...x,
    ...y,
  ]);
}

function registrationCredential() {
  const challenge = base64urlEncode(buildPasskeyChallenge(registrationChallenge));
  const client = new TextEncoder().encode(JSON.stringify({
    type: 'webauthn.create', challenge, origin, crossOrigin: false,
  }));
  return {
    id: credentialId,
    rawId: asBuffer(rawCredentialId),
    type: 'public-key',
    response: {
      clientDataJSON: asBuffer(client),
      attestationObject: asBuffer(Uint8Array.from([0xa3, 0x01, 0x02])),
      getTransports: () => ['internal'],
      getPublicKeyAlgorithm: () => -7,
      getPublicKey: () => asBuffer(spki()),
    },
  };
}

function assertionCredential(signCount) {
  const challenge = base64urlEncode(Uint8Array.from(Buffer.from(userOpHash.slice(2), 'hex')));
  const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
  const rpHash = createHash('sha256').update(rpId).digest();
  const authenticatorData = Buffer.concat([
    rpHash,
    Buffer.from([0x05, (signCount >>> 24) & 0xff, (signCount >>> 16) & 0xff, (signCount >>> 8) & 0xff, signCount & 0xff]),
  ]);
  return {
    type: 'public-key',
    id: credentialId,
    rawId: asBuffer(rawCredentialId),
    response: {
      clientDataJSON: client,
      authenticatorData,
      signature: Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]),
      userHandle: null,
    },
  };
}

function accountState(provider, controller = provider.state.owner) {
  return {
    deployed: true,
    smartAccount: account,
    owner: provider.state.owner,
    controller,
    controllerIsOwner: controller === provider.state.owner,
    recoveryAuthority: zeroAddress,
    authorizationEpoch: provider.state.epoch,
    authorizationPolicyVersion: 1n,
    pendingRecoveryOwner: zeroAddress,
    recoveryExecutableAt: 0n,
    entryPoint,
    capabilityRegistry,
  };
}

function credentialRecord(provider) {
  if (provider.state.credentialEpoch === 0n) return `0x${word(0)}${'0'.repeat(64 * 4)}`;
  return `0x${word(provider.state.credentialEpoch)}${provider.state.rpIdHash.slice(2)}${provider.state.originHash.slice(2)}${publicKeyX.slice(2)}${publicKeyY.slice(2)}`;
}

function makeProvider() {
  const state = {
    owner,
    epoch: 1n,
    nonce: 0n,
    credentialEpoch: 0n,
    rpIdHash: `0x${'00'.repeat(32)}`,
    originHash: `0x${'00'.repeat(32)}`,
    txCounter: 0n,
    calls: [],
  };
  const provider = {
    state,
    request: async (method, params = []) => {
      state.calls.push({ method, params });
      if (method === 'personal_sign') throw new Error('personal_sign must never be used by passkey lifecycle');
      if (method === 'eth_getCode') return '0x6001';
      if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_sendTransaction') {
        const data = params[0]?.data || '';
        if (data.startsWith(`0x${enrollSelector}`)) {
          state.credentialEpoch = state.epoch;
          state.rpIdHash = `0x${data.slice(74, 138)}`;
          state.originHash = `0x${data.slice(138, 202)}`;
        } else if (data.startsWith(`0x${reenrollSelector}`)) {
          state.credentialEpoch = state.epoch;
        } else if (data.startsWith('0x9eec012b')) {
          state.nonce += 1n;
        }
        state.txCounter += 1n;
        return `0x${state.txCounter.toString(16).padStart(64, '0')}`;
      }
      if (method !== 'eth_call') throw new Error(`unexpected RPC method ${method}`);
      const data = params[0]?.data || '';
      if (data.startsWith('0x22cdde4c')) return userOpHash;
      if (data.startsWith('0x9eec012b')) return successResult;
      if (data.startsWith('0xd86f2b3c')) return uintResult(state.nonce);
      if (data === '0x8da5cb5b') return addressResult(state.owner);
      if (data === '0x8a957938') return addressResult(zeroAddress);
      if (data === '0x6d5f87be') return uintResult(state.epoch);
      if (data === '0x7d5366f4') return uintResult(1n);
      if (data === '0xe5f1af38') return addressResult(zeroAddress);
      if (data === '0x93261b5b') return uintResult(0n);
      if (data === '0xb0d691fe') return addressResult(entryPoint);
      if (data === '0xc9de3b48') return addressResult(capabilityRegistry);
      if (data.startsWith(`0x${credentialSelector}`)) return credentialRecord(provider);
      if (data.startsWith(`0x${activeSelector}`)) return boolResult(state.credentialEpoch !== 0n && state.credentialEpoch === state.epoch);
      // Management simulation calls execute against SmartAccount420 and return empty success data.
      if (data.startsWith(`0x${enrollSelector}`) || data.startsWith(`0x${reenrollSelector}`)) return '0x';
      throw new Error(`unexpected eth_call selector ${data.slice(0, 10)}`);
    },
  };
  return provider;
}

function navigatorForRegistration() {
  return { credentials: {
    create: async () => registrationCredential(),
    get: async () => { throw new Error('unexpected credentials.get during registration'); },
  } };
}

function navigatorForAssertion(signCount) {
  return { credentials: {
    create: async () => { throw new Error('unexpected credentials.create during assertion'); },
    get: async () => assertionCredential(signCount),
  } };
}

const executionRequest = { target, value: 0n, data: '0x12345678' };

test('W7.10 end-to-end passkey lifecycle survives recovery only through explicit same-credential re-enrollment', async () => {
  const provider = makeProvider();

  const registration = await registerP256Passkey(navigatorForRegistration(), {
    challenge: registrationChallenge,
    rpId,
    userId: Uint8Array.from([9, 8, 7]),
    userName: 'owner',
  }, { expectedOrigin: origin });
  assert.equal(registration.credentialId, credentialId);
  assert.equal(registration.publicKeyX, publicKeyX);
  assert.equal(registration.publicKeyY, publicKeyY);

  const initialBinding = createPasskeyCredentialBinding({
    registration,
    smartAccountState: accountState(provider, owner),
    rpId,
    origin,
  });

  const enrollment = await sendEnrollPasskey(provider, owner, accountState(provider, owner), initialBinding);
  const enrolled = await confirmEnrollPasskey(provider, enrollment.txHash, enrollment, { attempts: 1, delayMs: 0 });
  assert.equal(enrolled.credential.epoch, 1n);
  assert.equal(enrolled.binding.authorizationEpoch, '1');

  const firstPrepared = await preparePasskeyUserOperationTransport(
    provider,
    navigatorForAssertion(1),
    accountState(provider, owner),
    enrolled.binding,
    executionRequest,
  );
  const firstSubmitted = await sendPreparedPasskeyUserOperation(provider, firstPrepared, owner);
  assert.equal(firstSubmitted.submitted, true);
  assert.equal(provider.state.nonce, 1n);
  assert.equal(firstPrepared.advancedBinding.signCount, '1');

  // Model finalized recovery: ownership changes and authorizationEpoch advances.
  provider.state.owner = recoveredOwner;
  provider.state.epoch = 2n;
  assert.equal(provider.state.credentialEpoch, 1n);

  await assert.rejects(
    preparePasskeyUserOperationTransport(
      provider,
      navigatorForAssertion(2),
      accountState(provider, recoveredOwner),
      firstPrepared.advancedBinding,
      executionRequest,
    ),
    /authorization epoch changed/i,
  );

  const reenrollment = await sendReenrollPasskey(
    provider,
    recoveredOwner,
    accountState(provider, recoveredOwner),
    firstPrepared.advancedBinding,
  );
  const reenabled = await confirmReenrollPasskey(provider, reenrollment.txHash, reenrollment, { attempts: 1, delayMs: 0 });
  assert.equal(reenabled.credential.epoch, 2n);
  assert.equal(reenabled.binding.authorizationEpoch, '2');
  assert.equal(reenabled.binding.credentialId, initialBinding.credentialId);
  assert.equal(reenabled.binding.publicKeyX, initialBinding.publicKeyX);
  assert.equal(reenabled.binding.publicKeyY, initialBinding.publicKeyY);

  const secondPrepared = await preparePasskeyUserOperationTransport(
    provider,
    navigatorForAssertion(2),
    accountState(provider, recoveredOwner),
    reenabled.binding,
    executionRequest,
  );
  const secondSubmitted = await sendPreparedPasskeyUserOperation(provider, secondPrepared, recoveredOwner);
  assert.equal(secondSubmitted.submitted, true);
  assert.equal(provider.state.nonce, 2n);
  assert.equal(secondPrepared.advancedBinding.signCount, '2');
  assert.equal(provider.state.calls.some((call) => call.method === 'personal_sign'), false);
});
