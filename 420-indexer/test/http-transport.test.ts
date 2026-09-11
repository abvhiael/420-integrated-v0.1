import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  AssetTransferPageRequest420,
  IndexerPublicApi420,
  PageRequest420,
  ProtocolEventPageRequest420,
  SearchResult420,
  TransactionPageRequest420
} from '../src/api-surface.js';
import { INDEXER_API_VERSION_420 } from '../src/api-surface.js';
import type { AssetTransferDto420, BlockDto420, TransactionDto420 } from '../src/public-dto.js';
import type { QueryPage420 } from '../src/query-layer.js';
import type { QueryRow420 } from '../src/query-service.js';
import { routeIndexerHttp420 } from '../src/http-transport.js';

class FakeApi420 implements IndexerPublicApi420 {
  readonly version = INDEXER_API_VERSION_420;
  calls: Array<{ name: string; chainId: bigint; request?: unknown }> = [];

  async blocks(chainId: bigint, request: PageRequest420 = {}): Promise<QueryPage420<BlockDto420>> {
    this.calls.push({ name: 'blocks', chainId, request });
    return { items: [{ chainId: chainId.toString(), number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' }], nextCursor: 'next-block' };
  }

  async transactions(chainId: bigint, request: TransactionPageRequest420 = {}): Promise<QueryPage420<TransactionDto420>> {
    this.calls.push({ name: 'transactions', chainId, request });
    return { items: [], nextCursor: null };
  }

  async assetTransfers(chainId: bigint, request: AssetTransferPageRequest420 = {}): Promise<QueryPage420<AssetTransferDto420>> {
    this.calls.push({ name: 'assetTransfers', chainId, request });
    return { items: [], nextCursor: null };
  }

  async protocolEvents(chainId: bigint, request: ProtocolEventPageRequest420 = {}): Promise<QueryPage420<QueryRow420>> {
    this.calls.push({ name: 'protocolEvents', chainId, request });
    return { items: [], nextCursor: null };
  }

  async search(chainId: bigint, term: string, limit?: number): Promise<SearchResult420[]> {
    this.calls.push({ name: 'search', chainId, request: { term, limit } });
    return [{ type: 'block', key: '10', value: '0x10' }];
  }
}

test('HTTP transport routes paged block requests through the stable public API', async () => {
  const api = new FakeApi420();
  const result = await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&limit=25&direction=asc&cursor=abc');
  assert.equal(result.status, 200);
  assert.deepEqual(api.calls[0], { name: 'blocks', chainId: 420n, request: { cursor: 'abc', limit: 25, direction: 'asc' } });
  assert.deepEqual(result.body, {
    apiVersion: 'v1',
    data: { items: [{ chainId: '420', number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' }], nextCursor: 'next-block' }
  });
});

test('HTTP transport parses transaction, asset, protocol and search filters', async () => {
  const api = new FakeApi420();
  await routeIndexerHttp420(api, 'GET', '/v1/transactions?chainId=420&address=0xabc');
  await routeIndexerHttp420(api, 'GET', '/v1/assets/transfers?chainId=420&assetKey=native%3A420&address=0xabc&beforeBlock=100');
  await routeIndexerHttp420(api, 'GET', '/v1/protocols/events?chainId=420&protocol=420Governance&objectKey=proposal%3A0xabc');
  await routeIndexerHttp420(api, 'GET', '/v1/search?chainId=420&q=10&limit=5');

  assert.deepEqual(api.calls[0], { name: 'transactions', chainId: 420n, request: { cursor: undefined, limit: undefined, direction: undefined, address: '0xabc' } });
  assert.deepEqual(api.calls[1], { name: 'assetTransfers', chainId: 420n, request: { cursor: undefined, limit: undefined, direction: undefined, assetKey: 'native:420', address: '0xabc', beforeBlock: 100n } });
  assert.deepEqual(api.calls[2], { name: 'protocolEvents', chainId: 420n, request: { cursor: undefined, limit: undefined, direction: undefined, protocol: '420Governance', objectKey: 'proposal:0xabc' } });
  assert.deepEqual(api.calls[3], { name: 'search', chainId: 420n, request: { term: '10', limit: 5 } });
});

test('HTTP transport exposes version metadata without requiring a chain id', async () => {
  const result = await routeIndexerHttp420(new FakeApi420(), 'GET', '/v1');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { apiVersion: 'v1', data: { version: 'v1' } });
});

test('HTTP transport fails closed on invalid query parameters and unknown routes', async () => {
  const api = new FakeApi420();
  const missingChain = await routeIndexerHttp420(api, 'GET', '/v1/blocks');
  const badLimit = await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&limit=201');
  const badDirection = await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&direction=sideways');
  const missingSearch = await routeIndexerHttp420(api, 'GET', '/v1/search?chainId=420');
  const unknown = await routeIndexerHttp420(api, 'GET', '/v1/nope?chainId=420');
  const method = await routeIndexerHttp420(api, 'POST', '/v1/blocks?chainId=420');

  assert.equal(missingChain.status, 400);
  assert.equal(badLimit.status, 400);
  assert.equal(badDirection.status, 400);
  assert.equal(missingSearch.status, 400);
  assert.equal(unknown.status, 404);
  assert.equal(method.status, 405);
  assert.equal(api.calls.length, 0);
});
