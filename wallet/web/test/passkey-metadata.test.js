import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSKEY_BINDING_SCHEMA,
  advancePasskeyCredentialBinding,
  createPasskeyCredentialBinding,
  validatePasskeyCredentialBinding,
} from '../core/passkey-metadata.js';
import { credentialIdHash } from '../core/passkey-envelope.js';
import { base64urlEncode } from '../core/passkeys.js';

const smartAccount = '0x2222222222222222222222222222222222222222';
const otherAccount = '0x3333333333333333333333333333333333333333';
const credentialId = base64urlEncode(Uint8Array.from([1, 2, 3, 4]));
const publicKeyX = `0x${'11'.repeat(32)}`;
const publicKeyY = `0x${'22'.repeat(32)}`;
const state = { deployed: true, smartAccount, authorizationEpoch: 7n };
const registration = {
  credentialId,
  rawId: credentialId,
  origin: 'https://wallet.420.example',
  transports: ['internal', 'hybrid', 'internal'],
  publicKeyX,
  publicKeyY,
};

function binding() {
  return createPasskeyCredentialBinding({
    registration,
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  });
}

test('credential metadata binds public credential and P-256 material to SmartAccount420, epoch, RP ID and origin', () => {
  const created = binding();
  assert.equal(created.schema, PASSKEY_BINDING_SCHEMA);
  assert.equal(created.credentialId, credentialId);
  assert.equal(created.credentialIdHash, credentialIdHash(credentialId));
  assert.equal(created.publicKeyX, publicKeyX);
  assert.equal(created.publicKeyY, publicKeyY);
  assert.equal(created.smartAccount, smartAccount);
  assert.equal(created.authorizationEpoch, '7');
  assert.equal(created.rpId, '420.example');
  assert.equal(created.origin, 'https://wallet.420.example');
  assert.deepEqual(created.transports, ['hybrid', 'internal']);
  assert.equal(created.signCount, '0');
  assert.equal(Object.isFrozen(created), true);
});

test('binding validation fails closed on SmartAccount420 or authorization epoch drift', () => {
  const created = binding();
  assert.throws(() => validatePasskeyCredentialBinding(created, {
    smartAccountState: { ...state, smartAccount: otherAccount },
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /SmartAccount420 binding changed/i);
  assert.throws(() => validatePasskeyCredentialBinding(created, {
    smartAccountState: { ...state, authorizationEpoch: 8n },
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /authorization epoch changed/i);
});

test('binding validation fails closed on RP ID, origin, credential hash or credential drift', () => {
  const created = binding();
  assert.throws(() => validatePasskeyCredentialBinding(created, {
    smartAccountState: state,
    rpId: 'example',
    origin: 'https://wallet.example',
  }), /RP ID binding changed/i);
  assert.throws(() => validatePasskeyCredentialBinding(created, {
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://auth.420.example',
  }), /origin binding changed/i);
  assert.throws(() => validatePasskeyCredentialBinding({ ...created, credentialIdHash: `0x${'99'.repeat(32)}` }, {
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /credential ID hash binding changed/i);
  const otherCredential = base64urlEncode(Uint8Array.from([9, 9, 9]));
  assert.throws(() => validatePasskeyCredentialBinding(created, {
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
    credentialId: otherCredential,
  }), /credential binding changed/i);
});

test('binding rejects undeployed accounts, origin outside RP ID boundary and malformed public metadata', () => {
  assert.throws(() => createPasskeyCredentialBinding({
    registration,
    smartAccountState: { ...state, deployed: false },
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /deployed SmartAccount420/i);
  assert.throws(() => createPasskeyCredentialBinding({
    registration: { ...registration, origin: 'https://wallet.evil.example' },
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.evil.example',
  }), /outside the RP ID boundary/i);
  assert.throws(() => createPasskeyCredentialBinding({
    registration: { ...registration, transports: ['telepathy'] },
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /invalid passkey transport/i);
  assert.throws(() => createPasskeyCredentialBinding({
    registration: { ...registration, publicKeyX: `0x${'00'.repeat(32)}` },
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /public key x cannot be zero/i);
  assert.throws(() => createPasskeyCredentialBinding({
    registration: { ...registration, publicKeyY: '0x1234' },
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  }), /public key y must be 32-byte hex/i);
});

test('validated binding exposes exact on-chain enrollment material', () => {
  const validated = validatePasskeyCredentialBinding(binding(), {
    smartAccountState: state,
    rpId: '420.example',
    origin: 'https://wallet.420.example',
  });
  assert.equal(validated.credentialIdHash, credentialIdHash(credentialId));
  assert.equal(validated.publicKeyX, publicKeyX);
  assert.equal(validated.publicKeyY, publicKeyY);
  assert.equal(validated.authorizationEpoch, 7n);
});

test('validated authentication advances only the bound credential counter', () => {
  const created = binding();
  const advanced = advancePasskeyCredentialBinding(created, {
    credentialId,
    authenticator: { signCount: 9 },
  });
  assert.equal(advanced.signCount, '9');
  assert.equal(created.signCount, '0');
  assert.throws(() => advancePasskeyCredentialBinding(advanced, {
    credentialId,
    authenticator: { signCount: 9 },
  }), /did not advance/i);
});

test('zero-counter authenticators remain supported without weakening nonzero rollback protection', () => {
  const created = binding();
  const zero = advancePasskeyCredentialBinding(created, {
    credentialId,
    authenticator: { signCount: 0 },
  });
  assert.equal(zero.signCount, '0');
  const first = advancePasskeyCredentialBinding(created, {
    credentialId,
    authenticator: { signCount: 1 },
  });
  assert.equal(first.signCount, '1');
  assert.throws(() => advancePasskeyCredentialBinding(first, {
    credentialId,
    authenticator: { signCount: 0 },
  }), /did not advance/i);
});
