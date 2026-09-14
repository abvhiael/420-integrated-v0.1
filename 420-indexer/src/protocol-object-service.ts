import type { IndexerQueryService420, QueryRow420 } from './query-service.js';
import { protocolObjectStateDto420, type ProtocolObjectStateDto420 } from './public-dto.js';

interface QueryResultLike420 { rows?: QueryRow420[]; }

function firstRow420(result: unknown): QueryRow420 | null {
  if (!result || typeof result !== 'object') throw new Error('query executor returned invalid result');
  const rows = (result as QueryResultLike420).rows;
  if (!Array.isArray(rows)) throw new Error('query executor result missing rows');
  return rows[0] ?? null;
}

export async function protocolObjectState420(
  service: IndexerQueryService420,
  chainId: bigint,
  protocol: string,
  objectKey: string
): Promise<ProtocolObjectStateDto420 | null> {
  if (!protocol.trim()) throw new Error('protocol is required');
  if (!objectKey.trim()) throw new Error('object key is required');

  const row = firstRow420(await service.db.query(
    `select * from idx_protocol_latest_object_state
     where chain_id = $1 and protocol = $2 and object_key = $3
     limit 1`,
    [chainId.toString(), protocol, objectKey]
  ));

  return row ? protocolObjectStateDto420(row) : null;
}
