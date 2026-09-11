import type { QueryRow420 } from './query-service.js';

function requiredString(row: QueryRow420, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${field} in query row`);
  return value;
}

function optionalString(row: QueryRow420, field: string): string | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`invalid ${field} in query row`);
  return value;
}

function requiredBigintString(row: QueryRow420, field: string): string {
  const value = row[field];
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error(`invalid ${field} in query row`);
}

function requiredInteger(row: QueryRow420, field: string): number {
  const value = row[field];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`invalid ${field} in query row`);
}

export interface BlockDto420 {
  chainId: string;
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
}

export interface TransactionDto420 {
  chainId: string;
  hash: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to: string | null;
  valueWei: string;
  input: string;
}

export interface AssetTransferDto420 {
  chainId: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: number | null;
  assetKey: string;
  assetKind: string;
  contractAddress: string | null;
  tokenId: string | null;
  from: string;
  to: string;
  amount: string;
}

export function blockDto420(row: QueryRow420): BlockDto420 {
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    number: requiredBigintString(row, 'block_number'),
    hash: requiredString(row, 'block_hash'),
    parentHash: requiredString(row, 'parent_hash'),
    timestamp: requiredBigintString(row, 'block_timestamp')
  };
}

export function transactionDto420(row: QueryRow420): TransactionDto420 {
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    hash: requiredString(row, 'tx_hash'),
    blockNumber: requiredBigintString(row, 'block_number'),
    blockHash: requiredString(row, 'block_hash'),
    transactionIndex: requiredInteger(row, 'tx_index'),
    from: requiredString(row, 'from_address'),
    to: optionalString(row, 'to_address'),
    valueWei: requiredBigintString(row, 'value_wei'),
    input: requiredString(row, 'input')
  };
}

export function assetTransferDto420(row: QueryRow420): AssetTransferDto420 {
  const logIndexValue = row.log_index;
  const tokenIdValue = row.token_id;
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    blockNumber: requiredBigintString(row, 'block_number'),
    transactionHash: requiredString(row, 'tx_hash'),
    logIndex: logIndexValue === null || logIndexValue === undefined ? null : requiredInteger(row, 'log_index'),
    assetKey: requiredString(row, 'asset_key'),
    assetKind: requiredString(row, 'asset_kind'),
    contractAddress: optionalString(row, 'contract_address'),
    tokenId: tokenIdValue === null || tokenIdValue === undefined ? null : requiredBigintString(row, 'token_id'),
    from: requiredString(row, 'from_address'),
    to: requiredString(row, 'to_address'),
    amount: requiredBigintString(row, 'amount')
  };
}
