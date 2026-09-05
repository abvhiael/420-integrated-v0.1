import { base64urlDecode, base64urlEncode, passkeyPolicy } from './passkeys.js';

export const PASSKEY_BINDING_SCHEMA = '420-wallet-passkey-binding-v1';

function normalizeAddress(value, label = 'address') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} must be a 20-byte hex address`);
  const normalized = value.toLowerCase();
  if (normalized === '0x0000000000000000000000000000000000000000') throw new Error(`${label} cannot be the zero address`);
  return normalized;
}

function normalizeAuthorizationEpoch(value) {
  let epoch;
  try { epoch = BigInt(value); } catch { throw new Error('invalid authorization epoch'); }
  if (epoch < 1n || epoch > 0xffffffffffffffffn) throw new Error('invalid authorization epoch');
  return epoch;
}

function normalizeCredentialId(value) {
  if (typeof value !== 'string' || !value) throw new Error('credential ID required');
  const bytes = base64urlDecode(value);
  if (bytes.length < 1 || bytes.length > 1024) throw new Error('invalid credential ID length');
  const canonical = base64urlEncode(bytes);
  if (canonical !== value) throw new Error('credential ID must use canonical base64url encoding');
  return canonical;
}

function normalizeTransports(values) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('passkey transports must be an array');
  const allowed = new Set(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);
  const unique = [];
  for (const value of values) {
    if (typeof value !== 'string' || !allowed.has(value)) throw new Error('invalid passkey transport');
    if (!unique.includes(value)) unique.push(value);
  }
  return unique.sort();
}

function normalizeAccountState(state) {
  if (!state || typeof state !== 'object') throw new Error('SmartAccount420 state required');
  if (state.deployed !== true) throw new Error('passkey binding requires a deployed SmartAccount420');
  return {
    smartAccount: normalizeAddress(state.smartAccount, 'SmartAccount420'),
    authorizationEpoch: normalizeAuthorizationEpoch(state.authorizationEpoch),
  };
}

function assertOriginWithinRpId(origin, rpId) {
  const hostname = new URL(origin).hostname.toLowerCase();
  if (hostname !== rpId && !hostname.endsWith(`.${rpId}`)) throw new Error('WebAuthn origin is outside the RP ID boundary');
}

export function createPasskeyCredentialBinding({ registration, smartAccountState, rpId, origin }) {
  if (!registration || typeof registration !== 'object') throw new Error('passkey registration result required');
  const policy = passkeyPolicy({ rpId, origin });
  assertOriginWithinRpId(policy.origin, policy.rpId);
  if (registration.origin !== policy.origin) throw new Error('passkey registration origin changed before account binding');

  const account = normalizeAccountState(smartAccountState);
  const credentialId = normalizeCredentialId(registration.credentialId);
  if (registration.rawId != null && normalizeCredentialId(registration.rawId) !== credentialId) {
    throw new Error('passkey registration credential ID mismatch');
  }

  return Object.freeze({
    schema: PASSKEY_BINDING_SCHEMA,
    credentialId,
    smartAccount: account.smartAccount,
    authorizationEpoch: account.authorizationEpoch.toString(),
    rpId: policy.rpId,
    origin: policy.origin,
    transports: normalizeTransports(registration.transports),
    signCount: '0',
  });
}

export function validatePasskeyCredentialBinding(binding, {
  smartAccountState,
  rpId,
  origin,
  credentialId = null,
} = {}) {
  if (!binding || typeof binding !== 'object' || binding.schema !== PASSKEY_BINDING_SCHEMA) throw new Error('invalid passkey credential binding');
  const account = normalizeAccountState(smartAccountState);
  const policy = passkeyPolicy({ rpId, origin });
  assertOriginWithinRpId(policy.origin, policy.rpId);

  const boundCredentialId = normalizeCredentialId(binding.credentialId);
  const boundAccount = normalizeAddress(binding.smartAccount, 'bound SmartAccount420');
  const boundEpoch = normalizeAuthorizationEpoch(binding.authorizationEpoch);
  if (boundAccount !== account.smartAccount) throw new Error('passkey SmartAccount420 binding changed');
  if (boundEpoch !== account.authorizationEpoch) throw new Error('passkey authorization epoch changed');
  if (binding.rpId !== policy.rpId) throw new Error('passkey RP ID binding changed');
  if (binding.origin !== policy.origin) throw new Error('passkey origin binding changed');
  if (credentialId != null && normalizeCredentialId(credentialId) !== boundCredentialId) throw new Error('passkey credential binding changed');
  normalizeTransports(binding.transports);

  const signCount = Number(binding.signCount);
  if (!Number.isInteger(signCount) || signCount < 0 || signCount > 0xffffffff) throw new Error('invalid bound WebAuthn sign counter');

  return {
    credentialId: boundCredentialId,
    smartAccount: boundAccount,
    authorizationEpoch: boundEpoch,
    rpId: policy.rpId,
    origin: policy.origin,
    signCount,
    transports: [...binding.transports],
  };
}

export function advancePasskeyCredentialBinding(binding, authenticatedAssertion) {
  if (!binding || binding.schema !== PASSKEY_BINDING_SCHEMA) throw new Error('invalid passkey credential binding');
  if (!authenticatedAssertion?.authenticator) throw new Error('validated passkey authentication required');
  if (normalizeCredentialId(authenticatedAssertion.credentialId) !== normalizeCredentialId(binding.credentialId)) {
    throw new Error('authenticated passkey credential does not match binding');
  }
  const previous = Number(binding.signCount);
  const next = authenticatedAssertion.authenticator.signCount;
  if (!Number.isInteger(previous) || previous < 0 || previous > 0xffffffff) throw new Error('invalid bound WebAuthn sign counter');
  if (!Number.isInteger(next) || next < 0 || next > 0xffffffff) throw new Error('invalid authenticated WebAuthn sign counter');
  if (previous !== 0 || next !== 0) {
    if (next <= previous) throw new Error('authenticated WebAuthn sign counter did not advance');
  }
  return Object.freeze({ ...binding, signCount: String(next) });
}
