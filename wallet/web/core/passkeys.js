function assertHexBytes32(value, label = 'challenge') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32 hex`);
  return value.toLowerCase();
}

function normalizeRpId(value) {
  if (typeof value !== 'string') throw new Error('RP ID required');
  const rpId = value.trim().toLowerCase();
  if (!rpId || rpId.includes('://') || rpId.includes('/') || rpId.includes(':') || /\s/.test(rpId)) throw new Error('invalid RP ID');
  if (!/^[a-z0-9.-]+$/.test(rpId) || rpId.startsWith('.') || rpId.endsWith('.') || rpId.includes('..')) throw new Error('invalid RP ID');
  return rpId;
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value) throw new Error('origin required');
  let url;
  try { url = new URL(value); } catch { throw new Error('invalid WebAuthn origin'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid WebAuthn origin');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('WebAuthn origin must use https');
  }
  return url.origin;
}

function hexToBytes(hex) {
  const clean = assertHexBytes32(hex).slice(2);
  return Uint8Array.from(clean.match(/../g), (byte) => Number.parseInt(byte, 16));
}

function toBytes(value, label = 'binary value') {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error(`${label} must be binary`);
}

async function sha256(bytes) {
  const input = toBytes(bytes, 'SHA-256 input');
  if (globalThis.crypto?.subtle?.digest) {
    return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input));
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { createHash } = await import('node:crypto');
    return new Uint8Array(createHash('sha256').update(input).digest());
  }
  throw new Error('SHA-256 unavailable');
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function validateTimeout(timeout) {
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) throw new Error('invalid passkey timeout');
  return timeout;
}

function assertCredentialsApi(navigatorLike) {
  if (!navigatorLike?.credentials || typeof navigatorLike.credentials.create !== 'function' || typeof navigatorLike.credentials.get !== 'function') {
    throw new Error('WebAuthn credentials API unavailable');
  }
  return navigatorLike.credentials;
}

function parseClientData(clientDataJSON, { expectedType, expectedChallenge, expectedOrigin }) {
  const clientBytes = toBytes(clientDataJSON, 'clientDataJSON');
  let clientData;
  try { clientData = JSON.parse(new TextDecoder().decode(clientBytes)); } catch { throw new Error('invalid clientDataJSON'); }
  if (clientData.type !== expectedType) throw new Error('unexpected WebAuthn ceremony type');
  if (clientData.challenge !== expectedChallenge) throw new Error('WebAuthn challenge mismatch');
  const origin = normalizeOrigin(expectedOrigin);
  if (clientData.origin !== origin) throw new Error('WebAuthn origin mismatch');
  if (clientData.crossOrigin === true) throw new Error('cross-origin WebAuthn ceremony rejected');
  return { clientBytes, clientData, origin };
}

function normalizeCredentialId(credential) {
  if (!credential || credential.type !== 'public-key' || typeof credential.id !== 'string' || !credential.id) throw new Error('invalid public-key credential');
  const rawId = toBytes(credential.rawId, 'raw credential ID');
  const encodedRawId = base64urlEncode(rawId);
  if (credential.id !== encodedRawId) throw new Error('WebAuthn credential ID mismatch');
  return { credentialId: credential.id, rawId, encodedRawId };
}

function ceremonyError(error, operation) {
  if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
    const wrapped = new Error(`Passkey ${operation} was cancelled or denied`);
    wrapped.cause = error;
    return wrapped;
  }
  const wrapped = new Error(`Passkey ${operation} failed: ${error?.message || 'WebAuthn error'}`);
  wrapped.cause = error;
  return wrapped;
}

export function base64urlEncode(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlDecode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid base64url value');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function buildPasskeyChallenge(userOpHash) {
  return hexToBytes(userOpHash);
}

export function buildPasskeyRequestOptions({ userOpHash, rpId, credentialId, timeout = 60000 }) {
  const normalizedRpId = normalizeRpId(rpId);
  if (typeof credentialId !== 'string' || !credentialId) throw new Error('credential ID required');
  return {
    challenge: buildPasskeyChallenge(userOpHash),
    rpId: normalizedRpId,
    allowCredentials: [{ id: base64urlDecode(credentialId), type: 'public-key' }],
    userVerification: 'required',
    timeout: validateTimeout(timeout),
  };
}

export function buildPasskeyCreationOptions({
  challenge,
  rpId,
  rpName = '420 Wallet',
  userId,
  userName,
  userDisplayName = userName,
  excludeCredentialIds = [],
  timeout = 60000,
}) {
  const normalizedRpId = normalizeRpId(rpId);
  if (typeof rpName !== 'string' || !rpName.trim() || rpName.length > 64) throw new Error('invalid RP name');
  const normalizedUserId = toBytes(userId, 'passkey user ID');
  if (normalizedUserId.length < 1 || normalizedUserId.length > 64) throw new Error('passkey user ID must be 1-64 bytes');
  if (typeof userName !== 'string' || !userName.trim() || userName.length > 128) throw new Error('invalid passkey user name');
  if (typeof userDisplayName !== 'string' || !userDisplayName.trim() || userDisplayName.length > 128) throw new Error('invalid passkey user display name');
  if (!Array.isArray(excludeCredentialIds)) throw new Error('excludeCredentialIds must be an array');
  const excludeCredentials = excludeCredentialIds.map((id) => ({ id: base64urlDecode(id), type: 'public-key' }));
  return {
    challenge: hexToBytes(challenge),
    rp: { id: normalizedRpId, name: rpName.trim() },
    user: { id: normalizedUserId, name: userName.trim(), displayName: userDisplayName.trim() },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    timeout: validateTimeout(timeout),
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
    excludeCredentials,
  };
}

export async function registerPasskey(navigatorLike, options, { expectedOrigin } = {}) {
  const credentials = assertCredentialsApi(navigatorLike);
  const publicKey = buildPasskeyCreationOptions(options);
  let credential;
  try {
    credential = await credentials.create({ publicKey });
  } catch (error) {
    throw ceremonyError(error, 'registration');
  }
  const { credentialId, rawId } = normalizeCredentialId(credential);
  if (!credential.response) throw new Error('missing passkey registration response');
  const expectedChallenge = base64urlEncode(publicKey.challenge);
  const { clientBytes, origin } = parseClientData(credential.response.clientDataJSON, {
    expectedType: 'webauthn.create',
    expectedChallenge,
    expectedOrigin,
  });
  const attestationObject = toBytes(credential.response.attestationObject, 'attestationObject');
  let transports = [];
  if (typeof credential.response.getTransports === 'function') {
    const reported = credential.response.getTransports();
    if (Array.isArray(reported)) transports = reported.filter((value) => typeof value === 'string').slice(0, 16);
  }
  return {
    credentialId,
    rawId: base64urlEncode(rawId),
    clientDataJSON: base64urlEncode(clientBytes),
    attestationObject: base64urlEncode(attestationObject),
    transports,
    origin,
    challenge: expectedChallenge,
  };
}

export async function authenticatePasskey(navigatorLike, options, {
  expectedOrigin,
  previousSignCount = null,
} = {}) {
  const credentials = assertCredentialsApi(navigatorLike);
  const publicKey = buildPasskeyRequestOptions(options);
  let credential;
  try {
    credential = await credentials.get({ publicKey });
  } catch (error) {
    throw ceremonyError(error, 'authentication');
  }
  normalizeCredentialId(credential);
  const assertion = parsePasskeyAssertion(credential, {
    expectedUserOpHash: options.userOpHash,
    expectedOrigin,
  });
  const authenticator = await validateAuthenticatorData(credential.response.authenticatorData, {
    expectedRpId: publicKey.rpId,
    requireUserVerification: true,
    previousSignCount,
  });
  return { ...assertion, authenticator };
}

export async function validateAuthenticatorData(authenticatorData, {
  expectedRpId,
  requireUserVerification = true,
  previousSignCount = null,
} = {}) {
  const bytes = toBytes(authenticatorData, 'authenticatorData');
  if (bytes.length < 37) throw new Error('authenticatorData must be at least 37 bytes');
  const rpId = normalizeRpId(expectedRpId);
  const expectedRpIdHash = await sha256(new TextEncoder().encode(rpId));
  const rpIdHash = bytes.slice(0, 32);
  if (!bytesEqual(rpIdHash, expectedRpIdHash)) throw new Error('WebAuthn RP ID hash mismatch');

  const flags = bytes[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  if (!userPresent) throw new Error('WebAuthn user presence flag missing');
  if (requireUserVerification && !userVerified) throw new Error('WebAuthn user verification flag missing');

  const signCount = (((bytes[33] << 24) >>> 0) + (bytes[34] << 16) + (bytes[35] << 8) + bytes[36]) >>> 0;
  if (previousSignCount != null) {
    if (!Number.isInteger(previousSignCount) || previousSignCount < 0 || previousSignCount > 0xffffffff) throw new Error('invalid previous WebAuthn sign counter');
    if (previousSignCount !== 0 || signCount !== 0) {
      if (signCount <= previousSignCount) throw new Error('WebAuthn sign counter did not advance');
    }
  }

  return {
    rpId,
    rpIdHash: base64urlEncode(rpIdHash),
    flags,
    userPresent,
    userVerified,
    signCount,
    backupEligible: (flags & 0x08) !== 0,
    backupState: (flags & 0x10) !== 0,
    attestedCredentialData: (flags & 0x40) !== 0,
    extensionData: (flags & 0x80) !== 0,
  };
}

export function parsePasskeyAssertion(credential, { expectedUserOpHash, expectedOrigin }) {
  if (!credential || credential.type !== 'public-key' || !credential.response) throw new Error('invalid public-key credential');
  const expectedChallenge = base64urlEncode(buildPasskeyChallenge(expectedUserOpHash));
  const { clientBytes, origin } = parseClientData(credential.response.clientDataJSON, {
    expectedType: 'webauthn.get',
    expectedChallenge,
    expectedOrigin,
  });
  for (const field of ['authenticatorData', 'signature']) toBytes(credential.response[field], field);
  return {
    credentialId: credential.id,
    clientDataJSON: base64urlEncode(clientBytes),
    authenticatorData: base64urlEncode(toBytes(credential.response.authenticatorData, 'authenticatorData')),
    signature: base64urlEncode(toBytes(credential.response.signature, 'signature')),
    userHandle: credential.response.userHandle ? base64urlEncode(toBytes(credential.response.userHandle, 'userHandle')) : null,
    origin,
    challenge: expectedChallenge,
  };
}

export function passkeyPolicy({ rpId, origin }) {
  return { rpId: normalizeRpId(rpId), origin: normalizeOrigin(origin), userVerification: 'required' };
}
