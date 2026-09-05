import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  USEROP_DOMAIN,
  buildPasskeyUserOpChallenge,
  buildPasskeyCredentialBinding,
  decodeP256DerSignature,
  encodePasskeyUserOpSignature,
} from '../core/passkey-userop.js';

const ACCOUNT = '0x0000000000000000000000000000000000000420';
const OP_HASH = `0x${'ab'.repeat(32)}`;

test('passkey UserOp challenge is deterministic and context-bound', async () => {
  const input = { chainId: 420, smartAccount: ACCOUNT, authorizationEpoch: 7, userOpHash: OP_HASH, nonce: 9, cryptoImpl: webcrypto };
  const a = await buildPasskeyUserOpChallenge(input);
  const b = await buildPasskeyUserOpChallenge(input);
  const c = await buildPasskeyUserOpChallenge({ ...input, authorizationEpoch: 8 });
  const d = await buildPasskeyUserOpChallenge({ ...input, nonce: 10 });
  assert.equal(a.length, 32);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.notDeepEqual(a, d);
  assert.equal(USEROP_DOMAIN, '420/WALLET/PASSKEY_USEROP/V1');
});

test('DER decoder extracts P-256 r and s', () => {
  const der = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
  assert.deepEqual(decodeP256DerSignature(der), { r: 1n, s: 2n });
  assert.throws(() => decodeP256DerSignature(Uint8Array.from([0x01, 0x02])));
});

test('passkey signature envelope is mode-prefixed ABI', () => {
  const auth = new Uint8Array(37);
  auth[32] = 0x05;
  const client = new TextEncoder().encode('{"type":"webauthn.get"}');
  const der = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
  const encoded = encodePasskeyUserOpSignature({
    credentialIdHash: `0x${'11'.repeat(32)}`,
    authenticatorData: auth,
    clientDataJSON: client,
    signature: der,
  });
  assert.ok(encoded.startsWith('0x01'));
  assert.ok(encoded.length > 2 + 2 * 160);
  assert.ok(encoded.includes('11'.repeat(32)));
});

test('credential binding hashes id, rpId and canonical origin', async () => {
  const binding = await buildPasskeyCredentialBinding({
    rawId: Uint8Array.from([1, 2, 3, 4]),
    rpId: 'Wallet.420.Example',
    origin: 'https://wallet.420.example/path',
    cryptoImpl: webcrypto,
  });
  assert.match(binding.credentialIdHash, /^0x[0-9a-f]{64}$/);
  assert.match(binding.rpIdHash, /^0x[0-9a-f]{64}$/);
  assert.match(binding.originHash, /^0x[0-9a-f]{64}$/);
});
