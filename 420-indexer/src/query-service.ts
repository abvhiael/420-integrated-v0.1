import type { SqlExecutor420 } from './core-projections.js';
import {
  type QueryDirection420,
  type QueryPage420,
  type SqlQuery420,
  blocksQuery420,
  transactionsQuery420,
  logsQuery420,
  protocolEventsQuery420,
  assetTransfersQuery420,
  encodeBlockCursor420,
  encodeTransactionCursor420,
  encodePositionCursor420,
  encodeAssetTransferCursor420,
  NATIVE_ASSET_TRANSFER_POSITION_420,
  normalizeLimit420
} from './query-layer.js';
import { classifySearch420, type SearchRoute420 } from './search-router.js';
import { blockDto420, transactionDto420, assetTransferDto420, type BlockDto420, type TransactionDto420, type AssetTransferDto420 } from './public-dto.js';

export type QueryRow420 = Record<string, unknown>;

interface QueryResultLike420 { rows?: QueryRow420[]; }

function rows420(result: unknown): QueryRow420[] {
  if (!result || typeof result !== 'object') throw new Error('query executor returned invalid result');
  const rows = (result as QueryResultLike420).rows;
  if (!Array.isArray(rows)) throw new Error('query executor result missing rows');
  return rows;
}

function bigintField420(row: QueryRow420, field: string): bigint {
  const value = row[field];
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`invalid ${field} in query row`);
}

function integerField420(row: QueryRow420, field: string): number {
  const value = row[field];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`invalid ${field} in query row`);
}

function assetPositionField420(row: QueryRow420, field: string): number {
  const value = row[field];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= NATIVE_ASSET_TRANSFER_POSITION_420) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= NATIVE_ASSET_TRANSFER_POSITION_420) return parsed;
  }
  throw new Error(`invalid ${field} in query row`);
}

function stringField420(row: QueryRow420, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${field} in query row`);
  return value;
}

function page420<T extends QueryRow420>(rows: T[], limit: number, cursorFor: (row: T) => string): QueryPage420<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0 ? cursorFor(items[items.length - 1]!) : null;
  return { items, nextCursor };
}

function mapPage420<T>(page: QueryPage420<QueryRow420>, mapper: (row: QueryRow420) => T): QueryPage420<T> {
  return { items: page.items.map(mapper), nextCursor: page.nextCursor };
}

async function run420(db: SqlExecutor420, query: SqlQuery420): Promise<QueryRow420[]> {
  return rows420(await db.query(query.text, query.params));
}

export class IndexerQueryService420 {
  constructor(readonly db: SqlExecutor420) {}

  async blocks(chainId: bigint, opts: { cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<QueryRow420>> {
    const limit = normalizeLimit420(opts.limit);
    const rows = await run420(this.db, blocksQuery420(chainId, opts));
    return page420(rows, limit, (row) => encodeBlockCursor420({ blockNumber: bigintField420(row, 'block_number') }));
  }

  async publicBlocks(chainId: bigint, opts: { cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<BlockDto420>> {
    return mapPage420(await this.blocks(chainId, opts), blockDto420);
  }

  async transactions(chainId: bigint, opts: { address?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<QueryRow420>> {
    const limit = normalizeLimit420(opts.limit);
    const rows = await run420(this.db, transactionsQuery420(chainId, opts));
    return page420(rows, limit, (row) => encodeTransactionCursor420({
      blockNumber: bigintField420(row, 'block_number'),
      txIndex: integerField420(row, 'tx_index')
    }));
  }

  async publicTransactions(chainId: bigint, opts: { address?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<TransactionDto420>> {
    return mapPage420(await this.transactions(chainId, opts), transactionDto420);
  }

  async logs(chainId: bigint, opts: { address?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<QueryRow420>> {
    const limit = normalizeLimit420(opts.limit);
    const rows = await run420(this.db, logsQuery420(chainId, opts));
    return page420(rows, limit, (row) => encodePositionCursor420({
      blockNumber: bigintField420(row, 'block_number'),
      txIndex: integerField420(row, 'tx_index'),
      logIndex: integerField420(row, 'log_index')
    }));
  }

  async protocolEvents(chainId: bigint, opts: { protocol?: string; objectKey?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<QueryRow420>> {
    const limit = normalizeLimit420(opts.limit);
    const rows = await run420(this.db, protocolEventsQuery420(chainId, opts));
    return page420(rows, limit, (row) => encodePositionCursor420({
      blockNumber: bigintField420(row, 'block_number'),
      txIndex: integerField420(row, 'tx_index'),
      logIndex: integerField420(row, 'log_index')
    }));
  }

  async assetTransfers(chainId: bigint, opts: { assetKey?: string; address?: string; cursor?: string; beforeBlock?: bigint; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<QueryRow420>> {
    const limit = normalizeLimit420(opts.limit);
    const rows = await run420(this.db, assetTransfersQuery420(chainId, opts));
    return page420(rows, limit, (row) => encodeAssetTransferCursor420({
      blockNumber: bigintField420(row, 'block_number'),
      txHash: stringField420(row, 'tx_hash'),
      logIndex: assetPositionField420(row, 'log_index')
    }));
  }

  async publicAssetTransfers(chainId: bigint, opts: { assetKey?: string; address?: string; cursor?: string; beforeBlock?: bigint; limit?: number; direction?: QueryDirection420 } = {}): Promise<QueryPage420<AssetTransferDto420>> {
    return mapPage420(await this.assetTransfers(chainId, opts), assetTransferDto420);
  }

  async blockByNumber(chainId: bigint, blockNumber: bigint): Promise<QueryRow420 | null> {
    const rows = rows420(await this.db.query('select * from idx_blocks where chain_id = $1 and block_number = $2 limit 1', [chainId.toString(), blockNumber.toString()]));
    return rows[0] ?? null;
  }

  async blockByHash(chainId: bigint, blockHash: string): Promise<QueryRow420 | null> {
    const rows = rows420(await this.db.query('select * from idx_blocks where chain_id = $1 and lower(block_hash) = $2 limit 1', [chainId.toString(), blockHash.toLowerCase()]));
    return rows[0] ?? null;
  }

  async transactionByHash(chainId: bigint, txHash: string): Promise<QueryRow420 | null> {
    const rows = rows420(await this.db.query('select * from idx_transactions where chain_id = $1 and lower(tx_hash) = $2 limit 1', [chainId.toString(), txHash.toLowerCase()]));
    return rows[0] ?? null;
  }

  async address(chainId: bigint, address: string): Promise<QueryRow420 | null> {
    const rows = rows420(await this.db.query('select * from idx_addresses where chain_id = $1 and address = $2 limit 1', [chainId.toString(), address.toLowerCase()]));
    return rows[0] ?? null;
  }

  classifySearch(term: string): SearchRoute420 { return classifySearch420(term); }

  async search(chainId: bigint, term: string, limit = 20): Promise<QueryRow420[]> {
    const route = classifySearch420(term);
    if (route.kind === 'unknown') return [];
    const bounded = Math.min(normalizeLimit420(limit), 50);
    const normalized = route.normalized;

    if (route.kind === 'block_number') {
      const row = await this.blockByNumber(chainId, BigInt(normalized));
      return row ? [{ result_type: 'block', result_key: normalized, result_value: row.block_hash }] : [];
    }
    if (route.kind === 'address') {
      const row = await this.address(chainId, normalized);
      return row ? [{ result_type: 'address', result_key: normalized, result_value: normalized }] : [];
    }
    if (route.kind === 'hash') {
      const [block, transaction] = await Promise.all([this.blockByHash(chainId, normalized), this.transactionByHash(chainId, normalized)]);
      const results: QueryRow420[] = [];
      if (block) results.push({ result_type: 'block', result_key: block.block_number, result_value: normalized });
      if (transaction) results.push({ result_type: 'transaction', result_key: normalized, result_value: normalized });
      return results.slice(0, bounded);
    }

    const result = await this.db.query(
      `select 'protocol_object' as result_type, object_key as result_key, protocol as result_value
       from idx_protocol_object_events where chain_id = $1 and lower(object_key) = $2
       order by block_number desc, tx_index desc, log_index desc limit $3`,
      [chainId.toString(), normalized, bounded]
    );
    return rows420(result);
  }
}

export { stringField420 };
