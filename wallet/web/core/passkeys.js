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
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) throw new Error('invalid passkey timeout');
  return {
    challenge: buildPasskeyChallenge(userOpHash),
    rpId: normalizedRpId,
    allowCredentials: [{ id: base64urlDecode(credentialId), type: 'public-key' }],
    userVerification: 'required',
    timeout,
  };
}

export function parsePasskeyAssertion(credential, { expectedUserOpHash, expectedOrigin }) {
  if (!credential || credential.type !== 'public-key' || !credential.response) throw new Error('invalid public-key credential');
  const response = credential.response;
  for (const field of ['clientDataJSON', 'authenticatorData', 'signature']) {
    if (!(response[field] instanceof ArrayBuffer) && !ArrayBuffer.isView(response[field])) throw new Error(`missing ${field}`);
  }
  const clientBytes = response.clientDataJSON instanceof ArrayBuffer
    ? new Uint8Array(response.clientDataJSON)
    : new Uint8Array(response.clientDataJSON.buffer, response.clientDataJSON.byteOffset, response.clientDataJSON.byteLength);
  let clientData;
  try { clientData = JSON.parse(new TextDecoder().decode(clientBytes)); } catch { throw new Error('invalid clientDataJSON'); }
  if (clientData.type !== 'webauthn.get') throw new Error('unexpected WebAuthn ceremony type');
  const expectedChallenge = base64urlEncode(buildPasskeyChallenge(expectedUserOpHash));
  if (clientData.challenge !== expectedChallenge) throw new Error('WebAuthn challenge mismatch');
  const origin = normalizeOrigin(expectedOrigin);
  if (clientData.origin !== origin) throw new Error('WebAuthn origin mismatch');

  const toBytes = (value) => value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return {
    credentialId: credential.id,
    clientDataJSON: base64urlEncode(clientBytes),
    authenticatorData: base64urlEncode(toBytes(response.authenticatorData)),
    signature: base64urlEncode(toBytes(response.signature)),
    userHandle: response.userHandle ? base64urlEncode(toBytes(response.userHandle)) : null,
    origin,
    challenge: expectedChallenge,
  };
}

export function passkeyPolicy({ rpId, origin }) {
  return { rpId: normalizeRpId(rpId), origin: normalizeOrigin(origin), userVerification: 'required' };
}
