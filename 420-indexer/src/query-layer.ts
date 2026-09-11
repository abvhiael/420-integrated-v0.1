import { NATIVE_TRANSFER_LOG_INDEX_420 } from './asset-decoder.js';

export type QueryDirection420 = 'asc' | 'desc';

export interface QueryPage420<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SqlQuery420 {
  text: string;
  params: readonly unknown[];
}

export interface PositionCursor420 {
  blockNumber: bigint;
  txIndex: number;
  logIndex: number;
}

export interface BlockCursor420 { blockNumber: bigint; }
export interface TransactionCursor420 { blockNumber: bigint; txIndex: number; }
export interface AssetTransferCursor420 { blockNumber: bigint; txHash: string; logIndex: number; }

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;
export const NATIVE_ASSET_TRANSFER_POSITION_420 = NATIVE_TRANSFER_LOG_INDEX_420;

export function normalizeLimit420(limit?: number): number {
  if (limit === undefined) return LIMIT_DEFAULT;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) throw new Error('limit must be an integer between 1 and 200');
  return limit;
}

function encode420(value: unknown): string {
  return Buffer.from(JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v), 'utf8').toString('base64url');
}

function decode420<T>(cursor: string): T {
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T; }
  catch { throw new Error('invalid query cursor'); }
}

export const encodeBlockCursor420 = (cursor: BlockCursor420): string => encode420({ b: cursor.blockNumber });
export const decodeBlockCursor420 = (cursor: string): BlockCursor420 => {
  const value = decode420<{ b?: string }>(cursor);
  if (!value.b || !/^\d+$/.test(value.b)) throw new Error('invalid block cursor');
  return { blockNumber: BigInt(value.b) };
};

export const encodeTransactionCursor420 = (cursor: TransactionCursor420): string => encode420({ b: cursor.blockNumber, t: cursor.txIndex });
export const decodeTransactionCursor420 = (cursor: string): TransactionCursor420 => {
  const value = decode420<{ b?: string; t?: number }>(cursor);
  if (!value.b || !/^\d+$/.test(value.b) || !Number.isSafeInteger(value.t) || (value.t as number) < 0) throw new Error('invalid transaction cursor');
  return { blockNumber: BigInt(value.b), txIndex: value.t as number };
};

export const encodePositionCursor420 = (cursor: PositionCursor420): string => encode420({ b: cursor.blockNumber, t: cursor.txIndex, l: cursor.logIndex });
export const decodePositionCursor420 = (cursor: string): PositionCursor420 => {
  const value = decode420<{ b?: string; t?: number; l?: number }>(cursor);
  if (!value.b || !/^\d+$/.test(value.b) || !Number.isSafeInteger(value.t) || !Number.isSafeInteger(value.l) || (value.t as number) < 0 || (value.l as number) < 0) throw new Error('invalid position cursor');
  return { blockNumber: BigInt(value.b), txIndex: value.t as number, logIndex: value.l as number };
};

export const encodeAssetTransferCursor420 = (cursor: AssetTransferCursor420): string => {
  if (!Number.isSafeInteger(cursor.logIndex) || cursor.logIndex < NATIVE_ASSET_TRANSFER_POSITION_420) throw new Error('invalid asset transfer cursor');
  return encode420({ b: cursor.blockNumber, h: cursor.txHash.toLowerCase(), l: cursor.logIndex });
};
export const decodeAssetTransferCursor420 = (cursor: string): AssetTransferCursor420 => {
  const value = decode420<{ b?: string; h?: string; l?: number }>(cursor);
  if (!value.b || !/^\d+$/.test(value.b) || typeof value.h !== 'string' || value.h.length === 0 || !Number.isSafeInteger(value.l) || (value.l as number) < NATIVE_ASSET_TRANSFER_POSITION_420) throw new Error('invalid asset transfer cursor');
  return { blockNumber: BigInt(value.b), txHash: value.h.toLowerCase(), logIndex: value.l as number };
};

function cmp(direction: QueryDirection420): '<' | '>' { return direction === 'desc' ? '<' : '>'; }
function order(direction: QueryDirection420): 'asc' | 'desc' { return direction; }

export function blocksQuery420(chainId: bigint, opts: { cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): SqlQuery420 {
  const direction = opts.direction ?? 'desc';
  const limit = normalizeLimit420(opts.limit);
  const params: unknown[] = [chainId.toString()];
  let where = 'chain_id = $1';
  if (opts.cursor) {
    const cursor = decodeBlockCursor420(opts.cursor);
    params.push(cursor.blockNumber.toString());
    where += ` and block_number ${cmp(direction)} $2`;
  }
  params.push(limit + 1);
  return { text: `select * from idx_blocks where ${where} order by block_number ${order(direction)} limit $${params.length}`, params };
}

export function transactionsQuery420(chainId: bigint, opts: { address?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): SqlQuery420 {
  const direction = opts.direction ?? 'desc';
  const limit = normalizeLimit420(opts.limit);
  const params: unknown[] = [chainId.toString()];
  const predicates = ['chain_id = $1'];
  if (opts.address) {
    params.push(opts.address.toLowerCase());
    predicates.push(`(from_address = $${params.length} or to_address = $${params.length})`);
  }
  if (opts.cursor) {
    const cursor = decodeTransactionCursor420(opts.cursor);
    params.push(cursor.blockNumber.toString(), cursor.txIndex);
    predicates.push(`(block_number, tx_index) ${cmp(direction)} ($${params.length - 1}, $${params.length})`);
  }
  params.push(limit + 1);
  return { text: `select * from idx_transactions where ${predicates.join(' and ')} order by block_number ${order(direction)}, tx_index ${order(direction)} limit $${params.length}`, params };
}

export function logsQuery420(chainId: bigint, opts: { address?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): SqlQuery420 {
  const direction = opts.direction ?? 'desc';
  const limit = normalizeLimit420(opts.limit);
  const params: unknown[] = [chainId.toString()];
  const predicates = ['chain_id = $1'];
  if (opts.address) { params.push(opts.address.toLowerCase()); predicates.push(`address = $${params.length}`); }
  if (opts.cursor) {
    const cursor = decodePositionCursor420(opts.cursor);
    params.push(cursor.blockNumber.toString(), cursor.txIndex, cursor.logIndex);
    predicates.push(`(block_number, tx_index, log_index) ${cmp(direction)} ($${params.length - 2}, $${params.length - 1}, $${params.length})`);
  }
  params.push(limit + 1);
  return { text: `select * from idx_logs where ${predicates.join(' and ')} order by block_number ${order(direction)}, tx_index ${order(direction)}, log_index ${order(direction)} limit $${params.length}`, params };
}

export function protocolEventsQuery420(chainId: bigint, opts: { protocol?: string; objectKey?: string; cursor?: string; limit?: number; direction?: QueryDirection420 } = {}): SqlQuery420 {
  const direction = opts.direction ?? 'desc';
  const limit = normalizeLimit420(opts.limit);
  const params: unknown[] = [chainId.toString()];
  const predicates = ['chain_id = $1'];
  if (opts.protocol) { params.push(opts.protocol); predicates.push(`protocol = $${params.length}`); }
  if (opts.objectKey) { params.push(opts.objectKey); predicates.push(`object_key = $${params.length}`); }
  if (opts.cursor) {
    const cursor = decodePositionCursor420(opts.cursor);
    params.push(cursor.blockNumber.toString(), cursor.txIndex, cursor.logIndex);
    predicates.push(`(block_number, tx_index, log_index) ${cmp(direction)} ($${params.length - 2}, $${params.length - 1}, $${params.length})`);
  }
  params.push(limit + 1);
  return { text: `select * from idx_protocol_object_events where ${predicates.join(' and ')} order by block_number ${order(direction)}, tx_index ${order(direction)}, log_index ${order(direction)} limit $${params.length}`, params };
}

export function assetTransfersQuery420(chainId: bigint, opts: { assetKey?: string; address?: string; cursor?: string; beforeBlock?: bigint; limit?: number; direction?: QueryDirection420 } = {}): SqlQuery420 {
  const direction = opts.direction ?? 'desc';
  const limit = normalizeLimit420(opts.limit);
  const params: unknown[] = [chainId.toString()];
  const predicates = ['chain_id = $1'];
  if (opts.assetKey) { params.push(opts.assetKey); predicates.push(`asset_key = $${params.length}`); }
  if (opts.address) { params.push(opts.address.toLowerCase()); predicates.push(`(from_address = $${params.length} or to_address = $${params.length})`); }
  if (opts.beforeBlock !== undefined) { params.push(opts.beforeBlock.toString()); predicates.push(`block_number < $${params.length}`); }
  if (opts.cursor) {
    const cursor = decodeAssetTransferCursor420(opts.cursor);
    params.push(cursor.blockNumber.toString(), cursor.txHash, cursor.logIndex);
    predicates.push(`(block_number, lower(tx_hash), log_index) ${cmp(direction)} ($${params.length - 2}, $${params.length - 1}, $${params.length})`);
  }
  params.push(limit + 1);
  return { text: `select * from idx_asset_transfers where ${predicates.join(' and ')} order by block_number ${order(direction)}, lower(tx_hash) ${order(direction)}, log_index ${order(direction)} limit $${params.length}`, params };
}
