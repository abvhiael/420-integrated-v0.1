import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  authenticatePasskey,
  base64urlDecode,
  base64urlEncode,
  buildPasskeyChallenge,
  buildPasskeyCreationOptions,
  buildPasskeyRequestOptions,
  parsePasskeyAssertion,
  passkeyPolicy,
  registerPasskey,
  validateAuthenticatorData,
} from '../core/passkeys.js';

const hash = `0x${'11'.repeat(32)}`;
const registrationChallenge = `0x${'22'.repeat(32)}`;
const rawCredentialId = Uint8Array.from([1, 2, 3, 4]);
const credentialId = base64urlEncode(rawCredentialId);
const encoder = new TextEncoder();
const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function assertion({ challenge = base64urlEncode(buildPasskeyChallenge(hash)), origin = 'https://wallet.420.example' } = {}) {
  const client = encoder.encode(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
  return {
    id: credentialId,
    rawId: asBuffer(rawCredentialId),
    type: 'public-key',
    response: {
      clientDataJSON: asBuffer(client),
      authenticatorData: asBuffer(Uint8Array.from([5, 6, 7])),
      signature: asBuffer(Uint8Array.from([8, 9, 10])),
      userHandle: null,
    },
  };
}

function registration({ challenge = base64urlEncode(buildPasskeyChallenge(registrationChallenge)), origin = 'https://wallet.420.example' } = {}) {
  const client = encoder.encode(JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false }));
  return {
    id: credentialId,
    rawId: asBuffer(rawCredentialId),
    type: 'public-key',
    response: {
      clientDataJSON: asBuffer(client),
      attestationObject: asBuffer(Uint8Array.from([0xa3, 0x01, 0x02])),
      getTransports: () => ['internal', 'hybrid'],
    },
  };
}

function authenticatorData({ rpId = 'wallet.420.example', flags = 0x05, signCount = 1 } = {}) {
  const rpIdHash = createHash('sha256').update(rpId).digest();
  const bytes = new Uint8Array(37);
  bytes.set(rpIdHash, 0);
  bytes[32] = flags;
  new DataView(bytes.buffer).setUint32(33, signCount, false);
  return bytes;
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

test('creation options enforce discoverable ES256 credentials with required user verification', () => {
  const options = buildPasskeyCreationOptions({
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([9, 8, 7]),
    userName: '0x1111',
    excludeCredentialIds: [credentialId],
  });
  assert.equal(options.rp.id, 'wallet.420.example');
  assert.equal(options.pubKeyCredParams[0].alg, -7);
  assert.equal(options.authenticatorSelection.residentKey, 'required');
  assert.equal(options.authenticatorSelection.userVerification, 'required');
  assert.equal(options.attestation, 'none');
  assert.deepEqual([...options.excludeCredentials[0].id], [1, 2, 3, 4]);
  assert.throws(() => buildPasskeyCreationOptions({
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: new Uint8Array(65),
    userName: 'owner',
  }), /1-64 bytes/i);
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

test('authenticatorData validates exact RP ID hash plus UP and UV flags', async () => {
  const parsed = await validateAuthenticatorData(authenticatorData({ flags: 0x05, signCount: 9 }), {
    expectedRpId: 'wallet.420.example',
    previousSignCount: 8,
  });
  assert.equal(parsed.rpId, 'wallet.420.example');
  assert.equal(parsed.userPresent, true);
  assert.equal(parsed.userVerified, true);
  assert.equal(parsed.signCount, 9);
  assert.equal(parsed.backupEligible, false);
  assert.equal(parsed.backupState, false);
});

test('authenticatorData fails closed on RP ID mismatch or missing presence/verification flags', async () => {
  await assert.rejects(validateAuthenticatorData(authenticatorData({ rpId: 'evil.example' }), {
    expectedRpId: 'wallet.420.example',
  }), /RP ID hash mismatch/i);
  await assert.rejects(validateAuthenticatorData(authenticatorData({ flags: 0x04 }), {
    expectedRpId: 'wallet.420.example',
  }), /user presence flag missing/i);
  await assert.rejects(validateAuthenticatorData(authenticatorData({ flags: 0x01 }), {
    expectedRpId: 'wallet.420.example',
  }), /user verification flag missing/i);
});

test('authenticatorData sign counter rejects rollback/replay while allowing authenticators that always report zero', async () => {
  await assert.rejects(validateAuthenticatorData(authenticatorData({ signCount: 7 }), {
    expectedRpId: 'wallet.420.example',
    previousSignCount: 7,
  }), /sign counter did not advance/i);
  await assert.rejects(validateAuthenticatorData(authenticatorData({ signCount: 6 }), {
    expectedRpId: 'wallet.420.example',
    previousSignCount: 7,
  }), /sign counter did not advance/i);
  const zeroCounter = await validateAuthenticatorData(authenticatorData({ signCount: 0 }), {
    expectedRpId: 'wallet.420.example',
    previousSignCount: 0,
  });
  assert.equal(zeroCounter.signCount, 0);
});

test('authenticatorData rejects malformed length and invalid prior counter state', async () => {
  await assert.rejects(validateAuthenticatorData(Uint8Array.from([1, 2, 3]), {
    expectedRpId: 'wallet.420.example',
  }), /at least 37 bytes/i);
  await assert.rejects(validateAuthenticatorData(authenticatorData(), {
    expectedRpId: 'wallet.420.example',
    previousSignCount: -1,
  }), /invalid previous WebAuthn sign counter/i);
});

test('browser registration uses navigator.credentials.create and returns normalized public credential material only', async () => {
  let createOptions = null;
  const navigatorLike = { credentials: {
    create: async (options) => { createOptions = options; return registration(); },
    get: async () => { throw new Error('unexpected get'); },
  } };
  const result = await registerPasskey(navigatorLike, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([9, 8, 7]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' });
  assert.equal(createOptions.publicKey.userVerification, undefined);
  assert.equal(createOptions.publicKey.authenticatorSelection.userVerification, 'required');
  assert.equal(result.credentialId, credentialId);
  assert.equal(result.rawId, credentialId);
  assert.deepEqual(result.transports, ['internal', 'hybrid']);
  assert.equal(result.origin, 'https://wallet.420.example');
  assert.ok(result.attestationObject);
  assert.equal('privateKey' in result, false);
});

test('browser authentication uses navigator.credentials.get then validates origin, RP ID, UP/UV and counter', async () => {
  const auth = assertion();
  auth.response.authenticatorData = asBuffer(authenticatorData({ signCount: 12 }));
  let getOptions = null;
  const navigatorLike = { credentials: {
    create: async () => { throw new Error('unexpected create'); },
    get: async (options) => { getOptions = options; return auth; },
  } };
  const result = await authenticatePasskey(navigatorLike, {
    userOpHash: hash,
    rpId: 'wallet.420.example',
    credentialId,
  }, {
    expectedOrigin: 'https://wallet.420.example',
    previousSignCount: 11,
  });
  assert.equal(getOptions.publicKey.userVerification, 'required');
  assert.equal(result.credentialId, credentialId);
  assert.equal(result.authenticator.userVerified, true);
  assert.equal(result.authenticator.signCount, 12);
});

test('browser ceremonies fail closed when WebAuthn is unavailable, cancelled, cross-origin, or credential IDs drift', async () => {
  await assert.rejects(registerPasskey({}, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([1]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' }), /credentials API unavailable/i);

  const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  await assert.rejects(registerPasskey({ credentials: {
    create: async () => { throw denied; },
    get: async () => null,
  } }, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([1]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' }), /cancelled or denied/i);

  const crossOrigin = registration();
  crossOrigin.response.clientDataJSON = asBuffer(encoder.encode(JSON.stringify({
    type: 'webauthn.create',
    challenge: base64urlEncode(buildPasskeyChallenge(registrationChallenge)),
    origin: 'https://wallet.420.example',
    crossOrigin: true,
  })));
  await assert.rejects(registerPasskey({ credentials: {
    create: async () => crossOrigin,
    get: async () => null,
  } }, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([1]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' }), /cross-origin/i);

  const drifted = registration();
  drifted.id = base64urlEncode(Uint8Array.from([9, 9, 9]));
  await assert.rejects(registerPasskey({ credentials: {
    create: async () => drifted,
    get: async () => null,
  } }, {
    challenge: registrationChallenge,
    rpId: 'wallet.420.example',
    userId: Uint8Array.from([1]),
    userName: 'owner',
  }, { expectedOrigin: 'https://wallet.420.example' }), /credential ID mismatch/i);
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
