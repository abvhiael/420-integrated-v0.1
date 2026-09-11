import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { decodeAssetTransferCursor420 } from '../src/query-layer.js';
import { classifySearch420 } from '../src/search-router.js';
import { blockDto420, transactionDto420, assetTransferDto420 } from '../src/public-dto.js';
import { IndexerQueryService420 } from '../src/query-service.js';

class FakeDb420 implements SqlExecutor420 {
  calls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  queue: unknown[] = [];
  async query(sql: string, params?: readonly unknown[]): Promise<unknown> {
    this.calls.push({ sql, params });
    return this.queue.shift() ?? { rows: [] };
  }
}

test('classifies search routes deterministically', () => {
  assert.deepEqual(classifySearch420(' 42 '), { kind: 'block_number', normalized: '42' });
  assert.equal(classifySearch420(`0x${'a'.repeat(40)}`).kind, 'address');
  assert.equal(classifySearch420(`0x${'b'.repeat(64)}`).kind, 'hash');
  assert.deepEqual(classifySearch420('proposal:0xabc'), { kind: 'protocol_object', normalized: 'proposal:0xabc' });
  assert.equal(classifySearch420('something fuzzy').kind, 'unknown');
});

test('asset transfer paging emits a stable composite cursor including native null log indexes', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [
    { block_number: '20', tx_hash: '0xbbb', log_index: 3 },
    { block_number: '20', tx_hash: '0xaaa', log_index: null }
  ] });
  const page = await new IndexerQueryService420(db).assetTransfers(420n, { limit: 1 });
  assert.equal(page.items.length, 1);
  assert.deepEqual(decodeAssetTransferCursor420(page.nextCursor!), { blockNumber: 20n, txHash: '0xbbb', logIndex: 3 });
  assert.match(db.calls[0]!.sql, /coalesce\(log_index,-1\)/);
});

test('asset transfer query accepts its own cursor for the next keyset page', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [
    { block_number: '12', tx_hash: '0xbbb', log_index: null },
    { block_number: '11', tx_hash: '0xaaa', log_index: 7 }
  ] });
  const service = new IndexerQueryService420(db);
  const first = await service.assetTransfers(420n, { limit: 1 });
  db.queue.push({ rows: [] });
  await service.assetTransfers(420n, { limit: 1, cursor: first.nextCursor! });
  assert.deepEqual(db.calls[1]!.params, ['420', '12', '0xbbb', -1, 2]);
});

test('public DTO mappers use JSON-safe strings for EVM-scale numerics', () => {
  assert.deepEqual(blockDto420({ chain_id: '420', block_number: '9', block_hash: '0x09', parent_hash: '0x08', block_timestamp: '1700000000' }), {
    chainId: '420', number: '9', hash: '0x09', parentHash: '0x08', timestamp: '1700000000'
  });
  assert.equal(transactionDto420({
    chain_id: 420n, tx_hash: '0xtx', block_number: 9n, block_hash: '0x09', tx_index: 1,
    from_address: '0xfrom', to_address: null, value_wei: 10n ** 30n, input: '0x'
  }).valueWei, (10n ** 30n).toString());
  assert.equal(assetTransferDto420({
    chain_id: '420', block_number: '9', tx_hash: '0xtx', log_index: null, asset_key: 'native:420',
    asset_kind: 'native', contract_address: null, token_id: null, from_address: '0xfrom', to_address: '0xto', amount: '42'
  }).logIndex, null);
});

test('search routing avoids broad union scans for exact identifiers', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [{ chain_id: '420', block_number: '42', block_hash: '0xblock', parent_hash: '0xparent', block_timestamp: '1' }] });
  const result = await new IndexerQueryService420(db).search(420n, '42');
  assert.equal(result[0]!.result_type, 'block');
  assert.match(db.calls[0]!.sql, /idx_blocks/);
  assert.doesNotMatch(db.calls[0]!.sql, /union/i);
});
