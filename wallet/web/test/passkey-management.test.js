import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELECTOR_PASSKEY_VERIFIER,
  SELECTOR_REGISTER_PASSKEY,
  SELECTOR_REVOKE_PASSKEY,
  extractP256PublicKeyFromSpki,
  preparePasskeyEnrollment,
  preparePasskeyRevocation,
  readPasskeyManagementState,
} from '../core/passkey-management.js';
import { bytesToBase64Url } from '../core/passkeys.js';

const ACCOUNT = '0x0000000000000000000000000000000000000420';
const OWNER = '0x0000000000000000000000000000000000000001';
const VERIFIER = '0x0000000000000000000000000000000000000100';
const wordAddress = (value) => `0x${value.slice(2).padStart(64, '0')}`;
const wordUint = (value) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

function provider({ epoch = 7n, verifier = VERIFIER } = {}) {
  const calls = [];
  return {
    calls,
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'eth_call') {
        const data = params[0].data;
        if (data === `0x${SELECTOR_PASSKEY_VERIFIER}`) return wordAddress(verifier);
        if (data === '0x6d5f87be') return wordUint(epoch);
        return '0x';
      }
      if (method === 'eth_estimateGas') return '0x5208';
      throw new Error(`unexpected ${method}`);
    },
  };
}

const smartAccountState = {
  deployed: true,
  smartAccount: ACCOUNT,
  owner: OWNER,
  controllerIsOwner: true,
  authorizationEpoch: 7n,
};

const review = {
  smartAccount: ACCOUNT,
  authorizationEpoch: 7n,
  credentialIdHash: `0x${'11'.repeat(32)}`,
  publicKeyX: 123n,
  publicKeyY: 456n,
  rpIdHash: `0x${'22'.repeat(32)}`,
  originHash: `0x${'33'.repeat(32)}`,
};

test('passkey management selectors remain pinned to SmartAccount420 ABI', () => {
  assert.equal(SELECTOR_PASSKEY_VERIFIER, '2b6ae8e4');
  assert.equal(SELECTOR_REGISTER_PASSKEY, '923e3cec');
  assert.equal(SELECTOR_REVOKE_PASSKEY, '739afee3');
});

test('reads verifier and authorization epoch from canonical account', async () => {
  const p = provider();
  const state = await readPasskeyManagementState(p, ACCOUNT);
  assert.equal(state.verifier, VERIFIER);
  assert.equal(state.verifierConfigured, true);
  assert.equal(state.authorizationEpoch, 7n);
});

test('P-256 SPKI extraction returns final uncompressed point coordinates', () => {
  const x = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const y = Uint8Array.from({ length: 32 }, (_, i) => 64 - i);
  const spki = Uint8Array.from([0x30, 0x59, 0x00, 0x01, 0x04, ...x, ...y]);
  const parsed = extractP256PublicKeyFromSpki(bytesToBase64Url(spki));
  assert.equal(parsed.x, BigInt(`0x${Buffer.from(x).toString('hex')}`));
  assert.equal(parsed.y, BigInt(`0x${Buffer.from(y).toString('hex')}`));
});

test('enrollment is simulated and calldata binds reviewed credential metadata', async () => {
  const p = provider();
  const prepared = await preparePasskeyEnrollment(p, OWNER, smartAccountState, review);
  assert.equal(prepared.simulation.passed, true);
  assert.equal(prepared.transaction.from, OWNER);
  assert.equal(prepared.transaction.to, ACCOUNT);
  assert.ok(prepared.transaction.data.startsWith(`0x${SELECTOR_REGISTER_PASSKEY}${'11'.repeat(32)}`));
  assert.equal(prepared.previousEpoch, 7n);
});

test('enrollment fails closed if authorization epoch changed since review', async () => {
  const p = provider({ epoch: 8n });
  await assert.rejects(() => preparePasskeyEnrollment(p, OWNER, smartAccountState, review), /authorization epoch changed/);
});

test('revocation remains available through the owner path and is simulated first', async () => {
  const p = provider();
  const prepared = await preparePasskeyRevocation(p, OWNER, smartAccountState);
  assert.equal(prepared.transaction.data, `0x${SELECTOR_REVOKE_PASSKEY}`);
  assert.equal(prepared.simulation.passed, true);
});

test('non-owner controller cannot prepare passkey authority mutation', async () => {
  const p = provider();
  await assert.rejects(
    () => preparePasskeyRevocation(p, '0x0000000000000000000000000000000000000002', smartAccountState),
    /not the on-chain SmartAccount420 owner/,
  );
});
