import type { QueryRow420 } from './query-service.js';

function requiredString420(row: QueryRow420, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${field} in query row`);
  return value;
}

function optionalString420(row: QueryRow420, field: string): string | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`invalid ${field} in query row`);
  return value;
}

function requiredUnsignedString420(row: QueryRow420, field: string): string {
  const value = row[field];
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error(`invalid ${field} in query row`);
}

function requiredInteger420(row: QueryRow420, field: string): number {
  const value = row[field];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`invalid ${field} in query row`);
}

function requiredReceiptStatus420(row: QueryRow420): 0 | 1 {
  const value = requiredInteger420(row, 'status');
  if (value !== 0 && value !== 1) throw new Error('invalid status in query row');
  return value;
}

function requiredTopics420(row: QueryRow420): string[] {
  const value = row.topics;
  if (!Array.isArray(value) || value.some((topic) => typeof topic !== 'string')) throw new Error('invalid topics in query row');
  return [...value];
}

export interface ReceiptDto420 {
  chainId: string;
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: number;
  status: 0 | 1;
  contractAddress: string | null;
}

export interface LogDto420 {
  chainId: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
}

export function receiptDto420(row: QueryRow420): ReceiptDto420 {
  return {
    chainId: requiredUnsignedString420(row, 'chain_id'),
    transactionHash: requiredString420(row, 'tx_hash'),
    blockNumber: requiredUnsignedString420(row, 'block_number'),
    blockHash: requiredString420(row, 'block_hash'),
    transactionIndex: requiredInteger420(row, 'tx_index'),
    status: requiredReceiptStatus420(row),
    contractAddress: optionalString420(row, 'contract_address')
  };
}

export function logDto420(row: QueryRow420): LogDto420 {
  return {
    chainId: requiredUnsignedString420(row, 'chain_id'),
    blockNumber: requiredUnsignedString420(row, 'block_number'),
    blockHash: requiredString420(row, 'block_hash'),
    transactionHash: requiredString420(row, 'tx_hash'),
    transactionIndex: requiredInteger420(row, 'tx_index'),
    logIndex: requiredInteger420(row, 'log_index'),
    address: requiredString420(row, 'address'),
    topics: requiredTopics420(row),
    data: requiredString420(row, 'data')
  };
}
