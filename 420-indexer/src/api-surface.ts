import type { QueryDirection420, QueryPage420 } from './query-layer.js';
import type { BlockDto420, TransactionDto420, AssetTransferDto420 } from './public-dto.js';
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
  transactions(chainId: bigint, request?: TransactionPageRequest420): Promise<QueryPage420<TransactionDto420>>;
  assetTransfers(chainId: bigint, request?: AssetTransferPageRequest420): Promise<QueryPage420<AssetTransferDto420>>;
  protocolEvents(chainId: bigint, request?: ProtocolEventPageRequest420): Promise<QueryPage420<QueryRow420>>;
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

  transactions(chainId: bigint, request: TransactionPageRequest420 = {}): Promise<QueryPage420<TransactionDto420>> {
    return this.service.publicTransactions(chainId, request);
  }

  assetTransfers(chainId: bigint, request: AssetTransferPageRequest420 = {}): Promise<QueryPage420<AssetTransferDto420>> {
    return this.service.publicAssetTransfers(chainId, request);
  }

  protocolEvents(chainId: bigint, request: ProtocolEventPageRequest420 = {}): Promise<QueryPage420<QueryRow420>> {
    return this.service.protocolEvents(chainId, request);
  }

  async search(chainId: bigint, term: string, limit?: number): Promise<SearchResult420[]> {
    return (await this.service.search(chainId, term, limit)).map(searchResult420);
  }
}
