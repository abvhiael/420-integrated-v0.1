import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64urlDecode,
  base64urlEncode,
  buildPasskeyChallenge,
  buildPasskeyRequestOptions,
  parsePasskeyAssertion,
  passkeyPolicy,
} from '../core/passkeys.js';

const hash = `0x${'11'.repeat(32)}`;
const credentialId = base64urlEncode(Uint8Array.from([1, 2, 3, 4]));
const encoder = new TextEncoder();
const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function assertion({ challenge = base64urlEncode(buildPasskeyChallenge(hash)), origin = 'https://wallet.420.example' } = {}) {
  const client = encoder.encode(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
  return {
    id: credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: asBuffer(client),
      authenticatorData: asBuffer(Uint8Array.from([5, 6, 7])),
      signature: asBuffer(Uint8Array.from([8, 9, 10])),
      userHandle: null,
    },
  };
}

test('base64url helpers round-trip credential bytes without padding', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252]);
  const encoded = base64urlEncode(bytes);
  assert.doesNotMatch(encoded, /[=+/]/);
  assert.deepEqual([...base64urlDecode(encoded)], [...bytes]);
  assert.throws(() => base64urlDecode('bad+value'), /invalid base64url/i);
});

test('passkey challenge is exactly the canonical bytes32 user operation hash', () => {
  const challenge = buildPasskeyChallenge(hash);
  assert.equal(challenge.length, 32);
  assert.equal(base64urlEncode(challenge), base64urlEncode(Uint8Array.from({ length: 32 }, () => 0x11)));
  assert.throws(() => buildPasskeyChallenge('0x1234'), /bytes32/i);
});

test('request options require exact RP ID binding and user verification', () => {
  const options = buildPasskeyRequestOptions({
    userOpHash: hash,
    rpId: 'wallet.420.example',
    credentialId,
  });
  assert.equal(options.rpId, 'wallet.420.example');
  assert.equal(options.userVerification, 'required');
  assert.deepEqual([...options.allowCredentials[0].id], [1, 2, 3, 4]);
  assert.throws(() => buildPasskeyRequestOptions({ userOpHash: hash, rpId: 'https://wallet.420.example', credentialId }), /invalid RP ID/i);
});

test('assertion parsing binds ceremony type, challenge and exact origin', () => {
  const parsed = parsePasskeyAssertion(assertion(), {
    expectedUserOpHash: hash,
    expectedOrigin: 'https://wallet.420.example',
  });
  assert.equal(parsed.credentialId, credentialId);
  assert.equal(parsed.origin, 'https://wallet.420.example');
  assert.equal(parsed.challenge, base64urlEncode(buildPasskeyChallenge(hash)));
  assert.ok(parsed.authenticatorData);
  assert.ok(parsed.signature);
});

test('assertion parsing fails closed on replay or origin drift', () => {
  assert.throws(() => parsePasskeyAssertion(assertion({ challenge: base64urlEncode(Uint8Array.from({ length: 32 }, () => 0x22)) }), {
    expectedUserOpHash: hash,
    expectedOrigin: 'https://wallet.420.example',
  }), /challenge mismatch/i);
  assert.throws(() => parsePasskeyAssertion(assertion({ origin: 'https://evil.example' }), {
    expectedUserOpHash: hash,
    expectedOrigin: 'https://wallet.420.example',
  }), /origin mismatch/i);
});

test('passkey policy rejects insecure non-local origins and malformed RP IDs', () => {
  assert.deepEqual(passkeyPolicy({ rpId: 'wallet.420.example', origin: 'https://wallet.420.example' }), {
    rpId: 'wallet.420.example',
    origin: 'https://wallet.420.example',
    userVerification: 'required',
  });
  assert.throws(() => passkeyPolicy({ rpId: 'wallet.420.example', origin: 'http://wallet.420.example' }), /must use https/i);
  assert.throws(() => passkeyPolicy({ rpId: 'wallet.420.example:443', origin: 'https://wallet.420.example' }), /invalid RP ID/i);
});
