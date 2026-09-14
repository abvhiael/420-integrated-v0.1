import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexerClient420, createIndexerControlView420, IndexerClientError420 } from '../src/indexer-client.mjs';

function network420(overrides = {}) {
  return {
    chainIdDecimal: '420',
    service: (name) => name === 'indexer' ? 'http://127.0.0.1:4202' : null,
    ...overrides
  };
}

function transport420(handler) {
  return { request: handler };
}

function ok(data, status = 200) {
  return { status, body: { apiVersion: 'v1', data } };
}

test('client binds to canonical manifest indexer service and selected chain', async () => {
  const seen = [];
  const client = createIndexerClient420({ network: network420(), transport: transport420(async (url, request) => { seen.push({ url, request }); return ok({ head: 'ok' }); }) });
  const result = await client.status();
  assert.equal(result.head, 'ok');
  assert.equal(client.baseUrl, 'http://127.0.0.1:4202');
  assert.equal(client.chainId, '420');
  assert.equal(client.canonicalAuthority, false);
  assert.match(seen[0].url, /^http:\/\/127\.0\.0\.1:4202\/v1\/status\?chainId=420$/);
  assert.equal(seen[0].request.method, 'GET');
});

test('cursor pagination follows public API limit and direction rules', async () => {
  let url;
  const client = createIndexerClient420({ network: network420(), transport: transport420(async (value) => { url = value; return ok({ items: [], nextCursor: null }); }) });
  await client.blocks({ cursor: 'cursor-1', limit: 200, direction: 'desc' });
  assert.match(url, /chainId=420/);
  assert.match(url, /cursor=cursor-1/);
  assert.match(url, /limit=200/);
  assert.match(url, /direction=desc/);
  assert.throws(() => client.blocks({ limit: 201 }), /limit must be an integer between 1 and 200/);
  assert.throws(() => client.blocks({ direction: 'sideways' }), /direction must be asc or desc/);
});

test('transaction, receipt and address queries validate identifiers', async () => {
  const urls = [];
  const client = createIndexerClient420({ network: network420(), transport: transport420(async (url) => { urls.push(url); return ok({}); }) });
  const hash = `0x${'ab'.repeat(32)}`;
  const address = '0x1111111111111111111111111111111111111111';
  await client.transaction(hash);
  await client.receipt(hash);
  await client.address(address);
  assert.match(urls[0], /\/v1\/transactions\/0xabab/);
  assert.match(urls[1], /\/receipt\?chainId=420$/);
  assert.match(urls[2], /\/v1\/addresses\/0x1111/);
  assert.throws(() => client.transaction('0x1234'), /transaction hash is invalid/);
  assert.throws(() => client.address('bad'), /address is invalid/);
});

test('readiness preserves HTTP 503 data rather than converting it into authority failure', async () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async () => ok({ ready: false, reasons: ['lagging'] }, 503)) });
  const readiness = await client.readiness();
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.reasons, ['lagging']);
});

test('API version mismatches fail closed', async () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async () => ({ status: 200, body: { apiVersion: 'v2', data: {} } })) });
  await assert.rejects(() => client.status(), /unsupported 420Indexer API version/);
});

test('structured indexer errors preserve code and HTTP status', async () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async () => ({ status: 404, body: { apiVersion: 'v1', error: { code: 'not_found', message: 'block not found' } } })) });
  await assert.rejects(async () => {
    try { await client.block('999'); } catch (error) {
      assert.equal(error instanceof IndexerClientError420, true);
      assert.equal(error.status, 404);
      assert.equal(error.code, 'not_found');
      throw error;
    }
  }, /block not found/);
});

test('search trims terms and rejects empty queries', async () => {
  let url;
  const client = createIndexerClient420({ network: network420(), transport: transport420(async (value) => { url = value; return ok([]); }) });
  await client.search('  ProtocolRegistry  ', 20);
  assert.match(url, /q=ProtocolRegistry/);
  assert.match(url, /limit=20/);
  assert.throws(() => client.search('   '), /search term is required/);
});

test('asset-transfer beforeBlock uses unsigned decimal strings only', async () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async () => ok({ items: [], nextCursor: null })) });
  await client.assetTransfers({ beforeBlock: '12345' });
  assert.throws(() => client.assetTransfers({ beforeBlock: '-1' }), /beforeBlock must be an unsigned decimal string/);
});

test('diagnostics combine health readiness and status while retaining projection boundary', async () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async (url) => {
    if (url.includes('/health')) return ok({ ok: true });
    if (url.includes('/ready')) return ok({ ready: true });
    return ok({ indexedHead: '100' });
  }) });
  const diagnostics = await client.diagnostics();
  assert.equal(diagnostics.source, '420Indexer');
  assert.equal(diagnostics.canonicalAuthority, false);
  assert.equal(diagnostics.health.ok, true);
  assert.equal(diagnostics.readiness.ready, true);
  assert.equal(diagnostics.status.indexedHead, '100');
});

test('control view explicitly marks indexer data as non-authoritative projection state', () => {
  const client = createIndexerClient420({ network: network420(), transport: transport420(async () => ok({})) });
  const view = createIndexerControlView420(client);
  assert.equal(view.canonicalAuthority, false);
  assert.equal(view.source, '420Indexer');
  assert.match(view.securityRule, /must not authorize protocol state transitions/);
  assert.ok(view.supportedResources.includes('protocol-objects'));
});

test('missing, credentialed or non-http indexer services fail closed', () => {
  assert.throws(() => createIndexerClient420({ network: network420({ service: () => null }), transport: transport420(async () => ok({})) }), /no 420Indexer service/);
  assert.throws(() => createIndexerClient420({ network: network420({ service: () => 'ftp://example.test' }), transport: transport420(async () => ok({})) }), /must use HTTP\(S\)/);
  assert.throws(() => createIndexerClient420({ network: network420({ service: () => 'https://user:pass@example.test' }), transport: transport420(async () => ok({})) }), /must not embed credentials/);
});
