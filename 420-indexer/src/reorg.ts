import type { ChainSource420, IndexerBlock } from './chain-source.js';
import type { CheckpointStore420 } from './checkpoint-store.js';
import { checkpointFromBlock420, type IndexCheckpoint420 } from './indexing.js';

export interface CanonicalHistoryStore420 {
  load(blockNumber: bigint): Promise<IndexCheckpoint420 | null>;
  save(checkpoint: IndexCheckpoint420): Promise<void>;
  deleteAfter(blockNumber: bigint): Promise<void>;
}

export class MemoryCanonicalHistoryStore420 implements CanonicalHistoryStore420 {
  private readonly checkpoints = new Map<bigint, IndexCheckpoint420>();

  async load(blockNumber: bigint): Promise<IndexCheckpoint420 | null> {
    const checkpoint = this.checkpoints.get(blockNumber);
    return checkpoint ? { ...checkpoint } : null;
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    this.checkpoints.set(checkpoint.blockNumber, { ...checkpoint });
  }

  async deleteAfter(blockNumber: bigint): Promise<void> {
    for (const number of this.checkpoints.keys()) {
      if (number > blockNumber) this.checkpoints.delete(number);
    }
  }
}

export interface ReorgAwareConsumer420 {
  rollbackTo(blockNumber: bigint | null): Promise<void>;
  rollbackDurably?(blockNumber: bigint | null, ancestor: IndexCheckpoint420 | null): Promise<void>;
}

export interface ReorgRecovery420 {
  detected: boolean;
  depth: number;
  ancestor: IndexCheckpoint420 | null;
}

function sameHash(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function commitRollback420(
  consumer: ReorgAwareConsumer420,
  checkpoints: CheckpointStore420,
  history: CanonicalHistoryStore420,
  blockNumber: bigint | null,
  ancestor: IndexCheckpoint420 | null
): Promise<void> {
  if (consumer.rollbackDurably) {
    await consumer.rollbackDurably(blockNumber, ancestor);
    return;
  }
  await consumer.rollbackTo(blockNumber);
  await history.deleteAfter(blockNumber ?? -1n);
  if (ancestor) await checkpoints.save(ancestor);
  else await checkpoints.clear();
}

export async function recoverCanonicalAncestry420(
  source: ChainSource420,
  checkpoints: CheckpointStore420,
  history: CanonicalHistoryStore420,
  consumer: ReorgAwareConsumer420,
  current: IndexCheckpoint420,
  maxDepth: number
): Promise<ReorgRecovery420> {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error('maxReorgDepth must be a positive integer');

  const canonicalCurrent = await source.getBlockByNumber(current.blockNumber);
  if (canonicalCurrent && sameHash(canonicalCurrent.hash, current.blockHash)) {
    return { detected: false, depth: 0, ancestor: current };
  }

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (current.blockNumber < BigInt(depth)) break;
    const number = current.blockNumber - BigInt(depth);
    const local = await history.load(number);
    if (!local) continue;
    const canonical = await source.getBlockByNumber(number);
    if (canonical && sameHash(canonical.hash, local.blockHash)) {
      await commitRollback420(consumer, checkpoints, history, number, local);
      return { detected: true, depth, ancestor: local };
    }
  }

  if (current.blockNumber < BigInt(maxDepth)) {
    await commitRollback420(consumer, checkpoints, history, null, null);
    return { detected: true, depth: Number(current.blockNumber + 1n), ancestor: null };
  }

  throw new Error(`reorg exceeds configured max depth ${maxDepth}`);
}

export async function recordCanonicalBlock420(
  chainId: bigint,
  block: IndexerBlock,
  history: CanonicalHistoryStore420
): Promise<IndexCheckpoint420> {
  const checkpoint = checkpointFromBlock420(chainId, block);
  await history.save(checkpoint);
  return checkpoint;
}
