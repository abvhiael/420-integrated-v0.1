import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ES256_ALG,
  authenticatePasskey,
  base64UrlToBytes,
  buildAuthenticationOptions,
  buildPasskeyChallenge,
  buildRegistrationOptions,
  bytesToBase64Url,
  normalizeRpConfiguration,
  passkeyAuthorityStatus,
  registerPasskey,
} from '../core/passkeys.js';

const fakeCrypto = {
  subtle: {
    async digest(_algorithm, bytes) {
      const input = new Uint8Array(bytes);
      const output = new Uint8Array(32);
      for (let i = 0; i < input.length; i += 1) output[i % 32] ^= input[i];
      return output.buffer;
    },
  },
};

test('base64url round trip is stable', () => {
  const source = Uint8Array.from([0, 1, 2, 253, 254, 255]);
  assert.deepEqual(base64UrlToBytes(bytesToBase64Url(source)), source);
});

test('rp configuration requires https outside localhost and host binding', () => {
  assert.deepEqual(
    normalizeRpConfiguration({ origin: 'https://wallet.420.example', rpId: '420.example' }),
    { origin: 'https://wallet.420.example', rpId: '420.example', production: false },
  );
  assert.throws(() => normalizeRpConfiguration({ origin: 'http://wallet.420.example' }), /HTTPS/);
  assert.throws(
    () => normalizeRpConfiguration({ origin: 'https://wallet.420.example', rpId: 'evil.example' }),
    /rpId/,
  );
  assert.throws(
    () => normalizeRpConfiguration({ origin: 'http://localhost:8080', production: true }),
    /production passkeys/,
  );
});

test('challenge binds chain account epoch operation and nonce', async () => {
  const base = {
    chainId: 420,
    smartAccount: '0x0000000000000000000000000000000000000420',
    authorizationEpoch: 7,
    operation: 'register',
    nonce: 'nonce-a',
    cryptoImpl: fakeCrypto,
  };
  const a = await buildPasskeyChallenge(base);
  const b = await buildPasskeyChallenge({ ...base, authorizationEpoch: 8 });
  const c = await buildPasskeyChallenge({ ...base, nonce: 'nonce-b' });
  assert.equal(a.length, 32);
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('registration requires ES256 user verification and no attestation', () => {
  const options = buildRegistrationOptions({
    challenge: new Uint8Array(32).fill(7),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    account: '0x0000000000000000000000000000000000000420',
    displayName: '420 Wallet',
  });
  assert.equal(options.publicKey.pubKeyCredParams[0].alg, ES256_ALG);
  assert.equal(options.publicKey.authenticatorSelection.userVerification, 'required');
  assert.equal(options.publicKey.attestation, 'none');
  assert.equal(options.publicKey.rp.id, '420.example');
});

test('authentication restricts known credential ids and requires user verification', () => {
  const credentialId = bytesToBase64Url(Uint8Array.from([1, 2, 3]));
  const options = buildAuthenticationOptions({
    challenge: new Uint8Array(32).fill(9),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    credentialIds: [credentialId],
  });
  assert.equal(options.publicKey.userVerification, 'required');
  assert.equal(options.publicKey.allowCredentials.length, 1);
  assert.deepEqual(options.publicKey.allowCredentials[0].id, Uint8Array.from([1, 2, 3]));
});

test('registration and authentication wrappers serialize browser credentials', async () => {
  const rawId = Uint8Array.from([4, 2, 0]);
  const registrationCredentials = {
    async create(options) {
      assert.equal(options.publicKey.rp.id, '420.example');
      return {
        id: 'credential-id',
        rawId,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: Uint8Array.from([1, 1]).buffer,
          attestationObject: Uint8Array.from([2, 2]).buffer,
          getTransports: () => ['internal'],
        },
      };
    },
  };
  const registered = await registerPasskey({
    credentials: registrationCredentials,
    challenge: new Uint8Array(32).fill(1),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    account: '0x0000000000000000000000000000000000000420',
  });
  assert.equal(registered.id, 'credential-id');
  assert.equal(registered.authenticatorAttachment, 'platform');
  assert.deepEqual(registered.transports, ['internal']);

  const authenticationCredentials = {
    async get(options) {
      assert.equal(options.publicKey.userVerification, 'required');
      return {
        id: 'credential-id',
        rawId,
        type: 'public-key',
        response: {
          clientDataJSON: Uint8Array.from([3]).buffer,
          authenticatorData: Uint8Array.from([4]).buffer,
          signature: Uint8Array.from([5]).buffer,
          userHandle: Uint8Array.from([6]).buffer,
        },
      };
    },
  };
  const authenticated = await authenticatePasskey({
    credentials: authenticationCredentials,
    challenge: new Uint8Array(32).fill(2),
    rp: { origin: 'https://wallet.420.example', rpId: '420.example' },
    credentialIds: [registered.rawId],
  });
  assert.equal(authenticated.id, 'credential-id');
  assert.ok(authenticated.signature);
});

test('passkey authority stays fail closed until runtime and SmartAccount P256 support are both ready', () => {
  assert.deepEqual(passkeyAuthorityStatus({ runtimeConfig: { features: { passkeys: false } } }), {
    enabled: false,
    reason: 'runtime-passkeys-disabled',
  });
  assert.deepEqual(passkeyAuthorityStatus({ runtimeConfig: { features: { passkeys: true } } }), {
    enabled: false,
    reason: 'smart-account-p256-verifier-unavailable',
  });
  assert.deepEqual(
    passkeyAuthorityStatus({ runtimeConfig: { features: { passkeys: true } }, smartAccountSupportsP256: true }),
    { enabled: true, reason: 'ready' },
  );
});
