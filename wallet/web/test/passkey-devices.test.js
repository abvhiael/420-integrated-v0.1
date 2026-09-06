import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSKEY_DEVICE_SCHEMA,
  createPasskeyDeviceRecord,
  parsePasskeyDeviceRecord,
  passkeyDeviceSummary,
  replacePasskeyDeviceRecord,
  revokePasskeyDeviceRecord,
  serializePasskeyDeviceRecord,
  validatePasskeyDeviceRecord,
} from '../core/passkey-devices.js';

const ACCOUNT = '0x0000000000000000000000000000000000000420';
const HASH = `0x${'11'.repeat(32)}`;
const CONTEXT = {
  smartAccount: ACCOUNT,
  authorizationEpoch: 7,
  rpId: 'wallet.420.example',
  origin: 'https://wallet.420.example',
};

function record(overrides = {}) {
  return createPasskeyDeviceRecord({
    ...CONTEXT,
    credentialId: 'credential-base64url',
    credentialIdHash: HASH,
    label: 'Laptop',
    transports: ['internal', 'hybrid', 'internal'],
    authenticatorAttachment: 'platform',
    createdAt: 1000,
    ...overrides,
  });
}

test('creates a public-only versioned device record', () => {
  const device = record();
  assert.equal(device.schema, PASSKEY_DEVICE_SCHEMA);
  assert.equal(device.smartAccount, ACCOUNT);
  assert.deepEqual(device.transports, ['hybrid', 'internal']);
  assert.equal(device.revokedAt, null);
  assert.equal('privateKey' in device, false);
  assert.equal('attestationObject' in device, false);
  assert.equal('authenticatorData' in device, false);
});

test('validates exact SmartAccount, epoch, RP ID and origin context', () => {
  const device = record();
  assert.deepEqual(validatePasskeyDeviceRecord(device, CONTEXT), { valid: true, reason: 'ready' });
  assert.equal(validatePasskeyDeviceRecord(device, { ...CONTEXT, authorizationEpoch: 8 }).reason, 'authorization-epoch-stale');
  assert.equal(validatePasskeyDeviceRecord(device, { ...CONTEXT, rpId: 'evil.example' }).reason, 'rp-id-mismatch');
  assert.equal(validatePasskeyDeviceRecord(device, { ...CONTEXT, origin: 'https://other.420.example' }).reason, 'origin-mismatch');
  assert.equal(validatePasskeyDeviceRecord(device, { ...CONTEXT, smartAccount: '0x0000000000000000000000000000000000000001' }).reason, 'smart-account-mismatch');
});

test('revocation is explicit and makes the device unusable', () => {
  const revoked = revokePasskeyDeviceRecord(record(), 2000);
  assert.equal(revoked.revokedAt, 2000);
  assert.deepEqual(validatePasskeyDeviceRecord(revoked, CONTEXT), { valid: false, reason: 'device-revoked' });
});

test('replacement requires same account and newer authorization epoch', () => {
  const previous = record();
  const replacement = replacePasskeyDeviceRecord(previous, {
    ...CONTEXT,
    authorizationEpoch: 8,
    credentialId: 'replacement',
    credentialIdHash: `0x${'22'.repeat(32)}`,
    createdAt: 3000,
  }, 2500);
  assert.equal(replacement.revoked.revokedAt, 2500);
  assert.equal(replacement.next.authorizationEpoch, 8);
  assert.throws(() => replacePasskeyDeviceRecord(previous, {
    ...CONTEXT,
    authorizationEpoch: 7,
    credentialId: 'replacement',
    credentialIdHash: `0x${'22'.repeat(32)}`,
  }), /newer authorization epoch/);
});

test('serialization excludes arbitrary secret fields', () => {
  const device = { ...record(), secret: 'must-not-persist' };
  const serialized = serializePasskeyDeviceRecord(device);
  assert.equal(serialized.includes('must-not-persist'), false);
  const parsed = parsePasskeyDeviceRecord(serialized);
  assert.equal(parsed.credentialId, 'credential-base64url');
  assert.equal(parsed.secret, undefined);
});

test('summary exposes lifecycle state without authority expansion', () => {
  const summary = passkeyDeviceSummary(record(), CONTEXT);
  assert.equal(summary.usable, true);
  assert.equal(summary.status, 'ready');
  assert.equal(summary.label, 'Laptop');
});
