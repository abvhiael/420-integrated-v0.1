import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P256_PRECOMPILE,
  probeP256Precompile,
  qualifyPasskeyProduction,
  qualifyPasskeyRp,
  qualifyPasskeyVerifier,
} from '../core/passkey-readiness.js';

const verifier = '0x0000000000000000000000000000000000000abc';
const account = '0x0000000000000000000000000000000000000420';

function providerWith({ p256Result = `0x${'0'.repeat(64)}`, code = '0x6001' } = {}) {
  return {
    async request(method, params) {
      if (method === 'eth_call') {
        assert.equal(params[0].to, P256_PRECOMPILE);
        return p256Result;
      }
      if (method === 'eth_getCode') return code;
      throw new Error(`unexpected ${method}`);
    },
  };
}

test('production RP requires explicit HTTPS origin and exact browser-origin match', () => {
  assert.equal(qualifyPasskeyRp({ config: { production: false } }).reason, 'production-mode-required');
  assert.equal(qualifyPasskeyRp({ config: { production: true, origin: 'http://wallet.example', rpId: 'wallet.example' } }).reason, 'invalid-production-rp');
  assert.equal(qualifyPasskeyRp({
    config: { production: true, origin: 'https://wallet.420.example', rpId: '420.example' },
    browserOrigin: 'https://other.420.example',
  }).reason, 'browser-origin-mismatch');

  const ready = qualifyPasskeyRp({
    config: { production: true, origin: 'https://wallet.420.example', rpId: '420.example' },
    browserOrigin: 'https://wallet.420.example/path',
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.origin, 'https://wallet.420.example');
  assert.equal(ready.rpId, '420.example');
});

test('RIP-7212 precompile readiness requires a 32-byte false/true response shape', async () => {
  assert.equal((await probeP256Precompile(providerWith())).ready, true);
  assert.equal((await probeP256Precompile(providerWith({ p256Result: '0x' }))).reason, 'p256-precompile-unavailable');
});

test('verifier qualification fails closed on missing verifier, missing code, or missing P256 precompile', async () => {
  const base = { deployed: true, smartAccount: account, passkeyVerifier: verifier };
  assert.equal((await qualifyPasskeyVerifier(providerWith(), { ...base, passkeyVerifier: null })).reason, 'passkey-verifier-unconfigured');
  assert.equal((await qualifyPasskeyVerifier(providerWith({ code: '0x' }), base)).reason, 'passkey-verifier-no-code');
  assert.equal((await qualifyPasskeyVerifier(providerWith({ p256Result: '0x' }), base)).reason, 'p256-precompile-unavailable');
  assert.equal((await qualifyPasskeyVerifier(providerWith(), base)).ready, true);
});

test('production qualification remains disabled until runtime flag is explicitly enabled', async () => {
  const smartAccountState = { deployed: true, smartAccount: account, passkeyVerifier: verifier };
  const disabled = await qualifyPasskeyProduction({
    provider: providerWith(),
    smartAccountState,
    runtimeConfig: {
      passkey: { production: true, origin: 'https://wallet.420.example', rpId: '420.example' },
      features: { passkeys: false },
    },
    browserOrigin: 'https://wallet.420.example',
  });
  assert.equal(disabled.reason, 'runtime-passkeys-disabled');

  const ready = await qualifyPasskeyProduction({
    provider: providerWith(),
    smartAccountState,
    runtimeConfig: {
      passkey: { production: true, origin: 'https://wallet.420.example', rpId: '420.example' },
      features: { passkeys: true },
    },
    browserOrigin: 'https://wallet.420.example',
  });
  assert.deepEqual(ready, {
    ready: true,
    reason: 'production-passkeys-ready',
    origin: 'https://wallet.420.example',
    rpId: '420.example',
    verifier,
    p256Precompile: P256_PRECOMPILE,
  });
});
