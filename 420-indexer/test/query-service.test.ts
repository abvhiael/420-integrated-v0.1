import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { decodeBlockCursor420, decodeTransactionCursor420, decodePositionCursor420 } from '../src/query-layer.js';
import { IndexerQueryService420 } from '../src/query-service.js';

class FakeDb420 implements SqlExecutor420 {
  calls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  queue: unknown[] = [];
  async query(sql: string, params?: readonly unknown[]): Promise<unknown> {
    this.calls.push({ sql, params });
    return this.queue.shift() ?? { rows: [] };
  }
}

test('emits a stable next cursor from one-extra-row block pages', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [
    { block_number: '12', block_hash: '0x12' },
    { block_number: '11', block_hash: '0x11' },
    { block_number: '10', block_hash: '0x10' }
  ] });
  const page = await new IndexerQueryService420(db).blocks(420n, { limit: 2 });
  assert.equal(page.items.length, 2);
  assert.deepEqual(decodeBlockCursor420(page.nextCursor!), { blockNumber: 11n });
  assert.match(db.calls[0]!.sql, /limit \$2/);
  assert.deepEqual(db.calls[0]!.params, ['420', 3]);
});

test('transaction and log pages encode canonical positions', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [
    { block_number: '9', tx_index: 4 },
    { block_number: '9', tx_index: 3 }
  ] });
  db.queue.push({ rows: [
    { block_number: '8', tx_index: 2, log_index: 7 },
    { block_number: '8', tx_index: 2, log_index: 6 }
  ] });
  const svc = new IndexerQueryService420(db);
  const txPage = await svc.transactions(420n, { limit: 1 });
  assert.deepEqual(decodeTransactionCursor420(txPage.nextCursor!), { blockNumber: 9n, txIndex: 4 });
  const logPage = await svc.logs(420n, { limit: 1 });
  assert.deepEqual(decodePositionCursor420(logPage.nextCursor!), { blockNumber: 8n, txIndex: 2, logIndex: 7 });
});

test('normalizes direct hash and address lookups', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [{ block_hash: '0xabc' }] });
  db.queue.push({ rows: [{ tx_hash: '0xdef' }] });
  db.queue.push({ rows: [{ address: '0x123' }] });
  const svc = new IndexerQueryService420(db);
  assert.ok(await svc.blockByHash(420n, '0xAbC'));
  assert.ok(await svc.transactionByHash(420n, '0xDeF'));
  assert.ok(await svc.address(420n, '0x123'));
  assert.deepEqual(db.calls[0]!.params, ['420', '0xabc']);
  assert.deepEqual(db.calls[1]!.params, ['420', '0xdef']);
  assert.deepEqual(db.calls[2]!.params, ['420', '0x123']);
});

test('search is routed, bounded, and invalid-token safe', async () => {
  const db = new FakeDb420();
  const svc = new IndexerQueryService420(db);
  assert.deepEqual(await svc.search(420n, '   '), []);
  assert.deepEqual(await svc.search(420n, '0xabc'), []);
  assert.equal(db.calls.length, 0);

  const hash = `0x${'a'.repeat(64)}`;
  db.queue.push({ rows: [] });
  db.queue.push({ rows: [{ tx_hash: hash }] });
  const results = await svc.search(420n, hash, 200);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.result_type, 'transaction');
  assert.deepEqual(db.calls[0]!.params, ['420', hash]);
  assert.deepEqual(db.calls[1]!.params, ['420', hash]);
});

test('fails closed on malformed database rows used for cursors', async () => {
  const db = new FakeDb420();
  db.queue.push({ rows: [{ block_number: 'not-a-number' }, { block_number: '2' }] });
  await assert.rejects(() => new IndexerQueryService420(db).blocks(420n, { limit: 1 }), /invalid block_number/);
});
