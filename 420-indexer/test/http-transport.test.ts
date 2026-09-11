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

  async blocks(chainId: bigint, request: PageRequest420 = {}): Promise<QueryPage420<BlockDto420>> {
    this.calls.push({ name: 'blocks', chainId, request });
    return { items: [{ chainId: chainId.toString(), number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' }], nextCursor: 'next-block' };
  }

  async block(chainId: bigint, id: string): Promise<BlockDto420 | null> {
    this.calls.push({ name: 'block', chainId, request: { id } });
    if (id === 'missing') return null;
    return { chainId: chainId.toString(), number: '10', hash: '0x10', parentHash: '0x09', timestamp: '1700000010' };
  }

  async transactions(chainId: bigint, request: TransactionPageRequest420 = {}): Promise<QueryPage420<TransactionDto420>> {
    this.calls.push({ name: 'transactions', chainId, request });
    return { items: [], nextCursor: null };
  }

  async transaction(chainId: bigint, hash: string): Promise<TransactionDto420 | null> {
    this.calls.push({ name: 'transaction', chainId, request: { hash } });
    if (hash === 'missing') return null;
    return { chainId: chainId.toString(), hash, blockNumber: '10', blockHash: '0x10', transactionIndex: 0, from: '0xfrom', to: '0xto', valueWei: '1', input: '0x' };
  }

  async receipt(chainId: bigint, hash: string): Promise<ReceiptDto420 | null> {
    this.calls.push({ name: 'receipt', chainId, request: { hash } });
    if (hash === 'missing') return null;
    return { chainId: chainId.toString(), transactionHash: hash, blockNumber: '10', blockHash: '0x10', transactionIndex: 0, status: 1, contractAddress: null };
  }

  async logs(chainId: bigint, request: LogPageRequest420 = {}): Promise<QueryPage420<LogDto420>> {
    this.calls.push({ name: 'logs', chainId, request });
    return {
      items: [{ chainId: chainId.toString(), blockNumber: '10', blockHash: '0x10', transactionHash: '0xabc', transactionIndex: 0, logIndex: 1, address: '0xcontract', topics: ['0xtopic'], data: '0xdata' }],
      nextCursor: null
    };
  }

  async address(chainId: bigint, address: string): Promise<AddressDto420 | null> {
    this.calls.push({ name: 'address', chainId, request: { address } });
    if (address === 'missing') return null;
    return { chainId: chainId.toString(), address, isContract: false };
  }

  async assetTransfers(chainId: bigint, request: AssetTransferPageRequest420 = {}): Promise<QueryPage420<AssetTransferDto420>> {
    this.calls.push({ name: 'assetTransfers', chainId, request });
    return { items: [], nextCursor: null };
  }

  async protocolEvents(chainId: bigint, request: ProtocolEventPageRequest420 = {}): Promise<QueryPage420<ProtocolEventDto420>> {
    this.calls.push({ name: 'protocolEvents', chainId, request });
    return { items: [], nextCursor: null };
  }

  async protocolObject(chainId: bigint, protocol: string, objectKey: string): Promise<ProtocolObjectStateDto420 | null> {
    this.calls.push({ name: 'protocolObject', chainId, request: { protocol, objectKey } });
    if (objectKey === 'missing') return null;
    return {
      chainId: chainId.toString(),
      protocol,
      objectKey,
      contractAddress: '0xcontract',
      eventName: 'ProposalActivated',
      lifecycleState: 'ACTIVE',
      fields: { proposalId: objectKey },
      blockNumber: '10',
      blockHash: '0x10',
      transactionHash: '0xabc',
      transactionIndex: 0,
      logIndex: 1
    };
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

test('HTTP transport routes direct block, transaction and address resources', async () => {
  const api = new FakeApi420();
  const block = await routeIndexerHttp420(api, 'GET', '/v1/blocks/10?chainId=420');
  const transaction = await routeIndexerHttp420(api, 'GET', '/v1/transactions/0xabc?chainId=420');
  const address = await routeIndexerHttp420(api, 'GET', '/v1/addresses/0xdef?chainId=420');

  assert.equal(block.status, 200);
  assert.equal(transaction.status, 200);
  assert.equal(address.status, 200);
  assert.deepEqual(api.calls, [
    { name: 'block', chainId: 420n, request: { id: '10' } },
    { name: 'transaction', chainId: 420n, request: { hash: '0xabc' } },
    { name: 'address', chainId: 420n, request: { address: '0xdef' } }
  ]);
});

test('HTTP transport routes receipts and paged logs through the public API', async () => {
  const api = new FakeApi420();
  const receipt = await routeIndexerHttp420(api, 'GET', '/v1/transactions/0xabc/receipt?chainId=420');
  const logs = await routeIndexerHttp420(api, 'GET', '/v1/logs?chainId=420&address=0xcontract&limit=25&direction=asc&cursor=abc');

  assert.equal(receipt.status, 200);
  assert.equal(logs.status, 200);
  assert.deepEqual(api.calls, [
    { name: 'receipt', chainId: 420n, request: { hash: '0xabc' } },
    { name: 'logs', chainId: 420n, request: { cursor: 'abc', limit: 25, direction: 'asc', address: '0xcontract' } }
  ]);
});

test('HTTP transport routes direct protocol object state with encoded keys', async () => {
  const api = new FakeApi420();
  const result = await routeIndexerHttp420(api, 'GET', '/v1/protocols/420Governance/objects/proposal%3A0xabc?chainId=420');

  assert.equal(result.status, 200);
  assert.deepEqual(api.calls[0], {
    name: 'protocolObject',
    chainId: 420n,
    request: { protocol: '420Governance', objectKey: 'proposal:0xabc' }
  });
  assert.deepEqual(result.body, {
    apiVersion: 'v1',
    data: {
      chainId: '420',
      protocol: '420Governance',
      objectKey: 'proposal:0xabc',
      contractAddress: '0xcontract',
      eventName: 'ProposalActivated',
      lifecycleState: 'ACTIVE',
      fields: { proposalId: 'proposal:0xabc' },
      blockNumber: '10',
      blockHash: '0x10',
      transactionHash: '0xabc',
      transactionIndex: 0,
      logIndex: 1
    }
  });
});

test('HTTP transport returns stable 404 envelopes for missing direct resources', async () => {
  const api = new FakeApi420();
  const block = await routeIndexerHttp420(api, 'GET', '/v1/blocks/missing?chainId=420');
  const transaction = await routeIndexerHttp420(api, 'GET', '/v1/transactions/missing?chainId=420');
  const receipt = await routeIndexerHttp420(api, 'GET', '/v1/transactions/missing/receipt?chainId=420');
  const address = await routeIndexerHttp420(api, 'GET', '/v1/addresses/missing?chainId=420');
  const protocolObject = await routeIndexerHttp420(api, 'GET', '/v1/protocols/420Governance/objects/missing?chainId=420');

  assert.deepEqual(block.body, { apiVersion: 'v1', error: { code: 'not_found', message: 'block not found' } });
  assert.equal(transaction.status, 404);
  assert.deepEqual(receipt.body, { apiVersion: 'v1', error: { code: 'not_found', message: 'receipt not found' } });
  assert.equal(address.status, 404);
  assert.deepEqual(protocolObject.body, { apiVersion: 'v1', error: { code: 'not_found', message: 'protocol object not found' } });
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
