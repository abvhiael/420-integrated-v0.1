import type { QueryDirection420, QueryPage420 } from './query-layer.js';
import {
  blockDto420,
  transactionDto420,
  addressDto420,
  protocolEventDto420,
  type AddressDto420,
  type BlockDto420,
  type TransactionDto420,
  type AssetTransferDto420,
  type ProtocolEventDto420
} from './public-dto.js';
import { logDto420, type LogDto420, type ReceiptDto420 } from './receipt-log-dto.js';
import { receiptByHash420 } from './receipt-log-service.js';
import type { QueryRow420 } from './query-service.js';
import { IndexerQueryService420 } from './query-service.js';

export const INDEXER_API_VERSION_420 = 'v1' as const;

export interface PageRequest420 {
  cursor?: string;
  limit?: number;
  direction?: QueryDirection420;
}

export interface TransactionPageRequest420 extends PageRequest420 {
  address?: string;
}

export interface LogPageRequest420 extends PageRequest420 {
  address?: string;
}

export interface AssetTransferPageRequest420 extends PageRequest420 {
  assetKey?: string;
  address?: string;
  beforeBlock?: bigint;
}

export interface ProtocolEventPageRequest420 extends PageRequest420 {
  protocol?: string;
  objectKey?: string;
}

export interface SearchResult420 {
  type: string;
  key: string;
  value: string;
}

export interface IndexerPublicApi420 {
  readonly version: typeof INDEXER_API_VERSION_420;
  blocks(chainId: bigint, request?: PageRequest420): Promise<QueryPage420<BlockDto420>>;
  block(chainId: bigint, id: string): Promise<BlockDto420 | null>;
  transactions(chainId: bigint, request?: TransactionPageRequest420): Promise<QueryPage420<TransactionDto420>>;
  transaction(chainId: bigint, hash: string): Promise<TransactionDto420 | null>;
  receipt(chainId: bigint, hash: string): Promise<ReceiptDto420 | null>;
  logs(chainId: bigint, request?: LogPageRequest420): Promise<QueryPage420<LogDto420>>;
  address(chainId: bigint, address: string): Promise<AddressDto420 | null>;
  assetTransfers(chainId: bigint, request?: AssetTransferPageRequest420): Promise<QueryPage420<AssetTransferDto420>>;
  protocolEvents(chainId: bigint, request?: ProtocolEventPageRequest420): Promise<QueryPage420<ProtocolEventDto420>>;
  search(chainId: bigint, term: string, limit?: number): Promise<SearchResult420[]>;
}

function searchResult420(row: QueryRow420): SearchResult420 {
  const type = row.result_type;
  const key = row.result_key;
  const value = row.result_value;
  if (typeof type !== 'string' || typeof key !== 'string' || typeof value !== 'string') {
    throw new Error('invalid search result row');
  }
  return { type, key, value };
}

export class IndexerPublicApiAdapter420 implements IndexerPublicApi420 {
  readonly version = INDEXER_API_VERSION_420;

  constructor(readonly service: IndexerQueryService420) {}

  blocks(chainId: bigint, request: PageRequest420 = {}): Promise<QueryPage420<BlockDto420>> {
    return this.service.publicBlocks(chainId, request);
  }

  async block(chainId: bigint, id: string): Promise<BlockDto420 | null> {
    const row = /^\d+$/.test(id)
      ? await this.service.blockByNumber(chainId, BigInt(id))
      : await this.service.blockByHash(chainId, id);
    return row ? blockDto420(row) : null;
  }

  transactions(chainId: bigint, request: TransactionPageRequest420 = {}): Promise<QueryPage420<TransactionDto420>> {
    return this.service.publicTransactions(chainId, request);
  }

  async transaction(chainId: bigint, hash: string): Promise<TransactionDto420 | null> {
    const row = await this.service.transactionByHash(chainId, hash);
    return row ? transactionDto420(row) : null;
  }

  receipt(chainId: bigint, hash: string): Promise<ReceiptDto420 | null> {
    return receiptByHash420(this.service, chainId, hash);
  }

  async logs(chainId: bigint, request: LogPageRequest420 = {}): Promise<QueryPage420<LogDto420>> {
    const page = await this.service.logs(chainId, request);
    return { items: page.items.map(logDto420), nextCursor: page.nextCursor };
  }

  async address(chainId: bigint, address: string): Promise<AddressDto420 | null> {
    const row = await this.service.address(chainId, address);
    return row ? addressDto420(row) : null;
  }

  assetTransfers(chainId: bigint, request: AssetTransferPageRequest420 = {}): Promise<QueryPage420<AssetTransferDto420>> {
    return this.service.publicAssetTransfers(chainId, request);
  }

  async protocolEvents(chainId: bigint, request: ProtocolEventPageRequest420 = {}): Promise<QueryPage420<ProtocolEventDto420>> {
    const page = await this.service.protocolEvents(chainId, request);
    return { items: page.items.map(protocolEventDto420), nextCursor: page.nextCursor };
  }

  async search(chainId: bigint, term: string, limit?: number): Promise<SearchResult420[]> {
    return (await this.service.search(chainId, term, limit)).map(searchResult420);
  }
}
