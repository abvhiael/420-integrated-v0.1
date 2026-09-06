const PASSKEY_DEVICE_SCHEMA = '420-wallet-passkey-device-v1';

function requireString(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} required`);
  return text;
}

function requireEpoch(value) {
  const epoch = Number(value);
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('authorizationEpoch must be a non-negative safe integer');
  return epoch;
}

function normalizeAddress(value, label = 'smartAccount') {
  const text = requireString(value, label).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(text)) throw new Error(`${label} must be an address`);
  return text;
}

function normalizeHash(value, label) {
  const text = requireString(value, label).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(text)) throw new Error(`${label} must be bytes32`);
  return text;
}

function normalizeTimestamp(value, label) {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return timestamp;
}

export function createPasskeyDeviceRecord({
  smartAccount,
  authorizationEpoch,
  credentialId,
  credentialIdHash,
  rpId,
  origin,
  label = 'This device',
  transports = [],
  authenticatorAttachment = null,
  createdAt = Date.now(),
} = {}) {
  const normalizedCredentialId = requireString(credentialId, 'credentialId');
  const normalizedRpId = requireString(rpId, 'rpId').toLowerCase();
  const normalizedOrigin = new URL(requireString(origin, 'origin')).origin;
  if (!Array.isArray(transports)) throw new Error('transports must be an array');

  return Object.freeze({
    schema: PASSKEY_DEVICE_SCHEMA,
    smartAccount: normalizeAddress(smartAccount),
    authorizationEpoch: requireEpoch(authorizationEpoch),
    credentialId: normalizedCredentialId,
    credentialIdHash: normalizeHash(credentialIdHash, 'credentialIdHash'),
    rpId: normalizedRpId,
    origin: normalizedOrigin,
    label: requireString(label, 'label'),
    transports: [...new Set(transports.map((value) => requireString(value, 'transport')))].sort(),
    authenticatorAttachment: authenticatorAttachment == null ? null : requireString(authenticatorAttachment, 'authenticatorAttachment'),
    createdAt: normalizeTimestamp(createdAt, 'createdAt'),
    revokedAt: null,
  });
}

export function validatePasskeyDeviceRecord(record, {
  smartAccount,
  authorizationEpoch,
  rpId,
  origin,
} = {}) {
  if (!record || record.schema !== PASSKEY_DEVICE_SCHEMA) return { valid: false, reason: 'unsupported-device-record' };
  if (record.revokedAt != null) return { valid: false, reason: 'device-revoked' };

  let expectedAccount;
  let expectedEpoch;
  let expectedRpId;
  let expectedOrigin;
  try {
    expectedAccount = normalizeAddress(smartAccount);
    expectedEpoch = requireEpoch(authorizationEpoch);
    expectedRpId = requireString(rpId, 'rpId').toLowerCase();
    expectedOrigin = new URL(requireString(origin, 'origin')).origin;
  } catch (error) {
    return { valid: false, reason: 'invalid-runtime-context', error: error.message };
  }

  if (record.smartAccount !== expectedAccount) return { valid: false, reason: 'smart-account-mismatch' };
  if (record.authorizationEpoch !== expectedEpoch) return { valid: false, reason: 'authorization-epoch-stale' };
  if (record.rpId !== expectedRpId) return { valid: false, reason: 'rp-id-mismatch' };
  if (record.origin !== expectedOrigin) return { valid: false, reason: 'origin-mismatch' };
  if (!record.credentialId || !/^0x[0-9a-f]{64}$/.test(record.credentialIdHash || '')) {
    return { valid: false, reason: 'malformed-device-record' };
  }
  return { valid: true, reason: 'ready' };
}

export function revokePasskeyDeviceRecord(record, revokedAt = Date.now()) {
  if (!record || record.schema !== PASSKEY_DEVICE_SCHEMA) throw new Error('passkey device record required');
  if (record.revokedAt != null) return record;
  return Object.freeze({ ...record, revokedAt: normalizeTimestamp(revokedAt, 'revokedAt') });
}

export function replacePasskeyDeviceRecord(previousRecord, nextInput, replacedAt = Date.now()) {
  const revoked = revokePasskeyDeviceRecord(previousRecord, replacedAt);
  const next = createPasskeyDeviceRecord(nextInput);
  if (revoked.smartAccount !== next.smartAccount) throw new Error('replacement device must remain bound to the same SmartAccount');
  if (next.authorizationEpoch <= revoked.authorizationEpoch) {
    throw new Error('replacement device must bind to a newer authorization epoch');
  }
  return { revoked, next };
}

export function serializePasskeyDeviceRecord(record) {
  if (!record || record.schema !== PASSKEY_DEVICE_SCHEMA) throw new Error('passkey device record required');
  const allowed = {
    schema: record.schema,
    smartAccount: record.smartAccount,
    authorizationEpoch: record.authorizationEpoch,
    credentialId: record.credentialId,
    credentialIdHash: record.credentialIdHash,
    rpId: record.rpId,
    origin: record.origin,
    label: record.label,
    transports: Array.isArray(record.transports) ? [...record.transports] : [],
    authenticatorAttachment: record.authenticatorAttachment ?? null,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt ?? null,
  };
  return JSON.stringify(allowed);
}

export function parsePasskeyDeviceRecord(value) {
  const parsed = JSON.parse(requireString(value, 'serialized device record'));
  if (parsed?.schema !== PASSKEY_DEVICE_SCHEMA) throw new Error('unsupported passkey device record');
  return Object.freeze(parsed);
}

export function passkeyDeviceSummary(record, context) {
  const status = validatePasskeyDeviceRecord(record, context);
  return {
    status: status.reason,
    usable: status.valid,
    label: record?.label || 'Unknown device',
    credentialId: record?.credentialId || null,
    transports: Array.isArray(record?.transports) ? [...record.transports] : [],
    createdAt: record?.createdAt ?? null,
    revokedAt: record?.revokedAt ?? null,
  };
}

export { PASSKEY_DEVICE_SCHEMA };
