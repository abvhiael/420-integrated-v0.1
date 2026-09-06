import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256Hex } from '../core/keccak.js';
import {
  PK42_SIGNATURE_MAGIC,
  buildPasskeyAssertionEnvelope,
  buildPk42Signature,
  credentialIdHash,
  parseP256DerSignature,
} from '../core/passkey-envelope.js';
import { base64urlEncode } from '../core/passkeys.js';

const encoder = new TextEncoder();
const credentialBytes = Uint8Array.from([1, 2, 3, 4]);
const credentialId = base64urlEncode(credentialBytes);
const origin = 'https://wallet.420.example';
const authenticatorData = Uint8Array.from({ length: 37 }, (_, index) => index + 1);
const clientDataJSON = encoder.encode(JSON.stringify({
  type: 'webauthn.get',
  challenge: 'ERERERERERERERERERERERERERERERERERERERERERE',
  origin,
  crossOrigin: false,
}));
const derSignature = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);

const assertion = {
  credentialId,
  authenticatorData: base64urlEncode(authenticatorData),
  clientDataJSON: base64urlEncode(clientDataJSON),
  signature: base64urlEncode(derSignature),
  origin,
};

function word(hex, index) {
  const clean = hex.replace(/^0x/, '');
  return BigInt(`0x${clean.slice(index * 64, (index + 1) * 64)}`);
}

function dynamicBytes(hex, byteOffset) {
  const clean = hex.replace(/^0x/, '');
  const start = byteOffset * 2;
  const length = Number(BigInt(`0x${clean.slice(start, start + 64)}`));
  const data = clean.slice(start + 64, start + 64 + length * 2);
  return Uint8Array.from(data.match(/../g) || [], (byte) => Number.parseInt(byte, 16));
}

test('browser keccak256 helper matches Ethereum Keccak-256 vectors', () => {
  assert.equal(keccak256Hex(new Uint8Array()), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256Hex(encoder.encode('hello')), '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8');
});

test('DER ES256 signatures are parsed into exact uint256 r and s scalars', () => {
  const parsed = parseP256DerSignature(derSignature);
  assert.equal(parsed.rValue, 1n);
  assert.equal(parsed.sValue, 2n);
  assert.equal(parsed.r, `0x${'0'.repeat(63)}1`);
  assert.equal(parsed.s, `0x${'0'.repeat(63)}2`);
});

test('DER parser rejects malformed, negative, non-canonical and zero scalars', () => {
  assert.throws(() => parseP256DerSignature(Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x01])), /DER/i);
  assert.throws(() => parseP256DerSignature(Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01])), /negative/i);
  assert.throws(() => parseP256DerSignature(Uint8Array.from([0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01])), /non-canonical/i);
  assert.throws(() => parseP256DerSignature(Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x00, 0x02, 0x01, 0x01])), /out of range/i);
});

test('assertion envelope exactly ABI-encodes credential, authenticator data, client JSON, origin, r and s', () => {
  const envelope = buildPasskeyAssertionEnvelope(assertion);
  const offsets = [0, 1, 2, 3].map((index) => Number(word(envelope, index)));
  assert.deepEqual([...dynamicBytes(envelope, offsets[0])], [...credentialBytes]);
  assert.deepEqual([...dynamicBytes(envelope, offsets[1])], [...authenticatorData]);
  assert.deepEqual([...dynamicBytes(envelope, offsets[2])], [...clientDataJSON]);
  assert.equal(new TextDecoder().decode(dynamicBytes(envelope, offsets[3])), origin);
  assert.equal(word(envelope, 4), 1n);
  assert.equal(word(envelope, 5), 2n);
});

test('PK42 signature wraps credential hash plus the assertion ABI envelope for SmartAccount420 routing', () => {
  const binding = {
    credentialId,
    credentialIdHash: credentialIdHash(credentialId),
    origin,
  };
  const envelope = buildPasskeyAssertionEnvelope(assertion);
  const signature = buildPk42Signature(assertion, binding);
  assert.equal(signature.slice(0, 10), PK42_SIGNATURE_MAGIC);

  const outer = `0x${signature.slice(10)}`;
  assert.equal(`0x${outer.slice(2, 66)}`, binding.credentialIdHash);
  assert.equal(word(outer, 1), 64n);
  const decodedEnvelope = dynamicBytes(outer, 64);
  assert.equal(`0x${Array.from(decodedEnvelope, (byte) => byte.toString(16).padStart(2, '0')).join('')}`, envelope);
});

test('PK42 construction fails closed on credential or origin drift', () => {
  const binding = { credentialId, credentialIdHash: credentialIdHash(credentialId), origin };
  assert.throws(() => buildPk42Signature({ ...assertion, credentialId: base64urlEncode(Uint8Array.from([9])) }, binding), /credential does not match/i);
  assert.throws(() => buildPk42Signature({ ...assertion, origin: 'https://evil.example' }, binding), /origin does not match/i);
  assert.throws(() => buildPk42Signature(assertion, { ...binding, credentialIdHash: `0x${'55'.repeat(32)}` }), /hash mismatch/i);
});
