import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';
import { CoreProjectionConsumer420 } from '../src/core-projections.js';
import type { Hex } from '../src/chain-source.js';

const h = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

class RecordingDb420 implements TransactionalSql420 {
  readonly calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  transactions = 0;
  async query(sql: string, params: readonly unknown[] = []): Promise<unknown> {
    this.calls.push({ sql, params });
    return undefined;
  }
  async transaction<T>(work: (tx: SqlExecutor420) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return work(this);
  }
}

test('core projection consumer persists a canonical block in one transaction', async () => {
  const db = new RecordingDb420();
  const consumer = new CoreProjectionConsumer420(db);
  await consumer.applyBlock({
    chainId: 420n,
    block: { number: 7n, hash: h(7), parentHash: h(6), timestamp: 1234n },
    transactions: [{ hash: h(70), blockHash: h(7), blockNumber: 7n, transactionIndex: 0, from: h(1), to: h(2), input: '0x', value: 42n }],
    receipts: [{ transactionHash: h(70), blockHash: h(7), blockNumber: 7n, transactionIndex: 0, status: 1, contractAddress: h(3), logs: [] }],
    logs: [{ address: h(4), blockHash: h(7), blockNumber: 7n, transactionHash: h(70), transactionIndex: 0, logIndex: 0, topics: [h(5)], data: '0x' }]
  });
  assert.equal(db.transactions, 1);
  assert.ok(db.calls.some((call) => call.sql.includes('insert into idx_blocks')));
  assert.ok(db.calls.some((call) => call.sql.includes('insert into idx_transactions')));
  assert.ok(db.calls.some((call) => call.sql.includes('insert into idx_receipts')));
  assert.ok(db.calls.some((call) => call.sql.includes('insert into idx_logs')));
  assert.ok(db.calls.some((call) => call.sql.includes('insert into idx_checkpoints')));
});

test('rollback removes only block-scoped projections and recovery metadata above the ancestor', async () => {
  const db = new RecordingDb420();
  const consumer = new CoreProjectionConsumer420(db);
  await consumer.rollbackTo(12n);
  assert.equal(db.transactions, 1);
  const deletes = db.calls.filter((call) => call.sql.startsWith('delete from')).map((call) => call.sql);
  assert.deepEqual(deletes, [
    'delete from idx_logs where block_number > $1',
    'delete from idx_receipts where block_number > $1',
    'delete from idx_transactions where block_number > $1',
    'delete from idx_blocks where block_number > $1',
    'delete from idx_canonical_history where block_number > $1',
    'delete from idx_checkpoints where block_number > $1'
  ]);
  assert.ok(!deletes.some((sql) => sql.includes('idx_addresses')));
});
