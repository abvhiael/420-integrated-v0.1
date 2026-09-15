import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCheckpointStore420 } from '../src/checkpoint-store.js';
import { checkpointFromBlock420 } from '../src/indexing.js';
import { MemoryCanonicalHistoryStore420, recoverCanonicalAncestry420 } from '../src/reorg.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from '../src/recovery-store.js';
import type { ChainSource420, Hex, IndexerBlock } from '../src/chain-source.js';

const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const block = (n: number, id = n, parent = n - 1): IndexerBlock => ({ number: BigInt(n), hash: hash(id), parentHash: hash(parent), timestamp: 1n });

function source(blocks: Map<bigint, IndexerBlock>): ChainSource420 {
  return {
    sourceId: 'durable-test', async chainId() { return 420n; }, async blockNumber() { return 10n; },
    async getBlockByNumber(n) { return blocks.get(n) ?? null; }, async getBlockByHash() { return null; },
    async getTransactionByHash() { return null; }, async getTransactionReceipt() { return null; }, async getLogs() { return []; },
    async call() { return '0x'; }, async getCode() { return '0x'; }
  };
}

test('durable reorg recovery delegates rollback and metadata reset atomically', async () => {
  const local5 = checkpointFromBlock420(420n, block(5));
  const local7 = checkpointFromBlock420(420n, block(7));
  const history = new MemoryCanonicalHistoryStore420();
  await history.save(local5); await history.save(local7);
  const checkpoints = new MemoryCheckpointStore420(); await checkpoints.save(local7);
  const durableCalls: Array<[bigint | null, bigint | null]> = [];
  const canonical = new Map<bigint, IndexerBlock>([[5n, block(5)], [6n, block(6, 600, 5)], [7n, block(7, 700, 600)]]);

  const result = await recoverCanonicalAncestry420(source(canonical), checkpoints, history, {
    async rollbackTo() { throw new Error('legacy rollback must not run'); },
    async rollbackDurably(n, ancestor) { durableCalls.push([n, ancestor?.blockNumber ?? null]); }
  }, local7, 8);

  assert.equal(result.ancestor?.blockNumber, 5n);
  assert.deepEqual(durableCalls, [[5n, 5n]]);
  assert.equal((await checkpoints.load())?.blockNumber, 7n, 'external store is not independently mutated after durable commit');
});

test('SQL recovery stores reload checkpoint and ancestry from durable rows', async () => {
  const rows = new Map<string, Record<string, unknown>>();
  const db = {
    async query(sql: string, params: readonly unknown[] = []) {
      if (sql.startsWith('insert into idx_checkpoints')) rows.set('cp', { chain_id: params[0], block_number: params[1], block_hash: params[2], parent_hash: params[3] });
      else if (sql.startsWith('insert into idx_canonical_history')) rows.set(`h:${params[1]}`, { chain_id: params[0], block_number: params[1], block_hash: params[2], parent_hash: params[3] });
      else if (sql.startsWith('select') && sql.includes('idx_checkpoints')) return { rows: rows.has('cp') ? [rows.get('cp')!] : [] };
      else if (sql.startsWith('select') && sql.includes('idx_canonical_history')) return { rows: rows.has(`h:${params[1]}`) ? [rows.get(`h:${params[1]}`)!] : [] };
      else if (sql.startsWith('delete from idx_checkpoints')) rows.delete('cp');
      else if (sql.startsWith('delete from idx_canonical_history')) for (const key of [...rows.keys()]) if (key.startsWith('h:') && BigInt(key.slice(2)) > BigInt(String(params[1]))) rows.delete(key);
      return { rows: [] };
    }
  };
  const checkpoint = checkpointFromBlock420(420n, block(12));
  const cps = new SqlCheckpointStore420(db, 420n);
  const history = new SqlCanonicalHistoryStore420(db, 420n);
  await cps.save(checkpoint); await history.save(checkpoint);
  assert.equal((await cps.load())?.blockHash, checkpoint.blockHash);
  assert.equal((await history.load(12n))?.blockNumber, 12n);
  await history.deleteAfter(11n);
  assert.equal(await history.load(12n), null);
});
