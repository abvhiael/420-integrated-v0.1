import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { INDEXER_API_VERSION_420, IndexerPublicApiAdapter420 } from '../src/api-surface.js';
import { IndexerQueryService420 } from '../src/query-service.js';

class FakeDb420 implements SqlExecutor420 {
  queue: unknown[] = [];
  async query(): Promise<unknown> { return this.queue.shift() ?? { rows: [] }; }
}

test('public API exposes a stable v1 adapter over typed query services', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [{ chain_id: '420', block_number: '9', block_hash: '0x09', parent_hash: '0x08', block_timestamp: '1700000000' }] });
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));
  assert.equal(api.version, INDEXER_API_VERSION_420);
  const page = await api.blocks(420n, { limit: 1 });
  assert.deepEqual(page.items[0], { chainId: '420', number: '9', hash: '0x09', parentHash: '0x08', timestamp: '1700000000' });
});

test('public API maps search rows into transport-safe result objects', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [{ chain_id: '420', block_number: '42', block_hash: '0xblock', parent_hash: '0xparent', block_timestamp: '1' }] });
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));
  assert.deepEqual(await api.search(420n, '42'), [{ type: 'block', key: '42', value: '0xblock' }]);
});
