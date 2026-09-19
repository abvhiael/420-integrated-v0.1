import test from 'node:test';
import assert from 'node:assert/strict';
import { availability, validateRuntimeConfig } from '../core/config.js';

const valid = {
  schema: '420-exchange-web-runtime-v14.1',
  site: { productionOrigin: 'https://exchange.420integrated.org' },
  network: { rpcUrl: null, explorerUrl: null },
  api: { baseUrl: null, streamUrl: null, transport: 'websocket-or-sse', schemaMajor: 14, schemaMinor: 0 },
  features: {
    markets: true,
    marketDetail: false,
    swap: false,
    limitOrders: false,
    bridge: false,
    portfolio: false,
    walletConnection: false,
  },
};

test('accepts the V14.1 production runtime contract', () => {
  assert.equal(validateRuntimeConfig(structuredClone(valid)).api.schemaMajor, 14);
});

test('fails closed on the wrong production origin', () => {
  const config = structuredClone(valid);
  config.site.productionOrigin = 'https://example.com';
  assert.throws(() => validateRuntimeConfig(config));
});

test('fails closed on future client schema', () => {
  const config = structuredClone(valid);
  config.api.schemaMinor = 1;
  assert.throws(() => validateRuntimeConfig(config));
});

test('rejects insecure runtime endpoints', () => {
  const config = structuredClone(valid);
  config.api.baseUrl = 'http://api.example.com';
  assert.throws(() => validateRuntimeConfig(config));
});

test('feature availability is explicit', () => {
  assert.equal(availability(valid, 'markets'), true);
  assert.equal(availability(valid, 'swap'), false);
});
