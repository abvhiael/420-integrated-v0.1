import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfig } from '../core/config.js';

function config(gasQuote) {
  return {
    network: { chainId: null, rpcUrl: null },
    smartAccount: { factoryAddress: null, recoveryAuthority: null, salt: null },
    services: [],
    trackedAssets: [],
    gasQuote,
  };
}

test('Wallet accepts disabled sponsorship or HTTPS quote endpoint without credentials in static config', () => {
  assert.equal(validateRuntimeConfig(config({ enabled: false, endpoint: null })), true);
  assert.equal(validateRuntimeConfig(config({ enabled: true, endpoint: 'https://gas.example.test/v1/quotes' })), true);
  assert.equal(validateRuntimeConfig(config({ enabled: true, endpoint: 'http://localhost:4200/v1/quotes' })), true);
});

test('Wallet refuses insecure remote quote endpoint and embedded service credentials', () => {
  assert.throws(() => validateRuntimeConfig(config({ enabled: true, endpoint: 'http://gas.example.test/v1/quotes' })), /HTTPS outside localhost/);
  for (const field of ['token', 'credential', 'secret', 'apiKey', 'authorization']) {
    assert.throws(() => validateRuntimeConfig(config({ enabled: false, endpoint: null, [field]: 'do-not-store-me' })), /must not be stored/);
  }
});
