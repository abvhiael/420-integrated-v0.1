import test from 'node:test';
import assert from 'node:assert/strict';
import type { IndexerPublicApi420 } from '../src/api-surface.js';
import { INDEXER_API_VERSION_420 } from '../src/api-surface.js';
import { routeIndexerHttp420 } from '../src/http-transport.js';

function throwingApi420(): IndexerPublicApi420 {
  return {
    version: INDEXER_API_VERSION_420,
    async health() { return { status: 'ok', apiVersion: INDEXER_API_VERSION_420 }; },
    async readiness() { throw new Error('database password leaked here'); },
    async status() { throw new Error('backend unavailable'); },
    async blocks() { throw new Error('backend unavailable'); },
    async block() { throw new Error('backend unavailable'); },
    async transactions() { throw new Error('backend unavailable'); },
    async transaction() { throw new Error('backend unavailable'); },
    async receipt() { throw new Error('backend unavailable'); },
    async logs() { throw new Error('backend unavailable'); },
    async address() { throw new Error('backend unavailable'); },
    async assetTransfers() { throw new Error('backend unavailable'); },
    async protocolEvents() { throw new Error('backend unavailable'); },
    async protocolObject() { throw new Error('backend unavailable'); },
    async search() { throw new Error('backend unavailable'); }
  } as IndexerPublicApi420;
}

test('HTTP transport distinguishes invalid requests from backend failures', async () => {
  const api = throwingApi420();
  const invalid = await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=nope');
  const backend = await routeIndexerHttp420(api, 'GET', '/v1/status?chainId=420');

  assert.deepEqual(invalid.body, {
    apiVersion: 'v1',
    error: { code: 'invalid_request', message: 'chainId must be an unsigned integer' }
  });
  assert.equal(invalid.status, 400);

  assert.equal(backend.status, 500);
  assert.deepEqual(backend.body, {
    apiVersion: 'v1',
    error: { code: 'internal_error', message: 'internal server error' }
  });
  assert.doesNotMatch(JSON.stringify(backend.body), /backend unavailable|password/i);
});

test('HTTP transport rejects oversized direct-resource path parameters', async () => {
  const api = throwingApi420();
  const oversized = 'a'.repeat(513);
  const result = await routeIndexerHttp420(api, 'GET', `/v1/blocks/${oversized}?chainId=420`);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    apiVersion: 'v1',
    error: { code: 'invalid_request', message: 'path parameter exceeds maximum length' }
  });
});
