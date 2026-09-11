import type { QueryRow420 } from './query-service.js';
import { NATIVE_ASSET_TRANSFER_POSITION_420 } from './query-layer.js';

export type JsonValue420 = null | boolean | number | string | JsonValue420[] | { [key: string]: JsonValue420 };

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

function requiredBoolean(row: QueryRow420, field: string): boolean {
  const value = row[field];
  if (typeof value !== 'boolean') throw new Error(`invalid ${field} in query row`);
  return value;
}

function requiredAssetPosition(row: QueryRow420, field: string): number {
  const value = row[field];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= NATIVE_ASSET_TRANSFER_POSITION_420) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= NATIVE_ASSET_TRANSFER_POSITION_420) return parsed;
  }
  throw new Error(`invalid ${field} in query row`);
}

function jsonValue420(value: unknown, field = 'fields'): JsonValue420 {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => jsonValue420(item, field));
  if (value && typeof value === 'object') {
    const out: { [key: string]: JsonValue420 } = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = jsonValue420(entry, field);
    return out;
  }
  throw new Error(`invalid ${field} in query row`);
}

function requiredJsonObject420(row: QueryRow420, field: string): { [key: string]: JsonValue420 } {
  const value = jsonValue420(row[field], field);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`invalid ${field} in query row`);
  return value;
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

export interface AddressDto420 {
  chainId: string;
  address: string;
  isContract: boolean;
}

export interface AssetTransferDto420 {
  chainId: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
  assetKey: string;
  assetKind: string;
  contractAddress: string | null;
  tokenId: string | null;
  from: string;
  to: string;
  amount: string;
}

export interface ProtocolEventDto420 {
  chainId: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  contractAddress: string;
  protocol: string;
  eventName: string;
  objectKey: string | null;
  lifecycleState: string | null;
  fields: { [key: string]: JsonValue420 };
}

export interface ProtocolObjectStateDto420 {
  chainId: string;
  protocol: string;
  objectKey: string;
  contractAddress: string;
  eventName: string;
  lifecycleState: string | null;
  fields: { [key: string]: JsonValue420 };
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
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

export function addressDto420(row: QueryRow420): AddressDto420 {
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    address: requiredString(row, 'address'),
    isContract: requiredBoolean(row, 'is_contract')
  };
}

export function assetTransferDto420(row: QueryRow420): AssetTransferDto420 {
  const tokenIdValue = row.token_id;
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    blockNumber: requiredBigintString(row, 'block_number'),
    transactionHash: requiredString(row, 'tx_hash'),
    logIndex: requiredAssetPosition(row, 'log_index'),
    assetKey: requiredString(row, 'asset_key'),
    assetKind: requiredString(row, 'asset_kind'),
    contractAddress: optionalString(row, 'contract_address'),
    tokenId: tokenIdValue === null || tokenIdValue === undefined ? null : requiredBigintString(row, 'token_id'),
    from: requiredString(row, 'from_address'),
    to: requiredString(row, 'to_address'),
    amount: requiredBigintString(row, 'amount')
  };
}

export function protocolEventDto420(row: QueryRow420): ProtocolEventDto420 {
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    blockNumber: requiredBigintString(row, 'block_number'),
    blockHash: requiredString(row, 'block_hash'),
    transactionHash: requiredString(row, 'tx_hash'),
    transactionIndex: requiredInteger(row, 'tx_index'),
    logIndex: requiredInteger(row, 'log_index'),
    contractAddress: requiredString(row, 'contract_address'),
    protocol: requiredString(row, 'protocol'),
    eventName: requiredString(row, 'event_name'),
    objectKey: optionalString(row, 'object_key'),
    lifecycleState: optionalString(row, 'lifecycle_state'),
    fields: requiredJsonObject420(row, 'fields')
  };
}

export function protocolObjectStateDto420(row: QueryRow420): ProtocolObjectStateDto420 {
  return {
    chainId: requiredBigintString(row, 'chain_id'),
    protocol: requiredString(row, 'protocol'),
    objectKey: requiredString(row, 'object_key'),
    contractAddress: requiredString(row, 'contract_address'),
    eventName: requiredString(row, 'event_name'),
    lifecycleState: optionalString(row, 'lifecycle_state'),
    fields: requiredJsonObject420(row, 'fields'),
    blockNumber: requiredBigintString(row, 'block_number'),
    blockHash: requiredString(row, 'block_hash'),
    transactionHash: requiredString(row, 'tx_hash'),
    transactionIndex: requiredInteger(row, 'tx_index'),
    logIndex: requiredInteger(row, 'log_index')
  };
}
