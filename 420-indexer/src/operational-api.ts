import type { FinalityPolicy420 } from './indexing.js';
import type { IndexerQueryService420, QueryRow420 } from './query-service.js';

function rows420(result: unknown): QueryRow420[] {
  if (!result || typeof result !== 'object') throw new Error('query executor returned invalid result');
  const rows = (result as { rows?: QueryRow420[] }).rows;
  if (!Array.isArray(rows)) throw new Error('query executor result missing rows');
  return rows;
}

function optionalUnsignedString420(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint' && value >= 0n) return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error(`invalid ${field} in query row`);
}

function optionalString420(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${field} in query row`);
  return value;
}

export interface IndexerHealthDto420 {
  status: 'ok';
  apiVersion: 'v1';
}

export interface IndexerReadinessDto420 {
  ready: boolean;
  databaseReady: boolean;
  chainId: string;
  indexedHead: string | null;
}

export interface IndexerStatusDto420 {
  chainId: string;
  indexedHead: string | null;
  indexedHeadHash: string | null;
  indexedHeadTimestamp: string | null;
  finality: {
    mode: FinalityPolicy420['mode'];
    confirmations: string | null;
    safeHead: string | null;
  };
  lag: string | null;
  authoritative: false;
}

export function indexerHealth420(): IndexerHealthDto420 {
  return { status: 'ok', apiVersion: 'v1' };
}

export async function indexerStatus420(
  service: IndexerQueryService420,
  chainId: bigint,
  finalityPolicy: FinalityPolicy420
): Promise<IndexerStatusDto420> {
  const rows = rows420(await service.db.query(
    `select block_number, block_hash, block_timestamp
       from idx_blocks
      where chain_id = $1
      order by block_number desc
      limit 1`,
    [chainId.toString()]
  ));
  const row = rows[0];
  const indexedHead = row ? optionalUnsignedString420(row.block_number, 'block_number') : null;
  return {
    chainId: chainId.toString(),
    indexedHead,
    indexedHeadHash: row ? optionalString420(row.block_hash, 'block_hash') : null,
    indexedHeadTimestamp: row ? optionalUnsignedString420(row.block_timestamp, 'block_timestamp') : null,
    finality: {
      mode: finalityPolicy.mode,
      confirmations: finalityPolicy.mode === 'confirmations' ? finalityPolicy.confirmations!.toString() : null,
      safeHead: indexedHead
    },
    lag: null,
    authoritative: false
  };
}

export async function indexerReadiness420(service: IndexerQueryService420, chainId: bigint): Promise<IndexerReadinessDto420> {
  await service.db.query('select 1', []);
  const rows = rows420(await service.db.query(
    'select block_number from idx_blocks where chain_id = $1 order by block_number desc limit 1',
    [chainId.toString()]
  ));
  const indexedHead = rows[0] ? optionalUnsignedString420(rows[0].block_number, 'block_number') : null;
  return { ready: indexedHead !== null, databaseReady: true, chainId: chainId.toString(), indexedHead };
}
