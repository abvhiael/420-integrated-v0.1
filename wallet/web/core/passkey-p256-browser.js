import { registerPasskey } from './passkeys.js';

const P256_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x59, 0x30, 0x13,
  0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  0x03, 0x42, 0x00, 0x04,
]);

function toBytes(value, label) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error(`${label} must be binary`);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function hex32(bytes) {
  if (bytes.length !== 32) throw new Error('P-256 coordinate must be 32 bytes');
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function assertNonzeroCoordinate(bytes, label) {
  let aggregate = 0;
  for (const byte of bytes) aggregate |= byte;
  if (aggregate === 0) throw new Error(`P-256 ${label} coordinate cannot be zero`);
}

export function extractP256PublicKeyFromSpki(spki) {
  const bytes = toBytes(spki, 'P-256 SubjectPublicKeyInfo');
  if (bytes.length !== 91 || !bytesEqual(bytes.slice(0, P256_SPKI_PREFIX.length), P256_SPKI_PREFIX)) {
    throw new Error('registration public key is not canonical ES256/P-256 SubjectPublicKeyInfo');
  }
  const publicKeyXBytes = bytes.slice(27, 59);
  const publicKeyYBytes = bytes.slice(59, 91);
  assertNonzeroCoordinate(publicKeyXBytes, 'x');
  assertNonzeroCoordinate(publicKeyYBytes, 'y');
  return Object.freeze({
    publicKeyX: hex32(publicKeyXBytes),
    publicKeyY: hex32(publicKeyYBytes),
  });
}

export async function registerP256Passkey(navigatorLike, options, ceremonyOptions = {}) {
  if (!navigatorLike?.credentials || typeof navigatorLike.credentials.create !== 'function' || typeof navigatorLike.credentials.get !== 'function') {
    throw new Error('WebAuthn credentials API unavailable');
  }

  let createdCredential = null;
  const wrappedNavigator = {
    credentials: {
      create: async (request) => {
        createdCredential = await navigatorLike.credentials.create(request);
        return createdCredential;
      },
      get: navigatorLike.credentials.get.bind(navigatorLike.credentials),
    },
  };

  const registration = await registerPasskey(wrappedNavigator, options, ceremonyOptions);
  const response = createdCredential?.response;
  if (!response || typeof response.getPublicKey !== 'function') {
    throw new Error('browser cannot export passkey registration public key');
  }
  if (typeof response.getPublicKeyAlgorithm === 'function') {
    const algorithm = response.getPublicKeyAlgorithm();
    if (algorithm !== -7) throw new Error('passkey registration public key is not ES256');
  }
  const spki = response.getPublicKey();
  if (spki == null) throw new Error('browser returned no passkey registration public key');
  const publicKey = extractP256PublicKeyFromSpki(spki);
  return Object.freeze({ ...registration, ...publicKey });
}
