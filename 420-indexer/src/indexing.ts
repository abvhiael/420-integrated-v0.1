import type { Hex, IndexerBlock, IndexerLog } from './chain-source.js';

export type FinalityMode420 = 'head' | 'confirmations' | 'finalized';

export interface FinalityPolicy420 {
  mode: FinalityMode420;
  confirmations?: bigint;
}

export interface IndexCheckpoint420 {
  chainId: bigint;
  blockNumber: bigint;
  blockHash: Hex;
  parentHash: Hex;
  finalizedNumber?: bigint;
  finalizedHash?: Hex;
}

export function assertFinalityPolicy420(policy: FinalityPolicy420): void {
  if (policy.mode === 'confirmations') {
    if (policy.confirmations === undefined || policy.confirmations < 1n) {
      throw new Error('confirmations finality requires confirmations >= 1');
    }
    return;
  }
  if (policy.confirmations !== undefined) {
    throw new Error('confirmations is only valid with confirmations finality');
  }
}

export function safeHead420(head: bigint, policy: FinalityPolicy420): bigint {
  assertFinalityPolicy420(policy);
  if (policy.mode !== 'confirmations') return head;
  const depth = policy.confirmations!;
  return head < depth ? 0n : head - depth;
}

export function checkpointFromBlock420(chainId: bigint, block: IndexerBlock): IndexCheckpoint420 {
  if (block.number < 0n) throw new Error('block number cannot be negative');
  return {
    chainId,
    blockNumber: block.number,
    blockHash: block.hash,
    parentHash: block.parentHash
  };
}

export function assertCheckpointContinuation420(checkpoint: IndexCheckpoint420, next: IndexerBlock): void {
  if (next.number !== checkpoint.blockNumber + 1n) {
    throw new Error(`non-contiguous block: expected ${checkpoint.blockNumber + 1n}, got ${next.number}`);
  }
  if (next.parentHash.toLowerCase() !== checkpoint.blockHash.toLowerCase()) {
    throw new Error(`reorg detected at block ${next.number}`);
  }
}

export function compareLogs420(a: IndexerLog, b: IndexerLog): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
  return a.logIndex - b.logIndex;
}

export function normalizeLogs420(logs: readonly IndexerLog[]): IndexerLog[] {
  const seen = new Map<string, IndexerLog>();
  return [...logs]
    .filter((log) => !log.removed)
    .sort(compareLogs420)
    .filter((log) => {
      const key = `${log.blockHash.toLowerCase()}:${log.transactionHash.toLowerCase()}:${log.logIndex}`;
      const previous = seen.get(key);
      if (previous) {
        if (previous.blockNumber !== log.blockNumber || previous.transactionIndex !== log.transactionIndex ||
          previous.address.toLowerCase() !== log.address.toLowerCase() || previous.data.toLowerCase() !== log.data.toLowerCase() ||
          previous.topics.map(t=>t.toLowerCase()).join(':') !== log.topics.map(t=>t.toLowerCase()).join(':')) throw new Error('conflicting duplicate event evidence');
        return false;
      }
      seen.set(key, log);
      return true;
    });
}
