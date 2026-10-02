import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';

const h = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const addrWord = (n: number): Hex => `0x${'0'.repeat(24)}${n.toString(16).padStart(40, '0')}`;

class RecordingDb420 implements TransactionalSql420 {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  async query(sql: string, params?: readonly unknown[]): Promise<unknown> { this.queries.push({ sql, params }); return undefined; }
  async transaction<T>(work: (tx: SqlExecutor420) => Promise<T>): Promise<T> { return work(this); }
}

test('manifest descriptor decodes indexed and data fields deterministically', () => {
  const topic0 = h(999);
  const registry = new ProtocolDecoderRegistry420([{ protocol: '420Registry', eventName: 'Registered', topic0, fields: [
    { name: 'objectId', kind: 'bytes32', indexed: true },
    { name: 'actor', kind: 'address', indexed: true },
    { name: 'version', kind: 'uint256', indexed: false },
    { name: 'active', kind: 'bool', indexed: false }
  ] }]);
  const log: IndexerLog = { address: h(10), blockHash: h(20), blockNumber: 7n, transactionHash: h(30), transactionIndex: 1, logIndex: 2, topics: [topic0, h(1), addrWord(42)], data: `0x${'0'.repeat(63)}2${'0'.repeat(63)}1` as Hex };
  const decoded = registry.decode(log);
  assert.equal(decoded?.protocol, '420Registry');
  assert.equal(decoded?.fields.objectId, h(1));
  assert.equal(decoded?.fields.actor, `0x${42 .toString(16).padStart(40, '0')}`);
  assert.equal(decoded?.fields.version, 2n);
  assert.equal(decoded?.fields.active, true);
});

test('projection stores decoded genesis events and ignores unknown topics', async () => {
  const db = new RecordingDb420();
  const topic0 = h(777);
  const projection = new ProtocolProjection420(db, new ProtocolDecoderRegistry420([{ protocol: '420Governance', eventName: 'ProposalCreated', topic0, fields: [{ name: 'objectId', kind: 'bytes32', indexed: true }] }]));
  const base = { address: h(5), blockHash: h(6), blockNumber: 9n, transactionHash: h(7), transactionIndex: 0, logIndex: 0, data: '0x' as Hex };
  const count = await projection.applyLogs(420n, [
    { ...base, topics: [topic0, h(8)] },
    { ...base, logIndex: 1, topics: [h(999)] }
  ]);
  assert.equal(count, 1);
  assert.equal(db.queries.length, 1);
  assert.match(db.queries[0].sql, /insert into idx_protocol_events/);
  assert.equal(db.queries[0].params?.[7], '420Governance');
});

test('protocol projection rollback is block bounded', async () => {
  const db = new RecordingDb420();
  const projection = new ProtocolProjection420(db, new ProtocolDecoderRegistry420());
  await projection.rollbackTo(12n);
  assert.equal(db.queries[0].params?.[0], '12');
  assert.match(db.queries[0].sql, /block_number > \$1/);
});

test('Governance event projection is idempotent and reorg replay replaces fork provenance after rollback', async () => {
  const db = new RecordingDb420();
  const topic0 = h(420);
  const projection = new ProtocolProjection420(
    db,
    new ProtocolDecoderRegistry420([{
      protocol: '420Governance',
      eventName: 'CivicProposalRegistered',
      topic0,
      fields: [{ name: 'proposalId', kind: 'bytes32', indexed: true }]
    }])
  );
  const canonical: IndexerLog = {
    address: h(40),
    blockHash: h(41),
    blockNumber: 10n,
    transactionHash: h(42),
    transactionIndex: 0,
    logIndex: 1,
    topics: [topic0, h(43)],
    data: '0x' as Hex
  };

  await projection.applyLogs(420n, [canonical]);
  await projection.applyLogs(420n, [canonical]);
  assert.match(db.queries[0]!.sql, /on conflict \(chain_id, block_hash, tx_hash, log_index\) do update/);
  assert.deepEqual(db.queries[0]!.params, db.queries[1]!.params);

  await projection.rollbackTo(9n);
  const replacement = { ...canonical, blockHash: h(44), transactionHash: h(45) };
  await projection.applyLogs(420n, [replacement]);
  assert.match(db.queries[2]!.sql, /delete from idx_protocol_events where block_number > \$1/);
  assert.equal(db.queries[3]!.params?.[2], h(44));
  assert.equal(db.queries[3]!.params?.[3], h(45));
});
