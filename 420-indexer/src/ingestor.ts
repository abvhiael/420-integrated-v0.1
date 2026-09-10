import type { ChainSource420, IndexerBlock, IndexerLog } from './chain-source.js';
import type { CheckpointStore420 } from './checkpoint-store.js';
import {
  assertCheckpointContinuation420,
  assertFinalityPolicy420,
  checkpointFromBlock420,
  normalizeLogs420,
  safeHead420,
  type FinalityPolicy420,
  type IndexCheckpoint420
} from './indexing.js';

export interface IndexedBlockBatch420 {
  chainId: bigint;
  block: IndexerBlock;
  logs: IndexerLog[];
}

export interface BlockConsumer420 {
  applyBlock(batch: IndexedBlockBatch420): Promise<void>;
}

export interface IngestionOptions420 {
  finality: FinalityPolicy420;
  startBlock?: bigint;
  maxBlocksPerRun?: number;
}

export interface IngestionRun420 {
  chainId: bigint;
  sourceId: string;
  safeHead: bigint;
  processed: number;
  firstBlock: bigint | null;
  lastBlock: bigint | null;
  checkpoint: IndexCheckpoint420 | null;
}

export class IndexerIngestor420 {
  constructor(
    readonly source: ChainSource420,
    readonly checkpoints: CheckpointStore420,
    readonly consumer: BlockConsumer420,
    readonly options: IngestionOptions420
  ) {
    assertFinalityPolicy420(options.finality);
    if (options.startBlock !== undefined && options.startBlock < 0n) throw new Error('startBlock cannot be negative');
    if (options.maxBlocksPerRun !== undefined && (!Number.isInteger(options.maxBlocksPerRun) || options.maxBlocksPerRun < 1)) {
      throw new Error('maxBlocksPerRun must be a positive integer');
    }
  }

  async runOnce(): Promise<IngestionRun420> {
    if (this.options.finality.mode === 'finalized') {
      throw new Error('finalized ingestion is unavailable until the chain source exposes a finalized block tag');
    }

    const chainId = await this.source.chainId();
    let checkpoint = await this.checkpoints.load();
    if (checkpoint && checkpoint.chainId !== chainId) {
      throw new Error(`checkpoint chain mismatch: expected ${chainId}, got ${checkpoint.chainId}`);
    }

    const head = await this.source.blockNumber();
    const safeHead = safeHead420(head, this.options.finality);
    const firstBlock = checkpoint ? checkpoint.blockNumber + 1n : (this.options.startBlock ?? 0n);
    if (firstBlock > safeHead) {
      return {
        chainId,
        sourceId: this.source.sourceId,
        safeHead,
        processed: 0,
        firstBlock: null,
        lastBlock: null,
        checkpoint
      };
    }

    const limit = BigInt(this.options.maxBlocksPerRun ?? 100);
    const boundedEnd = firstBlock + limit - 1n;
    const endBlock = boundedEnd < safeHead ? boundedEnd : safeHead;
    let processed = 0;
    let lastBlock: bigint | null = null;

    for (let blockNumber = firstBlock; blockNumber <= endBlock; blockNumber += 1n) {
      const block = await this.source.getBlockByNumber(blockNumber);
      if (!block) throw new Error(`missing block ${blockNumber}`);
      if (block.number !== blockNumber) throw new Error(`source returned block ${block.number} for requested ${blockNumber}`);
      if (checkpoint) assertCheckpointContinuation420(checkpoint, block);

      const logs = normalizeLogs420(await this.source.getLogs({ fromBlock: blockNumber, toBlock: blockNumber }));

      // Persistence is deliberately last: consumer work must complete before the
      // checkpoint advances, making an interrupted block safe to replay.
      await this.consumer.applyBlock({ chainId, block, logs });
      checkpoint = checkpointFromBlock420(chainId, block);
      await this.checkpoints.save(checkpoint);
      processed += 1;
      lastBlock = blockNumber;
    }

    return {
      chainId,
      sourceId: this.source.sourceId,
      safeHead,
      processed,
      firstBlock,
      lastBlock,
      checkpoint
    };
  }
}
