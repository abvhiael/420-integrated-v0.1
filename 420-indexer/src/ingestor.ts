import type { ChainSource420, IndexerBlock, IndexerLog, IndexerReceipt, IndexerTransaction } from './chain-source.js';
import type { CheckpointStore420 } from './checkpoint-store.js';
import { assertCheckpointContinuation420, assertFinalityPolicy420, checkpointFromBlock420, normalizeLogs420, safeHead420, type FinalityPolicy420, type IndexCheckpoint420 } from './indexing.js';
import { MemoryCanonicalHistoryStore420, recoverCanonicalAncestry420, type CanonicalHistoryStore420 } from './reorg.js';
import type { IndexerOperationalTelemetry420 } from './operational-telemetry.js';
import type { IndexerWorkController420 } from './work-controller.js';

export interface IndexedBlockBatch420 {
  chainId: bigint;
  block: IndexerBlock;
  transactions: IndexerTransaction[];
  receipts: IndexerReceipt[];
  logs: IndexerLog[];
}
export interface BlockConsumer420 { applyBlock(batch: IndexedBlockBatch420): Promise<void>; rollbackTo?(blockNumber: bigint | null): Promise<void>; }
export interface IngestionOptions420 { finality: FinalityPolicy420; startBlock?: bigint; maxBlocksPerRun?: number; maxReorgDepth?: number; }
export interface IngestionRun420 { chainId: bigint; sourceId: string; safeHead: bigint; processed: number; firstBlock: bigint | null; lastBlock: bigint | null; checkpoint: IndexCheckpoint420 | null; recoveredReorgDepth: number; }

export class IndexerIngestor420 {
  readonly history: CanonicalHistoryStore420;
  constructor(
    readonly source: ChainSource420,
    readonly checkpoints: CheckpointStore420,
    readonly consumer: BlockConsumer420,
    readonly options: IngestionOptions420,
    history?: CanonicalHistoryStore420,
    readonly workController?: IndexerWorkController420,
    readonly telemetry?: IndexerOperationalTelemetry420
  ) {
    this.history = history ?? new MemoryCanonicalHistoryStore420();
    assertFinalityPolicy420(options.finality);
    if (options.startBlock !== undefined && options.startBlock < 0n) throw new Error('startBlock cannot be negative');
    if (options.maxBlocksPerRun !== undefined && (!Number.isInteger(options.maxBlocksPerRun) || options.maxBlocksPerRun < 1)) throw new Error('maxBlocksPerRun must be a positive integer');
    if (options.maxReorgDepth !== undefined && (!Number.isInteger(options.maxReorgDepth) || options.maxReorgDepth < 1)) throw new Error('maxReorgDepth must be a positive integer');
  }
  private async safeHead(): Promise<bigint> {
    if (this.options.finality.mode === 'finalized') {
      if (!this.source.finalizedBlockNumber) throw new Error('chain source does not expose finalized block semantics');
      return this.source.finalizedBlockNumber();
    }
    return safeHead420(await this.source.blockNumber(), this.options.finality);
  }
  private async runOnceInner(): Promise<IngestionRun420> {
    const chainId = await this.source.chainId();
    let checkpoint = await this.checkpoints.load();
    if (checkpoint && checkpoint.chainId !== chainId) throw new Error(`checkpoint chain mismatch: expected ${chainId}, got ${checkpoint.chainId}`);
    let recoveredReorgDepth = 0;
    if (checkpoint) {
      const canonical = await this.source.getBlockByNumber(checkpoint.blockNumber);
      if (!canonical || canonical.hash.toLowerCase() !== checkpoint.blockHash.toLowerCase()) {
        if (!this.consumer.rollbackTo) throw new Error(`reorg detected at checkpoint ${checkpoint.blockNumber}; consumer cannot rollback`);
        const recovery = await recoverCanonicalAncestry420(this.source, this.checkpoints, this.history, { rollbackTo: this.consumer.rollbackTo.bind(this.consumer) }, checkpoint, this.options.maxReorgDepth ?? 64);
        checkpoint = recovery.ancestor;
        recoveredReorgDepth = recovery.depth;
      }
    }
    const safeHead = await this.safeHead();
    const firstBlock = checkpoint ? checkpoint.blockNumber + 1n : (this.options.startBlock ?? 0n);
    if (firstBlock > safeHead) return { chainId, sourceId: this.source.sourceId, safeHead, processed: 0, firstBlock: null, lastBlock: null, checkpoint, recoveredReorgDepth };
    const limit = BigInt(this.options.maxBlocksPerRun ?? 100);
    const endBlock = firstBlock + limit - 1n < safeHead ? firstBlock + limit - 1n : safeHead;
    let processed = 0;
    let lastBlock: bigint | null = null;
    for (let blockNumber = firstBlock; blockNumber <= endBlock; blockNumber += 1n) {
      const block = await this.source.getBlockByNumber(blockNumber);
      if (!block) throw new Error(`missing block ${blockNumber}`);
      if (block.number !== blockNumber) throw new Error(`source returned block ${block.number} for requested ${blockNumber}`);
      if (checkpoint) assertCheckpointContinuation420(checkpoint, block);
      const transactions = this.source.getBlockTransactionsByNumber ? await this.source.getBlockTransactionsByNumber(blockNumber) : [];
      const receipts: IndexerReceipt[] = [];
      for (const tx of transactions) {
        const receipt = await this.source.getTransactionReceipt(tx.hash);
        if (!receipt) throw new Error(`missing receipt ${tx.hash}`);
        receipts.push(receipt);
      }
      const logs = normalizeLogs420(await this.source.getLogs({ fromBlock: blockNumber, toBlock: blockNumber }));
      await this.consumer.applyBlock({ chainId, block, transactions, receipts, logs });
      checkpoint = checkpointFromBlock420(chainId, block);
      await this.history.save(checkpoint);
      await this.checkpoints.save(checkpoint);
      processed += 1;
      lastBlock = blockNumber;
    }
    return { chainId, sourceId: this.source.sourceId, safeHead, processed, firstBlock, lastBlock, checkpoint, recoveredReorgDepth };
  }
  async runOnce(): Promise<IngestionRun420> {
    try {
      const run = await (this.workController
        ? this.workController.run(() => this.runOnceInner())
        : this.runOnceInner());
      this.telemetry?.recordIngestRun(run.processed, run.recoveredReorgDepth);
      this.telemetry?.setHeads(run.checkpoint?.blockNumber ?? null, run.safeHead);
      return run;
    } catch (error) {
      this.telemetry?.recordIngestFailure();
      throw error;
    }
  }
}
