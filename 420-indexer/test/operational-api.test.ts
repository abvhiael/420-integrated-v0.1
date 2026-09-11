import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerQueryService420 } from '../src/query-service.js';
import { indexerReadiness420, indexerStatus420 } from '../src/operational-api.js';

class FakeDb420 implements SqlExecutor420 {
  queue: unknown[] = [];
  async query(): Promise<unknown> { return this.queue.shift() ?? { rows: [] }; }
}

test('operational status exposes indexed head and finality metadata without claiming protocol authority', async () => {
  const db = new FakeDb420();
  const service = new IndexerQueryService420(db);
  db.queue.push({ rows: [{ block_number: '120', block_hash: '0x120', block_timestamp: '1700000120' }] });
  const status = await indexerStatus420(service, 420n, { mode: 'confirmations', confirmations: 12n });
  assert.deepEqual(status, {
    chainId: '420', indexedHead: '120', indexedHeadHash: '0x120', indexedHeadTimestamp: '1700000120',
    finality: { mode: 'confirmations', confirmations: '12', safeHead: '120' }, lag: null, authoritative: false
  });
});

test('readiness requires both database access and an indexed head', async () => {
  const db = new FakeDb420();
  const service = new IndexerQueryService420(db);
  db.queue.push({ rows: [{ ok: 1 }] }, { rows: [] });
  assert.deepEqual(await indexerReadiness420(service, 420n), { ready: false, databaseReady: true, chainId: '420', indexedHead: null });
});
