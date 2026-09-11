import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCheckpointStore420, type CheckpointStore420 } from '../src/checkpoint-store.js';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog, IndexerReceipt, IndexerTransaction, LogFilter420 } from '../src/chain-source.js';
import { IndexerIngestor420, type DurableBlockConsumer420, type IndexedBlockBatch420 } from '../src/ingestor.js';
import type { IndexCheckpoint420 } from '../src/indexing.js';
import { MemoryCanonicalHistoryStore420, type CanonicalHistoryStore420 } from '../src/reorg.js';
import {
  parseTestnetQualificationConfig420,
  runTestnetReorgQualification420,
  runTestnetRestartQualification420,
} from '../src/testnet-qualification.js';

const GENESIS_HASH = `0x${'ab'.repeat(32)}` as Hex;

function hash420(value: number): Hex {
  return `0x${value.toString(16).padStart(64, '0')}` as Hex;
}

class RecoverySource420 implements ChainSource420 {
  readonly sourceId = 'idx-10.3-recovery-source';
  readonly blocks = new Map<bigint, IndexerBlock>();

  constructor(readonly head = 5n) {
    let parentHash = hash420(999);
    for (let number = 0n; number <= head; number += 1n) {
      const hash = number === 0n ? GENESIS_HASH : hash420(Number(number));
      this.blocks.set(number, { number, hash, parentHash, timestamp: 1_700_000_000n + number });
      parentHash = hash;
    }
  }

  forkFrom(blockNumber: bigint, salt = 1000): void {
    if (blockNumber <= 0n) throw new Error('test fork must preserve genesis');
    let parentHash = this.blocks.get(blockNumber - 1n)!.hash;
    for (let number = blockNumber; number <= this.head; number += 1n) {
      const hash = hash420(salt + Number(number));
      this.blocks.set(number, { number, hash, parentHash, timestamp: 1_700_000_000n + number });
      parentHash = hash;
    }
  }

  async chainId(): Promise<bigint> { return 420420n; }
  async blockNumber(): Promise<bigint> { return this.head; }
  async getBlockByNumber(blockNumber: bigint): Promise<IndexerBlock | null> { return this.blocks.get(blockNumber) ?? null; }
  async getBlockByHash(blockHash: Hex): Promise<IndexerBlock | null> {
    return [...this.blocks.values()].find((block) => block.hash.toLowerCase() === blockHash.toLowerCase()) ?? null;
  }
  async getBlockTransactionsByNumber(_blockNumber: bigint): Promise<IndexerTransaction[]> { return []; }
  async getTransactionByHash(_transactionHash: Hex): Promise<IndexerTransaction | null> { return null; }
  async getTransactionReceipt(_transactionHash: Hex): Promise<IndexerReceipt | null> { return null; }
  async getLogs(_filter: LogFilter420): Promise<IndexerLog[]> { return []; }
  async call(_request: { to: Hex; data: Hex }, _blockNumber?: bigint): Promise<Hex> { return '0x' as Hex; }
  async getCode(_address: Hex, _blockNumber?: bigint): Promise<Hex> { return '0x' as Hex; }
}

class DurableRecoveryConsumer420 implements DurableBlockConsumer420 {
  readonly batches: IndexedBlockBatch420[] = [];
  readonly rollbackCalls: Array<bigint | null> = [];

  constructor(
    readonly checkpoints: CheckpointStore420,
    readonly history: CanonicalHistoryStore420,
  ) {}

  async applyBlock(batch: IndexedBlockBatch420): Promise<void> {
    this.batches.push(batch);
  }

  async rollbackTo(blockNumber: bigint | null): Promise<void> {
    this.rollbackCalls.push(blockNumber);
  }

  async applyBlockDurably(batch: IndexedBlockBatch420, checkpoint: IndexCheckpoint420): Promise<void> {
    this.batches.push(batch);
    await this.history.save(checkpoint);
    await this.checkpoints.save(checkpoint);
  }

  async rollbackDurably(blockNumber: bigint | null, ancestor: IndexCheckpoint420 | null): Promise<void> {
    this.rollbackCalls.push(blockNumber);
    for (let index = this.batches.length - 1; index >= 0; index -= 1) {
      if (blockNumber === null || this.batches[index].block.number > blockNumber) this.batches.splice(index, 1);
    }
    await this.history.truncateAfter(blockNumber);
    if (ancestor) await this.checkpoints.save(ancestor);
    else await this.checkpoints.clear();
  }
}

function config420(overrides: Record<string, string | undefined> = {}) {
  return parseTestnetQualificationConfig420({
    IDX420_CHAIN_ID: '420420',
    IDX420_RPC_URL: 'https://rpc.testnet.420.example/',
    IDX420_EXPECTED_GENESIS_HASH: GENESIS_HASH,
    IDX420_FINALITY_MODE: 'head',
    IDX420_CONFIRMATIONS: undefined,
    IDX420_SUSTAINED_BLOCKS: '3',
    IDX420_MAX_REORG_DEPTH: '4',
    IDX420_RESTART_REPLAY_BLOCKS: '2',
    ...overrides,
  });
}

async function seedThrough420(
  source: RecoverySource420,
  checkpoints: MemoryCheckpointStore420,
  history: MemoryCanonicalHistoryStore420,
  consumer: DurableRecoveryConsumer420,
  through: bigint,
): Promise<void> {
  const ingestor = new IndexerIngestor420(
    source,
    checkpoints,
    consumer,
    { finality: { mode: 'head' }, startBlock: 0n, maxBlocksPerRun: Number(through + 1n), maxReorgDepth: 4 },
    history,
  );
  const run = await ingestor.runOnce();
  assert.equal(run.lastBlock, through);
}

test('IDX-10.3 resumes from durable state inside the replay window and a repeated restart is idempotent', async () => {
  const source = new RecoverySource420(5n);
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const consumer = new DurableRecoveryConsumer420(checkpoints, history);

  const seedSource = new RecoverySource420(3n);
  await seedThrough420(seedSource, checkpoints, history, consumer, 3n);

  const report = await runTestnetRestartQualification420(source, consumer, checkpoints, history, config420());
  assert.equal(report.checkpointBefore.blockNumber, 3n);
  assert.equal(report.replayGap, 2);
  assert.equal(report.processed, 2);
  assert.equal(report.checkpointAfter.blockNumber, 5n);
  assert.equal(report.idempotentProcessed, 0);
  assert.deepEqual(consumer.batches.map((batch) => batch.block.number), [0n, 1n, 2n, 3n, 4n, 5n]);
});

test('IDX-10.3 fails closed when restart catch-up exceeds the configured replay window', async () => {
  const source = new RecoverySource420(5n);
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const consumer = new DurableRecoveryConsumer420(checkpoints, history);
  const seedSource = new RecoverySource420(2n);
  await seedThrough420(seedSource, checkpoints, history, consumer, 2n);
  const before = await checkpoints.load();
  const batchCount = consumer.batches.length;

  await assert.rejects(
    () => runTestnetRestartQualification420(source, consumer, checkpoints, history, config420()),
    /restart replay gap 3 exceeds configured window 2/,
  );
  assert.deepEqual(await checkpoints.load(), before);
  assert.equal(consumer.batches.length, batchCount);
});

test('IDX-10.3 rolls back a bounded canonical reorg and deterministically replays the new branch', async () => {
  const source = new RecoverySource420(5n);
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const consumer = new DurableRecoveryConsumer420(checkpoints, history);
  await seedThrough420(source, checkpoints, history, consumer, 5n);

  source.forkFrom(4n);
  const report = await runTestnetReorgQualification420(source, consumer, checkpoints, history, config420());

  assert.equal(report.checkpointBefore.blockNumber, 5n);
  assert.equal(report.recoveredReorgDepth, 2);
  assert.equal(report.replayedBlocks, 2);
  assert.equal(report.checkpointAfter.blockNumber, 5n);
  assert.equal(report.checkpointAfter.blockHash, hash420(1005));
  assert.deepEqual(consumer.rollbackCalls, [3n]);
  assert.deepEqual(consumer.batches.map((batch) => batch.block.hash), [GENESIS_HASH, hash420(1), hash420(2), hash420(3), hash420(1004), hash420(1005)]);
});

test('IDX-10.3 deep reorg fails closed without destructive rollback or checkpoint movement', async () => {
  const source = new RecoverySource420(5n);
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const consumer = new DurableRecoveryConsumer420(checkpoints, history);
  await seedThrough420(source, checkpoints, history, consumer, 5n);
  const before = await checkpoints.load();
  const hashesBefore = consumer.batches.map((batch) => batch.block.hash);

  source.forkFrom(3n);
  await assert.rejects(
    () => runTestnetReorgQualification420(
      source,
      consumer,
      checkpoints,
      history,
      config420({ IDX420_MAX_REORG_DEPTH: '1', IDX420_RESTART_REPLAY_BLOCKS: '1' }),
    ),
    /reorg exceeds maximum supported depth 1/,
  );

  assert.deepEqual(await checkpoints.load(), before);
  assert.deepEqual(consumer.batches.map((batch) => batch.block.hash), hashesBefore);
  assert.deepEqual(consumer.rollbackCalls, []);
});
