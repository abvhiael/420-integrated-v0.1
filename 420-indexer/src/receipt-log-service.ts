import type { IndexerQueryService420, QueryRow420 } from './query-service.js';
import { receiptDto420, type ReceiptDto420 } from './receipt-log-dto.js';

interface QueryResultLike420 { rows?: QueryRow420[]; }

function firstRow420(result: unknown): QueryRow420 | null {
  if (!result || typeof result !== 'object') throw new Error('query executor returned invalid result');
  const rows = (result as QueryResultLike420).rows;
  if (!Array.isArray(rows)) throw new Error('query executor result missing rows');
  return rows[0] ?? null;
}

export async function receiptByHash420(service: IndexerQueryService420, chainId: bigint, txHash: string): Promise<ReceiptDto420 | null> {
  const row = firstRow420(await service.db.query(
    'select * from idx_receipts where chain_id = $1 and lower(tx_hash) = $2 limit 1',
    [chainId.toString(), txHash.toLowerCase()]
  ));
  return row ? receiptDto420(row) : null;
}
