import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPasskeyForEnrollment } from '../core/passkey-enrollment.js';
import { base64UrlToBytes } from '../core/passkeys.js';

test('managed passkey registration captures public ES256 key material for on-chain review', async () => {
  const publicKey = Uint8Array.from([0x30, 0x59, ...new Uint8Array(65).fill(7)]);
  const credentials = {
    async create(options) {
      assert.equal(options.publicKey.userVerification, undefined);
      assert.equal(options.publicKey.authenticatorSelection.userVerification, 'required');
      return {
        id: 'managed-passkey',
        rawId: Uint8Array.from([4, 2, 0]),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: Uint8Array.from([1]).buffer,
          attestationObject: Uint8Array.from([2]).buffer,
          getTransports: () => ['internal'],
          getPublicKey: () => publicKey.buffer,
        },
      };
    },
  };
  const result = await registerPasskeyForEnrollment({
    credentials,
    challenge: new Uint8Array(32).fill(9),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    account: '0x0000000000000000000000000000000000000420',
  });
  assert.equal(result.id, 'managed-passkey');
  assert.deepEqual(base64UrlToBytes(result.publicKeySpki), publicKey);
});

test('managed passkey registration fails closed if authenticator public key cannot be obtained', async () => {
  const credentials = {
    async create() {
      return {
        id: 'managed-passkey',
        rawId: Uint8Array.from([1]),
        type: 'public-key',
        response: {
          clientDataJSON: Uint8Array.from([1]).buffer,
          attestationObject: Uint8Array.from([2]).buffer,
          getTransports: () => [],
        },
      };
    },
  };
  await assert.rejects(() => registerPasskeyForEnrollment({
    credentials,
    challenge: new Uint8Array(32).fill(9),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    account: '0x0000000000000000000000000000000000000420',
  }), /did not expose an ES256 public key/);
});
