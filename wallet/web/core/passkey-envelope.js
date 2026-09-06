import { base64urlDecode } from './passkeys.js';
import { keccak256Hex } from './keccak.js';

export const PK42_SIGNATURE_MAGIC = '0x504b3432';
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function word(value) {
  const amount = BigInt(value);
  if (amount < 0n || amount >= (1n << 256n)) throw new Error('uint256 out of range');
  return amount.toString(16).padStart(64, '0');
}

function normalizeBytes32(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32 hex`);
  return value.toLowerCase();
}

function encodeDynamic(bytes) {
  const data = bytesToHex(bytes);
  const paddedLength = Math.ceil(bytes.length / 32) * 64;
  return `${word(bytes.length)}${data.padEnd(paddedLength, '0')}`;
}

function utf8(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} required`);
  return new TextEncoder().encode(value);
}

function parseDerInteger(bytes, offset, label) {
  if (bytes[offset] !== 0x02) throw new Error(`invalid P-256 ${label} DER integer`);
  const length = bytes[offset + 1];
  if (!Number.isInteger(length) || length < 1 || length > 33) throw new Error(`invalid P-256 ${label} length`);
  const start = offset + 2;
  const end = start + length;
  if (end > bytes.length) throw new Error(`truncated P-256 ${label}`);
  const encoded = bytes.slice(start, end);
  if ((encoded[0] & 0x80) !== 0) throw new Error(`negative P-256 ${label}`);
  if (encoded.length > 1 && encoded[0] === 0 && (encoded[1] & 0x80) === 0) throw new Error(`non-canonical P-256 ${label}`);
  if (encoded.length === 33 && (encoded[0] !== 0 || (encoded[1] & 0x80) === 0)) throw new Error(`invalid P-256 ${label} padding`);
  const scalarBytes = encoded.length === 33 ? encoded.slice(1) : encoded;
  const scalar = BigInt(`0x${bytesToHex(scalarBytes)}`);
  if (scalar === 0n || scalar >= P256_N) throw new Error(`P-256 ${label} scalar out of range`);
  return { scalar, next: end };
}

export function parseP256DerSignature(signature) {
  const bytes = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
  if (bytes.length < 8 || bytes.length > 72 || bytes[0] !== 0x30) throw new Error('invalid P-256 DER signature');
  const sequenceLength = bytes[1];
  if ((sequenceLength & 0x80) !== 0 || sequenceLength !== bytes.length - 2) throw new Error('invalid P-256 DER sequence length');
  const r = parseDerInteger(bytes, 2, 'r');
  const s = parseDerInteger(bytes, r.next, 's');
  if (s.next !== bytes.length) throw new Error('trailing P-256 DER signature data');
  return Object.freeze({
    r: `0x${r.scalar.toString(16).padStart(64, '0')}`,
    s: `0x${s.scalar.toString(16).padStart(64, '0')}`,
    rValue: r.scalar,
    sValue: s.scalar,
  });
}

export function credentialIdHash(credentialId) {
  if (typeof credentialId !== 'string' || !credentialId) throw new Error('credential ID required');
  return keccak256Hex(base64urlDecode(credentialId));
}

export function buildPasskeyAssertionEnvelope(assertion) {
  if (!assertion || typeof assertion !== 'object') throw new Error('validated passkey assertion required');
  const credentialId = base64urlDecode(assertion.credentialId);
  const authenticatorData = base64urlDecode(assertion.authenticatorData);
  const clientDataJSON = base64urlDecode(assertion.clientDataJSON);
  const origin = utf8(assertion.origin, 'passkey assertion origin');
  const signature = parseP256DerSignature(base64urlDecode(assertion.signature));

  const dynamicValues = [credentialId, authenticatorData, clientDataJSON, origin];
  const tails = dynamicValues.map(encodeDynamic);
  let offset = 6 * 32;
  const offsets = [];
  for (const tail of tails) {
    offsets.push(word(offset));
    offset += tail.length / 2;
  }

  const head = `${offsets.join('')}${word(signature.rValue)}${word(signature.sValue)}`;
  return `0x${head}${tails.join('')}`;
}

export function buildPk42Signature(assertion, binding) {
  if (!binding || typeof binding !== 'object') throw new Error('validated passkey binding required');
  if (assertion?.credentialId !== binding.credentialId) throw new Error('passkey assertion credential does not match binding');
  if (assertion?.origin !== binding.origin) throw new Error('passkey assertion origin does not match binding');

  const expectedCredentialHash = normalizeBytes32(binding.credentialIdHash, 'credential ID hash');
  const actualCredentialHash = credentialIdHash(assertion.credentialId);
  if (actualCredentialHash !== expectedCredentialHash) throw new Error('passkey credential ID hash mismatch');

  const assertionEnvelope = buildPasskeyAssertionEnvelope(assertion);
  const inner = assertionEnvelope.slice(2);
  const innerBytes = inner.length / 2;
  const paddedInner = inner.padEnd(Math.ceil(innerBytes / 32) * 64, '0');
  const outer = `${expectedCredentialHash.slice(2)}${word(64)}${word(innerBytes)}${paddedInner}`;
  return `${PK42_SIGNATURE_MAGIC}${outer}`;
}
