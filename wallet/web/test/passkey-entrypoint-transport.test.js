import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { bytesToBase64Url } from '../core/passkeys.js';
import {
  preparePasskeyUserOperation,
  readOwnerNonce,
  revalidatePreparedPasskeyUserOperation,
} from '../core/passkey-entrypoint-transport.js';

const ACCOUNT = '0x0000000000000000000000000000000000000420';
const OWNER = '0x0000000000000000000000000000000000000001';
const ENTRY = '0x0000000000000000000000000000000000000002';
const REGISTRY = '0x0000000000000000000000000000000000000003';
const TARGET = '0x0000000000000000000000000000000000000004';
const HASH = `0x${'ab'.repeat(32)}`;
const DEVICE = {
  schema: '420-wallet-passkey-device-v1',
  smartAccount: ACCOUNT,
  authorizationEpoch: 7,
  credentialId: bytesToBase64Url(Uint8Array.from([1, 2, 3, 4])),
  credentialIdHash: `0x${'11'.repeat(32)}`,
  rpId: '420.example',
  origin: 'https://wallet.420.example',
  label: 'test',
  transports: ['internal'],
  authenticatorAttachment: 'platform',
  createdAt: 1,
  revokedAt: null,
};
const STATE = {
  smartAccount: ACCOUNT,
  deployed: true,
  owner: OWNER,
  authorizationEpoch: 7n,
  entryPoint: ENTRY,
  capabilityRegistry: REGISTRY,
};
const CONFIG = {
  network: { chainId: 420 },
  passkey: { origin: 'https://wallet.420.example', rpId: '420.example', production: true },
  features: { passkeys: true },
};

function der() { return Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]); }
function provider(overrides = {}) {
  return {
    async request(method, params) {
      if (overrides[method]) return overrides[method](params);
      if (method === 'eth_chainId') return '0x1a4';
      if (method === 'eth_call') {
        const data = params[0].data;
        if (data.startsWith('0xd86f2b3c')) return `0x${'0'.repeat(63)}5`;
        if (data.startsWith('0x22cdde4c')) return HASH;
        if (data.startsWith('0x9eec012b')) return `0x${'0'.repeat(63)}1${'0'.repeat(64)}`;
        if (data === '0x8da5cb5b') return `0x${'0'.repeat(24)}${OWNER.slice(2)}`;
        if (data === '0x8a957938') return `0x${'0'.repeat(64)}`;
        if (data === '0x6d5f87be') return `0x${'0'.repeat(63)}7`;
        if (data === '0x7d5366f4') return `0x${'0'.repeat(63)}1`;
        if (data === '0xe5f1af38') return `0x${'0'.repeat(64)}`;
        if (data === '0x93261b5b') return `0x${'0'.repeat(64)}`;
        if (data === '0xb0d691fe') return `0x${'0'.repeat(24)}${ENTRY.slice(2)}`;
        if (data === '0xc9de3b48') return `0x${'0'.repeat(24)}${REGISTRY.slice(2)}`;
      }
      if (method === 'eth_getCode') return '0x6000';
      if (method === 'eth_estimateGas') return '0x5208';
      throw new Error(`unexpected ${method}`);
    },
  };
}

const credentials = {
  async get(options) {
    assert.equal(options.publicKey.userVerification, 'required');
    return {
      id: DEVICE.credentialId,
      rawId: Uint8Array.from([1, 2, 3, 4]),
      type: 'public-key',
      response: {
        clientDataJSON: new TextEncoder().encode('{"type":"webauthn.get"}').buffer,
        authenticatorData: new Uint8Array(37).buffer,
        signature: der().buffer,
        userHandle: null,
      },
    };
  },
};

test('owner nonce reader enforces canonical nonce lane zero', async () => {
  assert.equal(await readOwnerNonce(provider(), ACCOUNT), 5n);
  await assert.rejects(
    readOwnerNonce(provider({ eth_call: () => `0x${(1n << 64n).toString(16).padStart(64, '0')}` }), ACCOUNT),
    /nonce lane zero/,
  );
});

test('prepares user operation, requests WebAuthn assertion and mode-prefixes signature', async () => {
  const prepared = await preparePasskeyUserOperation(provider(), CONFIG, STATE, DEVICE, {
    target: TARGET,
    value: 0,
    data: '0x12345678',
  }, { credentials, cryptoImpl: webcrypto });
  assert.equal(prepared.nonce, 5n);
  assert.equal(prepared.nonceKey, 0n);
  assert.equal(prepared.userOpHash, HASH);
  assert.ok(prepared.userOperation.signature.startsWith('0x01'));
  assert.equal(prepared.entryPointSimulation.simulationPassed, true);
  assert.equal(prepared.broadcastReady, true);
});

test('fails closed for disabled runtime and stale device epoch', async () => {
  await assert.rejects(
    preparePasskeyUserOperation(provider(), { ...CONFIG, features: { passkeys: false } }, STATE, DEVICE, { target: TARGET }),
    /runtime passkeys are disabled/,
  );
  await assert.rejects(
    preparePasskeyUserOperation(provider(), CONFIG, { ...STATE, authorizationEpoch: 8n }, DEVICE, { target: TARGET }),
    /authorization-epoch-stale/,
  );
});

test('revalidation rejects owner nonce movement after assertion', async () => {
  const prepared = await preparePasskeyUserOperation(provider(), CONFIG, STATE, DEVICE, { target: TARGET }, { credentials, cryptoImpl: webcrypto });
  const moved = provider({
    eth_call: ([tx]) => {
      if (tx.data.startsWith('0xd86f2b3c')) return `0x${'0'.repeat(63)}6`;
      if (tx.data === '0x8da5cb5b') return `0x${'0'.repeat(24)}${OWNER.slice(2)}`;
      if (tx.data === '0x8a957938') return `0x${'0'.repeat(64)}`;
      if (tx.data === '0x6d5f87be') return `0x${'0'.repeat(63)}7`;
      if (tx.data === '0x7d5366f4') return `0x${'0'.repeat(63)}1`;
      if (tx.data === '0xe5f1af38' || tx.data === '0x93261b5b') return `0x${'0'.repeat(64)}`;
      if (tx.data === '0xb0d691fe') return `0x${'0'.repeat(24)}${ENTRY.slice(2)}`;
      if (tx.data === '0xc9de3b48') return `0x${'0'.repeat(24)}${REGISTRY.slice(2)}`;
      if (tx.data.startsWith('0x22cdde4c')) return HASH;
      throw new Error('unexpected eth_call');
    },
  });
  await assert.rejects(revalidatePreparedPasskeyUserOperation(moved, CONFIG, prepared), /owner nonce changed/);
});
