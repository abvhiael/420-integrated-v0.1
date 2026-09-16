import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasQuoteHttpProvider420, gasQuoteProviderFromRuntime420 } from '../core/gas-quote-provider.js';

const request = { chainId: '420', authority: 'funding-request-only', executionAuthorization: false };

test('runtime quote provider is disabled unless explicitly enabled', () => {
  assert.equal(gasQuoteProviderFromRuntime420({ gasQuote: { enabled: false, endpoint: null } }), null);
  assert.equal(gasQuoteProviderFromRuntime420({}), null);
});

test('authenticated quote request uses injected short-lived credential without persisting it in config', async () => {
  const calls = [];
  const provider = createGasQuoteHttpProvider420({
    endpoint: 'https://gas.example.test/v1/quotes',
    credentialProvider: async (scope) => {
      assert.deepEqual(scope, { audience: '420gas', scope: 'gas:quote' });
      return 'short-lived-token';
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ quoteId: 'quote' }) };
    },
  });
  const quote = await provider.discoverQuote(request);
  assert.equal(quote.quoteId, 'quote');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer short-lived-token');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].options.body), request);
});

test('quote provider maps no-offer response to self-funded discovery result', async () => {
  const provider = createGasQuoteHttpProvider420({
    endpoint: 'http://localhost:4200/v1/quotes',
    fetchImpl: async () => ({ ok: false, status: 204 }),
  });
  assert.equal(await provider.discoverQuote(request), null);
});

test('quote provider fails closed on insecure remote endpoints, missing credentials, and service errors', async () => {
  assert.throws(() => createGasQuoteHttpProvider420({ endpoint: 'http://gas.example.test/v1/quotes', fetchImpl: async () => ({}) }), /HTTPS outside localhost/);
  const missingCredential = createGasQuoteHttpProvider420({
    endpoint: 'https://gas.example.test/v1/quotes',
    credentialProvider: async () => null,
    fetchImpl: async () => { throw new Error('must not fetch'); },
  });
  await assert.rejects(() => missingCredential.discoverQuote(request), /returned no credential/);
  const rejected = createGasQuoteHttpProvider420({
    endpoint: 'https://gas.example.test/v1/quotes',
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  await assert.rejects(() => rejected.discoverQuote(request), /rejected request \(403\)/);
});
