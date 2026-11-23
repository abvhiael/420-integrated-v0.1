import { ProtocolProjection420 } from './protocol-projections.js';
import type { IndexedBlockBatch420, BlockConsumer420, DurableBlockConsumer420 } from './ingestor.js';
import type { IndexCheckpoint420 } from './indexing.js';

export interface SqlQueryResult420 { rows?: readonly Record<string, unknown>[]; rowCount?: number | null; }
export interface SqlExecutor420 {
  query(sql: string, params?: readonly unknown[]): Promise<unknown>;
}

export interface TransactionalSql420 extends SqlExecutor420 {
  transaction<T>(work: (tx: SqlExecutor420) => Promise<T>): Promise<T>;
}

async function writeRecoveryMetadata420(tx: SqlExecutor420, checkpoint: IndexCheckpoint420): Promise<void> {
  const values = [checkpoint.chainId.toString(), checkpoint.blockNumber.toString(), checkpoint.blockHash, checkpoint.parentHash];
  await tx.query(
    `insert into idx_checkpoints(chain_id, block_number, block_hash, parent_hash)
     values ($1,$2,$3,$4)
     on conflict (chain_id) do update set
       block_number=excluded.block_number,
       block_hash=excluded.block_hash,
       parent_hash=excluded.parent_hash`, values
  );
  await tx.query(`update idx_checkpoints set finalized_number=$2, finalized_hash=$3 where chain_id=$1`,
    [checkpoint.chainId.toString(), checkpoint.finalizedNumber?.toString() ?? null, checkpoint.finalizedHash ?? null]);
  await tx.query(
    `insert into idx_canonical_history(chain_id, block_number, block_hash, parent_hash)
     values ($1,$2,$3,$4)
     on conflict (chain_id, block_number) do update set
       block_hash=excluded.block_hash,
       parent_hash=excluded.parent_hash`, values
  );
}

export class CoreProjectionConsumer420 implements BlockConsumer420, DurableBlockConsumer420 {
  constructor(readonly db: TransactionalSql420, readonly protocols?: ProtocolProjection420, readonly chainId?: bigint) {}

  private async applyBlockTx420(tx: SqlExecutor420, batch: IndexedBlockBatch420): Promise<void> {
    await tx.query(
      `insert into idx_blocks(chain_id, block_number, block_hash, parent_hash, block_timestamp)
       values ($1,$2,$3,$4,$5)
       on conflict (chain_id, block_number) do update set
         block_hash=excluded.block_hash,
         parent_hash=excluded.parent_hash,
         block_timestamp=excluded.block_timestamp`,
      [batch.chainId.toString(), batch.block.number.toString(), batch.block.hash, batch.block.parentHash, batch.block.timestamp.toString()]
    );

    for (const transaction of batch.transactions) {
      await tx.query(
        `insert into idx_transactions(chain_id, tx_hash, block_number, block_hash, tx_index, from_address, to_address, value_wei, input)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (chain_id, tx_hash) do update set
           block_number=excluded.block_number,
           block_hash=excluded.block_hash,
           tx_index=excluded.tx_index,
           from_address=excluded.from_address,
           to_address=excluded.to_address,
           value_wei=excluded.value_wei,
           input=excluded.input`,
        [batch.chainId.toString(), transaction.hash, transaction.blockNumber.toString(), transaction.blockHash, transaction.transactionIndex, transaction.from, transaction.to, transaction.value.toString(), transaction.input]
      );
      await tx.query(`insert into idx_addresses(chain_id,address) values ($1,$2) on conflict do nothing`, [batch.chainId.toString(), transaction.from]);
      if (transaction.to) await tx.query(`insert into idx_addresses(chain_id,address) values ($1,$2) on conflict do nothing`, [batch.chainId.toString(), transaction.to]);
    }

    for (const receipt of batch.receipts) {
      await tx.query(
        `insert into idx_receipts(chain_id, tx_hash, block_number, block_hash, tx_index, status, contract_address)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (chain_id, tx_hash) do update set
           block_number=excluded.block_number,
           block_hash=excluded.block_hash,
           tx_index=excluded.tx_index,
           status=excluded.status,
           contract_address=excluded.contract_address`,
        [batch.chainId.toString(), receipt.transactionHash, receipt.blockNumber.toString(), receipt.blockHash, receipt.transactionIndex, receipt.status, receipt.contractAddress]
      );
      if (receipt.contractAddress) {
        await tx.query(`insert into idx_addresses(chain_id,address,is_contract) values ($1,$2,true) on conflict (chain_id,address) do update set is_contract=true`, [batch.chainId.toString(), receipt.contractAddress]);
      }
    }

    for (const log of batch.logs) {
      await tx.query(
        `insert into idx_logs(chain_id, block_number, block_hash, tx_hash, tx_index, log_index, address, topics, data)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (chain_id, block_hash, tx_hash, log_index) do nothing`,
        [batch.chainId.toString(), log.blockNumber.toString(), log.blockHash, log.transactionHash, log.transactionIndex, log.logIndex, log.address, JSON.stringify(log.topics), log.data]
      );
      await tx.query(`insert into idx_addresses(chain_id,address) values ($1,$2) on conflict do nothing`, [batch.chainId.toString(), log.address]);
    }
  }

  async applyBlock(batch: IndexedBlockBatch420): Promise<void> {
    const checkpoint: IndexCheckpoint420 = {
      chainId: batch.chainId,
      blockNumber: batch.block.number,
      blockHash: batch.block.hash,
      parentHash: batch.block.parentHash
    };
    await this.applyBlockDurably(batch, checkpoint);
  }

  async applyBlockDurably(batch: IndexedBlockBatch420, checkpoint: IndexCheckpoint420): Promise<void> {
    if (checkpoint.chainId !== batch.chainId || checkpoint.blockNumber !== batch.block.number || checkpoint.parentHash.toLowerCase() !== batch.block.parentHash.toLowerCase() || checkpoint.blockHash.toLowerCase() !== batch.block.hash.toLowerCase()) {
      throw new Error('durable checkpoint does not match projection batch');
    }
    await this.db.transaction(async (tx) => {
      if (this.chainId !== undefined) {
        await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['420indexer:' + this.chainId]);
        const result = await tx.query('select block_number, block_hash, finalized_number, finalized_hash from idx_checkpoints where chain_id=$1 for update', [this.chainId.toString()]) as SqlQueryResult420;
        const previous = result.rows?.[0];
        if (previous) {
          const number = BigInt(String(previous.block_number));
          const hash = String(previous.block_hash).toLowerCase();
          if (!(number === batch.block.number && hash === batch.block.hash.toLowerCase()) &&
              !(number + 1n === batch.block.number && hash === batch.block.parentHash.toLowerCase())) throw new Error('durable checkpoint continuation conflict');
          if (previous.finalized_number != null && checkpoint.finalizedNumber === BigInt(String(previous.finalized_number)) && checkpoint.finalizedHash !== previous.finalized_hash) throw new Error('finalized checkpoint hash conflict');
          if (previous.finalized_number != null && (checkpoint.finalizedNumber === undefined || checkpoint.finalizedNumber < BigInt(String(previous.finalized_number)))) {
            checkpoint = { ...checkpoint, finalizedNumber: BigInt(String(previous.finalized_number)), finalizedHash: String(previous.finalized_hash) as `0x${string}` };
          }
        }
      }
      await this.applyBlockTx420(tx, batch);
      if (this.chainId !== undefined && batch.chainId !== this.chainId) throw new Error('projection chain mismatch');
      if (this.protocols) await this.protocols.applyLogsTx(batch.chainId, [...batch.logs, ...(batch.nativeLogs ?? [])], tx);
      await writeRecoveryMetadata420(tx, checkpoint);
    });
  }

  async rollbackTo(blockNumber: bigint | null): Promise<void> {
    await this.rollbackDurably(blockNumber, null);
  }

  async rollbackDurably(blockNumber: bigint | null, ancestor: IndexCheckpoint420 | null): Promise<void> {
    if (this.chainId !== undefined && ancestor && ancestor.chainId !== this.chainId) throw new Error('rollback chain mismatch');
    await this.db.transaction(async (tx) => {
      // The production Stake factory always pins chainId. Legacy unpinned
      // consumers retain their single-chain behavior for compatibility.
      const chain = this.chainId ?? ancestor?.chainId;
      if (chain !== undefined) {
        await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['420indexer:' + chain]);
        const result = await tx.query('select finalized_number, finalized_hash from idx_checkpoints where chain_id=$1 for update', [chain.toString()]) as SqlQueryResult420;
        const previous = result.rows?.[0];
        if (previous?.finalized_number != null) {
          const finalized = BigInt(String(previous.finalized_number));
          if (blockNumber === null || blockNumber < finalized) throw new Error('rollback violates finalized history');
          if (!ancestor) throw new Error('verified rollback ancestor required');
          const local = await tx.query('select block_hash from idx_canonical_history where chain_id=$1 and block_number=$2', [chain.toString(), blockNumber!.toString()]) as SqlQueryResult420;
          if (local.rows?.[0]?.block_hash !== ancestor.blockHash) throw new Error('rollback ancestor mismatch');
          ancestor = { ...ancestor, finalizedNumber: finalized, finalizedHash: String(previous.finalized_hash) as `0x${string}` };
        }
      }
      const chainClause = chain === undefined ? '' : 'chain_id=$1';
      const params: unknown[] = chain === undefined ? [] : [chain.toString()];
      if (blockNumber !== null) params.push(blockNumber.toString());
      const heightClause = blockNumber === null ? '' : `block_number > $${params.length}`;
      const where = [chainClause, heightClause].filter(Boolean).join(' and ');
      for (const table of ['idx_protocol_events', 'idx_logs', 'idx_receipts', 'idx_transactions', 'idx_blocks', 'idx_canonical_history']) {
        if (table === 'idx_protocol_events' && !this.protocols) continue;
        await tx.query(`delete from ${table}${where ? ' where ' + where : ''}`, params);
      }
      if (ancestor) await writeRecoveryMetadata420(tx, ancestor);
      else await tx.query(`delete from idx_checkpoints${where ? ' where ' + where : ''}`, params);
    });
  }
}
