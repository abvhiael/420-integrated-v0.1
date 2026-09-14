import type { IndexedBlockBatch420, BlockConsumer420 } from './ingestor.js';
import type { TransactionalSql420, SqlExecutor420 } from './core-projections.js';
import { ZERO_ADDRESS_420, decodeAssetLog420, decodeNativeTransfer420, type AssetTransfer420 } from './asset-decoder.js';

function assetKey(transfer: AssetTransfer420): string {
  if (transfer.kind === 'native') return 'native:420';
  return `${transfer.kind}:${transfer.contractAddress!.toLowerCase()}:${transfer.tokenId?.toString() ?? ''}`;
}

async function applyDelta(tx: SqlExecutor420, chainId: bigint, asset: AssetTransfer420, holder: string, delta: bigint): Promise<void> {
  if (holder.toLowerCase() === ZERO_ADDRESS_420) return;
  await tx.query(
    `insert into idx_asset_balances(chain_id, asset_key, asset_kind, contract_address, token_id, holder_address, balance)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (chain_id,asset_key,holder_address) do update set balance=idx_asset_balances.balance + excluded.balance`,
    [chainId.toString(), assetKey(asset), asset.kind, asset.contractAddress, asset.tokenId?.toString() ?? null, holder, delta.toString()]
  );
}

export class AssetProjectionConsumer420 implements BlockConsumer420 {
  constructor(readonly db: TransactionalSql420) {}

  async applyBlock(batch: IndexedBlockBatch420): Promise<void> {
    const transfers: AssetTransfer420[] = [];
    for (const transaction of batch.transactions) {
      const native = decodeNativeTransfer420(transaction);
      if (native) transfers.push(native);
    }
    for (const log of batch.logs) transfers.push(...decodeAssetLog420(log));

    await this.db.transaction(async (tx) => {
      for (const transfer of transfers) {
        await tx.query(
          `insert into idx_asset_transfers(chain_id,block_number,tx_hash,log_index,asset_key,asset_kind,contract_address,token_id,from_address,to_address,amount)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (chain_id,tx_hash,log_index,asset_key,from_address,to_address,amount) do nothing`,
          [batch.chainId.toString(), transfer.blockNumber.toString(), transfer.transactionHash, transfer.logIndex, assetKey(transfer), transfer.kind, transfer.contractAddress, transfer.tokenId?.toString() ?? null, transfer.from, transfer.to, transfer.amount.toString()]
        );
        await applyDelta(tx, batch.chainId, transfer, transfer.from, -transfer.amount);
        await applyDelta(tx, batch.chainId, transfer, transfer.to, transfer.amount);
        await tx.query(
          `insert into idx_assets(chain_id,asset_key,asset_kind,contract_address,token_id,last_seen_block)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (chain_id,asset_key) do update set last_seen_block=greatest(idx_assets.last_seen_block,excluded.last_seen_block)`,
          [batch.chainId.toString(), assetKey(transfer), transfer.kind, transfer.contractAddress, transfer.tokenId?.toString() ?? null, transfer.blockNumber.toString()]
        );
      }
      await tx.query('delete from idx_asset_balances where chain_id=$1 and balance=0', [batch.chainId.toString()]);
    });
  }

  async rollbackTo(blockNumber: bigint | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const boundary = blockNumber?.toString() ?? null;
      await tx.query('delete from idx_asset_transfers where $1::numeric is null or block_number > $1', [boundary]);
      await tx.query('delete from idx_asset_balances');
      await tx.query(
        `insert into idx_asset_balances(chain_id,asset_key,asset_kind,contract_address,token_id,holder_address,balance)
         select chain_id,asset_key,asset_kind,contract_address,token_id,holder_address,sum(delta)::numeric from (
           select chain_id,asset_key,asset_kind,contract_address,token_id,to_address holder_address,amount::numeric delta from idx_asset_transfers where lower(to_address) <> lower($1)
           union all
           select chain_id,asset_key,asset_kind,contract_address,token_id,from_address holder_address,-amount::numeric delta from idx_asset_transfers where lower(from_address) <> lower($1)
         ) x group by chain_id,asset_key,asset_kind,contract_address,token_id,holder_address having sum(delta) <> 0`,
        [ZERO_ADDRESS_420]
      );
      if (blockNumber === null) await tx.query('delete from idx_assets');
      else await tx.query('delete from idx_assets a where not exists (select 1 from idx_asset_transfers t where t.chain_id=a.chain_id and t.asset_key=a.asset_key)');
    });
  }
}
