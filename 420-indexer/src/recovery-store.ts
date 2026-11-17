import type { CheckpointStore420 } from './checkpoint-store.js';
import type { IndexCheckpoint420 } from './indexing.js';
import type { CanonicalHistoryStore420 } from './reorg.js';

export interface RecoverySqlExecutor420 {
  query(sql: string, params?: readonly unknown[]): Promise<unknown>;
}

interface RecoveryQueryResult420 { rows?: readonly Record<string, unknown>[]; }

function rows420(result: unknown): readonly Record<string, unknown>[] {
  if (!result || typeof result !== 'object') throw new Error('invalid recovery query result');
  const rows = (result as RecoveryQueryResult420).rows;
  if (!Array.isArray(rows)) throw new Error('recovery query result is missing rows');
  return rows;
}

function checkpoint420(row: Record<string, unknown>): IndexCheckpoint420 {
  if (row.chain_id === undefined || row.block_number === undefined || typeof row.block_hash !== 'string' || typeof row.parent_hash !== 'string') {
    throw new Error('invalid durable recovery row');
  }
  return {
    chainId: BigInt(String(row.chain_id)),
    blockNumber: BigInt(String(row.block_number)),
    blockHash: row.block_hash as `0x${string}`,
    parentHash: row.parent_hash as `0x${string}`,
    ...(row.finalized_number != null ? { finalizedNumber: BigInt(String(row.finalized_number)), finalizedHash: String(row.finalized_hash) as `0x${string}` } : {})
  };
}

export class SqlCheckpointStore420 implements CheckpointStore420 {
  constructor(readonly db: RecoverySqlExecutor420, readonly chainId: bigint) {
    if (chainId < 0n) throw new Error('chainId must be non-negative');
  }

  async load(): Promise<IndexCheckpoint420 | null> {
    const result = await this.db.query(
      'select chain_id, block_number, block_hash, parent_hash, finalized_number, finalized_hash from idx_checkpoints where chain_id=$1',
      [this.chainId.toString()]
    );
    const rows = rows420(result);
    return rows.length === 0 ? null : checkpoint420(rows[0]);
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    if (checkpoint.chainId !== this.chainId) throw new Error('checkpoint chain mismatch');
    const result = await this.db.query(
      `insert into idx_checkpoints(chain_id, block_number, block_hash, parent_hash, finalized_number, finalized_hash)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (chain_id) do update set block_number=excluded.block_number, block_hash=excluded.block_hash,
         parent_hash=excluded.parent_hash, finalized_number=excluded.finalized_number, finalized_hash=excluded.finalized_hash
       where idx_checkpoints.block_number=excluded.block_number and idx_checkpoints.block_hash=excluded.block_hash
         and (idx_checkpoints.finalized_number is null or
           (excluded.finalized_number >= idx_checkpoints.finalized_number and
             (excluded.finalized_number > idx_checkpoints.finalized_number or excluded.finalized_hash=idx_checkpoints.finalized_hash)))`,
      [checkpoint.chainId.toString(), checkpoint.blockNumber.toString(), checkpoint.blockHash, checkpoint.parentHash,
        checkpoint.finalizedNumber?.toString() ?? null, checkpoint.finalizedHash ?? null]
    ) as { rowCount?: number };
    if (result?.rowCount === 0) throw new Error('checkpoint identity or finalized boundary conflict');
  }

  async clear(): Promise<void> {
    await this.db.query('delete from idx_checkpoints where chain_id=$1', [this.chainId.toString()]);
  }
}

export class SqlCanonicalHistoryStore420 implements CanonicalHistoryStore420 {
  constructor(readonly db: RecoverySqlExecutor420, readonly chainId: bigint) {
    if (chainId < 0n) throw new Error('chainId must be non-negative');
  }

  async load(blockNumber: bigint): Promise<IndexCheckpoint420 | null> {
    if (blockNumber < 0n) return null;
    const result = await this.db.query(
      'select chain_id, block_number, block_hash, parent_hash from idx_canonical_history where chain_id=$1 and block_number=$2',
      [this.chainId.toString(), blockNumber.toString()]
    );
    const rows = rows420(result);
    return rows.length === 0 ? null : checkpoint420(rows[0]);
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    if (checkpoint.chainId !== this.chainId) throw new Error('canonical history chain mismatch');
    await this.db.query(
      `insert into idx_canonical_history(chain_id, block_number, block_hash, parent_hash)
       values ($1,$2,$3,$4)
       on conflict (chain_id, block_number) do update set block_hash=excluded.block_hash, parent_hash=excluded.parent_hash`,
      [checkpoint.chainId.toString(), checkpoint.blockNumber.toString(), checkpoint.blockHash, checkpoint.parentHash]
    );
  }

  async deleteAfter(blockNumber: bigint): Promise<void> {
    await this.db.query(
      'delete from idx_canonical_history where chain_id=$1 and block_number>$2',
      [this.chainId.toString(), blockNumber.toString()]
    );
  }
}
