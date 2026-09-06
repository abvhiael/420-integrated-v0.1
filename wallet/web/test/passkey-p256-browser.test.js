import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractP256PublicKeyFromSpki,
  registerP256Passkey,
} from '../core/passkey-p256-browser.js';
import { base64urlEncode, buildPasskeyChallenge } from '../core/passkeys.js';

const encoder = new TextEncoder();
const registrationChallenge = `0x${'22'.repeat(32)}`;
const rawCredentialId = Uint8Array.from([1, 2, 3, 4]);
const credentialId = base64urlEncode(rawCredentialId);
const x = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const y = Uint8Array.from({ length: 32 }, (_, index) => 0x80 + index);
const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function spki(publicKeyX = x, publicKeyY = y) {
  return Uint8Array.from([
    0x30, 0x59, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x03, 0x42, 0x00, 0x04,
    ...publicKeyX,
    ...publicKeyY,
  ]);
}

function registration({ algorithm = -7, publicKey = spki() } = {}) {
  const challenge = base64urlEncode(buildPasskeyChallenge(registrationChallenge));
  const client = encoder.encode(JSON.stringify({
    type: 'webauthn.create',
    challenge,
    origin: 'https://wallet.420.example',
    crossOrigin: false,
  }));
  return {
    id: credentialId,
    rawId: asBuffer(rawCredentialId),
    type: 'public-key',
    response: {
      clientDataJSON: asBuffer(client),
      attestationObject: asBuffer(Uint8Array.from([0xa3, 0x01, 0x02])),
      getTransports: () => ['internal'],
      getPublicKeyAlgorithm: () => algorithm,
      getPublicKey: () => publicKey == null ? null : asBuffer(publicKey),
    },
  };
}

test('canonical ES256 SubjectPublicKeyInfo yields exact P-256 x/y coordinates', () => {
  const parsed = extractP256PublicKeyFromSpki(spki());
  assert.equal(parsed.publicKeyX, `0x${Array.from(x, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
  assert.equal(parsed.publicKeyY, `0x${Array.from(y, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
});

test('browser registration returns only public credential material plus exact P-256 coordinates', async () => {
  const navigatorLike = { credentials: {
    create: async () => registration(),
    get: async () => { throw new Error('unexpected get'); },
  } };
  const result = await registerP256Passkey(navigatorLike, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([9, 8, 7]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' });

  assert.equal(result.credentialId, credentialId);
  assert.equal(result.origin, 'https://wallet.420.example');
  assert.equal(result.publicKeyX, `0x${Array.from(x, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
  assert.equal(result.publicKeyY, `0x${Array.from(y, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
  assert.equal('privateKey' in result, false);
  assert.equal(Object.isFrozen(result), true);
});

test('browser P-256 extraction rejects wrong algorithm, missing export and malformed curve SPKI', async () => {
  const options = {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([1]),
    userName: 'owner',
  };
  const navigatorFor = (credential) => ({ credentials: {
    create: async () => credential,
    get: async () => null,
  } });

  await assert.rejects(registerP256Passkey(navigatorFor(registration({ algorithm: -257 })), options, {
    expectedOrigin: 'https://wallet.420.example',
  }), /not ES256/i);

  await assert.rejects(registerP256Passkey(navigatorFor(registration({ publicKey: null })), options, {
    expectedOrigin: 'https://wallet.420.example',
  }), /no passkey registration public key/i);

  const malformed = spki();
  malformed[10] ^= 0xff;
  await assert.rejects(registerP256Passkey(navigatorFor(registration({ publicKey: malformed })), options, {
    expectedOrigin: 'https://wallet.420.example',
  }), /not canonical ES256\/P-256/i);
});

test('P-256 extraction rejects zero coordinates', () => {
  assert.throws(() => extractP256PublicKeyFromSpki(spki(new Uint8Array(32), y)), /x coordinate cannot be zero/i);
  assert.throws(() => extractP256PublicKeyFromSpki(spki(x, new Uint8Array(32))), /y coordinate cannot be zero/i);
});
