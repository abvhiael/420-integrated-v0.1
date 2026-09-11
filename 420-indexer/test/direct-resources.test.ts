import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerPublicApiAdapter420 } from '../src/api-surface.js';
import { IndexerQueryService420 } from '../src/query-service.js';

class FakeDb420 implements SqlExecutor420 {
  queue: unknown[] = [];
  async query(): Promise<unknown> { return this.queue.shift() ?? { rows: [] }; }
}

test('direct public resources map query rows into stable DTOs', async () => {
  const db = new FakeDb420();
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));

  db.queue.push({ rows: [{ chain_id: '420', block_number: '12', block_hash: '0x12', parent_hash: '0x11', block_timestamp: '1700000012' }] });
  assert.deepEqual(await api.block(420n, '12'), { chainId: '420', number: '12', hash: '0x12', parentHash: '0x11', timestamp: '1700000012' });

  db.queue.push({ rows: [{ chain_id: '420', tx_hash: '0xabc', block_number: '12', block_hash: '0x12', tx_index: 1, from_address: '0xfrom', to_address: null, value_wei: '42', input: '0x' }] });
  assert.deepEqual(await api.transaction(420n, '0xABC'), { chainId: '420', hash: '0xabc', blockNumber: '12', blockHash: '0x12', transactionIndex: 1, from: '0xfrom', to: null, valueWei: '42', input: '0x' });

  db.queue.push({ rows: [{ chain_id: '420', address: '0xdef', is_contract: true }] });
  assert.deepEqual(await api.address(420n, '0xDEF'), { chainId: '420', address: '0xdef', isContract: true });
});

test('direct block lookup supports hashes and missing resources remain null', async () => {
  const db = new FakeDb420();
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));

  db.queue.push({ rows: [{ chain_id: '420', block_number: '12', block_hash: '0xhash', parent_hash: '0x11', block_timestamp: '1700000012' }] });
  assert.equal((await api.block(420n, '0xHASH'))?.hash, '0xhash');

  db.queue.push({ rows: [] });
  assert.equal(await api.transaction(420n, '0xmissing'), null);
});
