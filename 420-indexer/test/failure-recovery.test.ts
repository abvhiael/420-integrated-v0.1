import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChainSource420, Hex, IndexerBlock } from '../src/chain-source.js';
import { MemoryCheckpointStore420 } from '../src/checkpoint-store.js';
import { checkpointFromBlock420 } from '../src/indexing.js';
import { IndexerIngestor420, type DurableBlockConsumer420 } from '../src/ingestor.js';
import { MemoryCanonicalHistoryStore420 } from '../src/reorg.js';
import { evaluateIndexerRuntimeReadiness420, IndexerRuntimeState420 } from '../src/runtime-state.js';
import { IndexerOperationalTelemetry420 } from '../src/operational-telemetry.js';

const hash420 = (value: number): Hex => `0x${value.toString(16).padStart(64, '0')}`;
const block420 = (number: number, id = number, parentId = number - 1): IndexerBlock => ({
  number: BigInt(number),
  hash: hash420(id),
  parentHash: hash420(parentId),
  timestamp: BigInt(1_700_000_000 + number)
});

function source420(blocks: Map<bigint, IndexerBlock>, head: bigint): ChainSource420 {
  return {
    sourceId: 'failure-matrix',
    async chainId() { return 420n; },
    async blockNumber() { return head; },
    async getBlockByNumber(number) { return blocks.get(number) ?? null; },
    async getBlockByHash(value) { return [...blocks.values()].find((item) => item.hash === value) ?? null; },
    async getTransactionByHash() { return null; },
    async getTransactionReceipt() { return null; },
    async getLogs() { return []; },
    async call() { return '0x'; },
    async getCode() { return '0x'; }
  };
}

test('RPC outage fails the run without advancing checkpoint state', async () => {
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const telemetry = new IndexerOperationalTelemetry420();
  const source = source420(new Map(), 0n);
  source.blockNumber = async () => { throw new Error('rpc unavailable'); };

  const ingestor = new IndexerIngestor420(
    source,
    checkpoints,
    { async applyBlock() { throw new Error('must not apply'); } },
    { finality: { mode: 'confirmations', confirmations: 0 }, startBlock: 0n },
    history,
    undefined,
    telemetry
  );

  await assert.rejects(() => ingestor.runOnce(), /rpc unavailable/);
  assert.equal(await checkpoints.load(), null);
  assert.equal(await history.load(0n), null);
  assert.equal(telemetry.snapshot().ingestFailures, 1);
});

test('database interruption cannot advance external checkpoint beyond the failed block', async () => {
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const blocks = new Map<bigint, IndexerBlock>([[0n, block420(0, 0, 0)], [1n, block420(1)]]);
  let applies = 0;
  const ingestor = new IndexerIngestor420(
    source420(blocks, 1n),
    checkpoints,
    {
      async applyBlock() {
        applies += 1;
        if (applies === 2) throw new Error('database interrupted');
      }
    },
    { finality: { mode: 'confirmations', confirmations: 0 }, startBlock: 0n, maxBlocksPerRun: 10 },
    history
  );

  await assert.rejects(() => ingestor.runOnce(), /database interrupted/);
  assert.equal((await checkpoints.load())?.blockNumber, 0n);
  assert.equal((await history.load(0n))?.blockNumber, 0n);
  assert.equal(await history.load(1n), null);
});

test('restart resumes exactly after the last durable checkpoint', async () => {
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  const blocks = new Map<bigint, IndexerBlock>([[0n, block420(0, 0, 0)], [1n, block420(1)], [2n, block420(2)]]);
  const firstApplied: bigint[] = [];
  const first = new IndexerIngestor420(
    source420(blocks, 2n),
    checkpoints,
    { async applyBlock(batch) { firstApplied.push(batch.block.number); } },
    { finality: { mode: 'confirmations', confirmations: 0 }, startBlock: 0n, maxBlocksPerRun: 2 },
    history
  );
  await first.runOnce();
  assert.deepEqual(firstApplied, [0n, 1n]);

  const resumed: bigint[] = [];
  const second = new IndexerIngestor420(
    source420(blocks, 2n),
    checkpoints,
    { async applyBlock(batch) { resumed.push(batch.block.number); } },
    { finality: { mode: 'confirmations', confirmations: 0 }, startBlock: 0n, maxBlocksPerRun: 10 },
    history
  );
  const run = await second.runOnce();
  assert.deepEqual(resumed, [2n]);
  assert.equal(run.checkpoint?.blockNumber, 2n);
});

test('stale ingest makes an otherwise serving runtime unready until progress resumes', () => {
  const runtime = new IndexerRuntimeState420(1_000);
  runtime.markServing();
  runtime.markIngestSuccess(2_000, 20n);

  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 3_000, 2_000), {
    ready: true,
    stale: false,
    reason: null
  });
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 5_001, 2_000), {
    ready: false,
    stale: true,
    reason: 'stale_ingest'
  });

  runtime.markIngestSuccess(5_001, 21n);
  assert.equal(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 5_001, 2_000).ready, true);
});

test('durable reorg path delegates rollback atomically and resumes from the returned ancestor', async () => {
  const local1 = checkpointFromBlock420(420n, block420(1));
  const local2 = checkpointFromBlock420(420n, block420(2));
  const checkpoints = new MemoryCheckpointStore420();
  const history = new MemoryCanonicalHistoryStore420();
  await checkpoints.save(local2);
  await history.save(local1);
  await history.save(local2);

  const canonical = new Map<bigint, IndexerBlock>([
    [1n, block420(1)],
    [2n, block420(2, 200, 1)],
    [3n, block420(3, 300, 200)]
  ]);
  const rollbacks: Array<bigint | null> = [];
  const applied: bigint[] = [];
  const durable: DurableBlockConsumer420 = {
    async applyBlock(batch) { applied.push(batch.block.number); },
    async rollbackTo(number) { rollbacks.push(number); },
    async applyBlockDurably(batch) {
      applied.push(batch.block.number);
      const checkpoint = checkpointFromBlock420(batch.chainId, batch.block);
      await history.save(checkpoint);
      await checkpoints.save(checkpoint);
    },
    async rollbackDurably(number, checkpoint) {
      rollbacks.push(number);
      await history.deleteAfter(number ?? -1n);
      if (checkpoint) await checkpoints.save(checkpoint);
      else await checkpoints.clear();
    }
  };

  const ingestor = new IndexerIngestor420(
    source420(canonical, 3n),
    checkpoints,
    durable,
    { finality: { mode: 'confirmations', confirmations: 0 }, maxReorgDepth: 8 },
    history
  );
  const run = await ingestor.runOnce();

  assert.deepEqual(rollbacks, [1n]);
  assert.deepEqual(applied, [2n, 3n]);
  assert.equal(run.recoveredReorgDepth, 1);
  assert.equal(run.checkpoint?.blockNumber, 3n);
});
