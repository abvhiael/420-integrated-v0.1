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
  await tx.query(
    `insert into idx_canonical_history(chain_id, block_number, block_hash, parent_hash)
     values ($1,$2,$3,$4)
     on conflict (chain_id, block_number) do update set
       block_hash=excluded.block_hash,
       parent_hash=excluded.parent_hash`, values
  );
}

export class CoreProjectionConsumer420 implements BlockConsumer420, DurableBlockConsumer420 {
  constructor(readonly db: TransactionalSql420) {}

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
    if (checkpoint.chainId !== batch.chainId || checkpoint.blockNumber !== batch.block.number || checkpoint.blockHash.toLowerCase() !== batch.block.hash.toLowerCase()) {
      throw new Error('durable checkpoint does not match projection batch');
    }
    await this.db.transaction(async (tx) => {
      await this.applyBlockTx420(tx, batch);
      await writeRecoveryMetadata420(tx, checkpoint);
    });
  }

  async rollbackTo(blockNumber: bigint | null): Promise<void> {
    await this.rollbackDurably(blockNumber, null);
  }

  async rollbackDurably(blockNumber: bigint | null, ancestor: IndexCheckpoint420 | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (blockNumber === null) {
        await tx.query('delete from idx_logs');
        await tx.query('delete from idx_receipts');
        await tx.query('delete from idx_transactions');
        await tx.query('delete from idx_blocks');
        await tx.query('delete from idx_checkpoints');
        await tx.query('delete from idx_canonical_history');
        return;
      }
      const n = blockNumber.toString();
      await tx.query('delete from idx_logs where block_number > $1', [n]);
      await tx.query('delete from idx_receipts where block_number > $1', [n]);
      await tx.query('delete from idx_transactions where block_number > $1', [n]);
      await tx.query('delete from idx_blocks where block_number > $1', [n]);
      await tx.query('delete from idx_canonical_history where block_number > $1', [n]);
      if (ancestor) await writeRecoveryMetadata420(tx, ancestor);
      else await tx.query('delete from idx_checkpoints where block_number > $1', [n]);
    });
  }
}
