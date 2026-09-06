import { base64UrlToBytes } from './passkeys.js';

const USEROP_DOMAIN = '420/WALLET/PASSKEY_USEROP/V1';
const textEncoder = new TextEncoder();

function hexToBytes(value, length, label) {
  const text = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(text)) throw new Error(`${label} must be hex`);
  const hex = text.slice(2);
  if (hex.length !== length * 2) throw new Error(`${label} must be ${length} bytes`);
  return Uint8Array.from(hex.match(/../g), (byte) => Number.parseInt(byte, 16));
}

function uintToBytes(value, length, label) {
  let n;
  try { n = BigInt(value); } catch { throw new Error(`${label} must be an unsigned integer`); }
  if (n < 0n || n >= (1n << BigInt(length * 8))) throw new Error(`${label} out of range`);
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; --i) { out[i] = Number(n & 0xffn); n >>= 8n; }
  return out;
}

function concatBytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export async function buildPasskeyUserOpChallenge({
  chainId,
  smartAccount,
  authorizationEpoch,
  userOpHash,
  nonce,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('Web Crypto SHA-256 unavailable');
  const packed = concatBytes(
    textEncoder.encode(USEROP_DOMAIN),
    uintToBytes(chainId, 32, 'chainId'),
    hexToBytes(smartAccount, 20, 'smartAccount'),
    uintToBytes(authorizationEpoch, 8, 'authorizationEpoch'),
    hexToBytes(userOpHash, 32, 'userOpHash'),
    uintToBytes(nonce, 32, 'nonce'),
  );
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', packed));
}

export function decodeP256DerSignature(signature) {
  const bytes = signature instanceof Uint8Array ? signature : base64UrlToBytes(signature);
  if (bytes.length < 8 || bytes[0] !== 0x30) throw new Error('invalid P-256 DER signature');
  let offset = 1;
  const sequenceLength = bytes[offset++];
  if ((sequenceLength & 0x80) !== 0 || sequenceLength !== bytes.length - offset) throw new Error('unsupported DER sequence length');

  const readInteger = () => {
    if (bytes[offset++] !== 0x02) throw new Error('invalid DER integer');
    const length = bytes[offset++];
    if (!length || length > 33 || offset + length > bytes.length) throw new Error('invalid DER integer length');
    let slice = bytes.slice(offset, offset + length);
    offset += length;
    if (slice.length === 33) {
      if (slice[0] !== 0) throw new Error('invalid DER integer padding');
      slice = slice.slice(1);
    }
    while (slice.length > 1 && slice[0] === 0) slice = slice.slice(1);
    if (slice.length > 32) throw new Error('P-256 integer too large');
    let value = 0n;
    for (const byte of slice) value = (value << 8n) | BigInt(byte);
    if (value === 0n) throw new Error('P-256 integer cannot be zero');
    return value;
  };

  const r = readInteger();
  const s = readInteger();
  if (offset !== bytes.length) throw new Error('trailing DER signature data');
  return { r, s };
}

function pad32Hex(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function bytesHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeDynamic(bytes) {
  const data = bytesHex(bytes);
  const paddedLength = Math.ceil(bytes.length / 32) * 64;
  return pad32Hex(bytes.length) + data.padEnd(paddedLength, '0');
}

/// Encode the SmartAccount420 passkey signature envelope:
/// 0x01 || abi.encode(bytes32 credentialIdHash, bytes authenticatorData,
///                    bytes clientDataJSON, uint256 r, uint256 s)
export function encodePasskeyUserOpSignature({
  credentialIdHash,
  authenticatorData,
  clientDataJSON,
  signature,
} = {}) {
  const credential = hexToBytes(credentialIdHash, 32, 'credentialIdHash');
  const auth = typeof authenticatorData === 'string' ? base64UrlToBytes(authenticatorData) : new Uint8Array(authenticatorData);
  const client = typeof clientDataJSON === 'string' ? base64UrlToBytes(clientDataJSON) : new Uint8Array(clientDataJSON);
  const { r, s } = decodeP256DerSignature(signature);

  const authEncoded = encodeDynamic(auth);
  const clientEncoded = encodeDynamic(client);
  const headBytes = 5 * 32;
  const authOffset = headBytes;
  const clientOffset = headBytes + authEncoded.length / 2;
  const head = [
    bytesHex(credential),
    pad32Hex(authOffset),
    pad32Hex(clientOffset),
    pad32Hex(r),
    pad32Hex(s),
  ].join('');
  return `0x01${head}${authEncoded}${clientEncoded}`;
}

export async function buildPasskeyCredentialBinding({ rawId, rpId, origin, cryptoImpl = globalThis.crypto } = {}) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('Web Crypto SHA-256 unavailable');
  const credentialBytes = typeof rawId === 'string' ? base64UrlToBytes(rawId) : new Uint8Array(rawId);
  if (!credentialBytes.length) throw new Error('credential id required');
  const digest = async (bytes) => new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes));
  const toHex = (bytes) => `0x${bytesHex(bytes)}`;
  return {
    // credentialIdHash uses SHA-256 client-side and should be supplied to the verifier unchanged.
    credentialIdHash: toHex(await digest(credentialBytes)),
    rpIdHash: toHex(await digest(textEncoder.encode(String(rpId).toLowerCase()))),
    originHash: toHex(await digest(textEncoder.encode(new URL(String(origin)).origin))),
  };
}

export { USEROP_DOMAIN };
