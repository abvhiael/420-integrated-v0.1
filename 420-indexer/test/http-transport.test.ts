import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  AssetTransferPageRequest420,
  IndexerPublicApi420,
  LogPageRequest420,
  PageRequest420,
  ProtocolEventPageRequest420,
  SearchResult420,
  TransactionPageRequest420
} from '../src/api-surface.js';
import { INDEXER_API_VERSION_420 } from '../src/api-surface.js';
import type { AddressDto420, AssetTransferDto420, BlockDto420, ProtocolEventDto420, ProtocolObjectStateDto420, TransactionDto420 } from '../src/public-dto.js';
import type { LogDto420, ReceiptDto420 } from '../src/receipt-log-dto.js';
import type { QueryPage420 } from '../src/query-layer.js';
import { routeIndexerHttp420 } from '../src/http-transport.js';

class FakeApi420 implements IndexerPublicApi420 {
  readonly version = INDEXER_API_VERSION_420;
  calls: Array<{ name: string; chainId: bigint; request?: unknown }> = [];

  async health() { return { status: 'ok' as const, apiVersion: 'v1' as const }; }
  async readiness(chainId: bigint) { this.calls.push({ name: 'readiness', chainId }); return { ready: true, databaseReady: true, chainId: chainId.toString(), indexedHead: '10' }; }
  async status(chainId: bigint) { this.calls.push({ name: 'status', chainId }); return { chainId: chainId.toString(), indexedHead: '10', indexedHeadHash: '0x10', indexedHeadTimestamp: '1700000010', finality: { mode: 'finalized' as const, confirmations: null, safeHead: '10' }, lag: null, authoritative: false as const }; }

  async blocks(chainId: bigint, request: PageRequest420 = {}): Promise<QueryPage420<BlockDto420>> { this.calls.push({ name: 'blocks', chainId, request }); return { items: [{ chainId: chainId.toString(), number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' }], nextCursor: 'next-block' }; }
  async block(chainId: bigint, id: string): Promise<BlockDto420 | null> { this.calls.push({ name: 'block', chainId, request: { id } }); return id === 'missing' ? null : { chainId: chainId.toString(), number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' }; }
  async transactions(chainId: bigint, request: TransactionPageRequest420 = {}): Promise<QueryPage420<TransactionDto420>> { this.calls.push({ name: 'transactions', chainId, request }); return { items: [], nextCursor: null }; }
  async transaction(chainId: bigint, hash: string): Promise<TransactionDto420 | null> { this.calls.push({ name: 'transaction', chainId, request: { hash } }); return hash === 'missing' ? null : { chainId: chainId.toString(), hash, blockNumber: '10', blockHash: '0x10', transactionIndex: 0, from: '0xfrom', to: '0xto', valueWei: '1', input: '0x' }; }
  async receipt(chainId: bigint, hash: string): Promise<ReceiptDto420 | null> { this.calls.push({ name: 'receipt', chainId, request: { hash } }); return hash === 'missing' ? null : { chainId: chainId.toString(), transactionHash: hash, blockNumber: '10', blockHash: '0x10', transactionIndex: 0, status: 1, contractAddress: null }; }
  async logs(chainId: bigint, request: LogPageRequest420 = {}): Promise<QueryPage420<LogDto420>> { this.calls.push({ name: 'logs', chainId, request }); return { items: [{ chainId: chainId.toString(), blockNumber: '10', blockHash: '0x10', transactionHash: '0xabc', transactionIndex: 0, logIndex: 1, address: '0xcontract', topics: ['0xtopic'], data: '0xdata' }], nextCursor: null }; }
  async address(chainId: bigint, address: string): Promise<AddressDto420 | null> { this.calls.push({ name: 'address', chainId, request: { address } }); return address === 'missing' ? null : { chainId: chainId.toString(), address, isContract: false }; }
  async assetTransfers(chainId: bigint, request: AssetTransferPageRequest420 = {}): Promise<QueryPage420<AssetTransferDto420>> { this.calls.push({ name: 'assetTransfers', chainId, request }); return { items: [], nextCursor: null }; }
  async protocolEvents(chainId: bigint, request: ProtocolEventPageRequest420 = {}): Promise<QueryPage420<ProtocolEventDto420>> { this.calls.push({ name: 'protocolEvents', chainId, request }); return { items: [], nextCursor: null }; }
  async protocolObject(chainId: bigint, protocol: string, objectKey: string): Promise<ProtocolObjectStateDto420 | null> { this.calls.push({ name: 'protocolObject', chainId, request: { protocol, objectKey } }); if (objectKey === 'missing') return null; return { chainId: chainId.toString(), protocol, objectKey, contractAddress: '0xcontract', eventName: 'ProposalActivated', lifecycleState: 'ACTIVE', fields: { proposalId: objectKey }, blockNumber: '10', blockHash: '0x10', transactionHash: '0xabc', transactionIndex: 0, logIndex: 1 }; }
  async search(chainId: bigint, term: string, limit?: number): Promise<SearchResult420[]> { this.calls.push({ name: 'search', chainId, request: { term, limit } }); return [{ type: 'block', key: '10', value: '0x10' }]; }
}

test('HTTP transport exposes health readiness and indexer status metadata', async () => {
  const api = new FakeApi420();
  const health = await routeIndexerHttp420(api, 'GET', '/health');
  const ready = await routeIndexerHttp420(api, 'GET', '/ready?chainId=420');
  const status = await routeIndexerHttp420(api, 'GET', '/v1/status?chainId=420');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { apiVersion: 'v1', data: { status: 'ok', apiVersion: 'v1' } });
  assert.equal(ready.status, 200);
  assert.equal(status.status, 200);
  assert.deepEqual(api.calls, [{ name: 'readiness', chainId: 420n }, { name: 'status', chainId: 420n }]);
});

test('HTTP transport routes paged block requests through the stable public API', async () => {
  const api = new FakeApi420();
  const result = await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&limit=25&direction=asc&cursor=abc');
  assert.equal(result.status, 200);
  assert.deepEqual(api.calls[0], { name: 'blocks', chainId: 420n, request: { cursor: 'abc', limit: 25, direction: 'asc' } });
});

test('HTTP transport routes direct block, transaction, receipts, logs and address resources', async () => {
  const api = new FakeApi420();
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/blocks/10?chainId=420')).status, 200);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/transactions/0xabc?chainId=420')).status, 200);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/transactions/0xabc/receipt?chainId=420')).status, 200);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/logs?chainId=420&address=0xcontract')).status, 200);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/addresses/0xdef?chainId=420')).status, 200);
});

test('HTTP transport routes direct protocol object state with encoded keys', async () => {
  const api = new FakeApi420();
  const result = await routeIndexerHttp420(api, 'GET', '/v1/protocols/420Governance/objects/proposal%3A0xabc?chainId=420');
  assert.equal(result.status, 200);
  assert.deepEqual(api.calls[0], { name: 'protocolObject', chainId: 420n, request: { protocol: '420Governance', objectKey: 'proposal:0xabc' } });
});

test('HTTP transport returns stable 404 envelopes for missing direct resources', async () => {
  const api = new FakeApi420();
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/blocks/missing?chainId=420')).status, 404);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/transactions/missing?chainId=420')).status, 404);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/transactions/missing/receipt?chainId=420')).status, 404);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/addresses/missing?chainId=420')).status, 404);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/protocols/420Governance/objects/missing?chainId=420')).status, 404);
});

test('HTTP transport parses transaction, asset, protocol and search filters', async () => {
  const api = new FakeApi420();
  await routeIndexerHttp420(api, 'GET', '/v1/transactions?chainId=420&address=0xabc');
  await routeIndexerHttp420(api, 'GET', '/v1/assets/transfers?chainId=420&assetKey=native%3A420&address=0xabc&beforeBlock=100');
  await routeIndexerHttp420(api, 'GET', '/v1/protocols/events?chainId=420&protocol=420Governance&objectKey=proposal%3A0xabc');
  await routeIndexerHttp420(api, 'GET', '/v1/search?chainId=420&q=10&limit=5');
  assert.equal(api.calls.length, 4);
});

test('HTTP transport exposes version metadata without requiring a chain id', async () => {
  const result = await routeIndexerHttp420(new FakeApi420(), 'GET', '/v1');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { apiVersion: 'v1', data: { version: 'v1' } });
});

test('HTTP transport fails closed on invalid query parameters and unknown routes', async () => {
  const api = new FakeApi420();
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/blocks')).status, 400);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&limit=201')).status, 400);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/blocks?chainId=420&direction=sideways')).status, 400);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/search?chainId=420')).status, 400);
  assert.equal((await routeIndexerHttp420(api, 'GET', '/v1/nope?chainId=420')).status, 404);
  assert.equal((await routeIndexerHttp420(api, 'POST', '/v1/blocks?chainId=420')).status, 405);
  assert.equal(api.calls.length, 0);
});
