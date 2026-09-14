import type { IndexerLog } from './chain-source.js';
import type { SqlExecutor420, TransactionalSql420 } from './core-projections.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';

export class ProtocolProjection420 {
  constructor(readonly db: TransactionalSql420, readonly decoders: ProtocolDecoderRegistry420) {}

  async applyLogs(chainId: bigint, logs: readonly IndexerLog[]): Promise<number> {
    let decodedCount = 0;
    await this.db.transaction(async (tx: SqlExecutor420) => {
      for (const log of logs) {
        const decoded = this.decoders.decode(log);
        if (!decoded) continue;
        decodedCount += 1;
        await tx.query(
          `insert into idx_protocol_events(chain_id, block_number, block_hash, tx_hash, tx_index, log_index, contract_address, protocol, event_name, fields)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           on conflict (chain_id, block_hash, tx_hash, log_index) do update set
             contract_address=excluded.contract_address,
             protocol=excluded.protocol,
             event_name=excluded.event_name,
             fields=excluded.fields`,
          [chainId.toString(), decoded.blockNumber.toString(), decoded.blockHash, decoded.transactionHash, decoded.transactionIndex, decoded.logIndex, decoded.contractAddress, decoded.protocol, decoded.eventName, JSON.stringify(decoded.fields, (_key, value) => typeof value === 'bigint' ? value.toString() : value)]
        );
      }
    });
    return decodedCount;
  }

  async rollbackTo(blockNumber: bigint | null): Promise<void> {
    await this.db.transaction(async (tx: SqlExecutor420) => {
      if (blockNumber === null) await tx.query('delete from idx_protocol_events');
      else await tx.query('delete from idx_protocol_events where block_number > $1', [blockNumber.toString()]);
    });
  }
}
