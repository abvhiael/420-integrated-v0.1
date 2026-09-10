import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ChainSource420,
  Hex,
  IndexerBlock,
  IndexerLog,
  IndexerReceipt,
  IndexerTransaction,
  LogFilter420
} from '../src/chain-source.js';
import { FileCheckpointStore420, MemoryCheckpointStore420 } from '../src/checkpoint-store.js';
import { IndexerIngestor420, type BlockConsumer420, type IndexedBlockBatch420 } from '../src/ingestor.js';
import { EvmJsonRpcSource420, type JsonRpcTransport420 } from '../src/rpc-source.js';

const h = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

class FakeSource420 implements ChainSource420 {
  readonly sourceId = 'fake';
  constructor(readonly blocks: IndexerBlock[], readonly logsByBlock = new Map<bigint, IndexerLog[]>(), readonly id = 420n) {}
  async chainId(): Promise<bigint> { return this.id; }
  async blockNumber(): Promise<bigint> { return this.blocks.at(-1)?.number ?? 0n; }
  async getBlockByNumber(n: bigint): Promise<IndexerBlock | null> { return this.blocks.find((b) => b.number === n) ?? null; }
  async getBlockByHash(hash: Hex): Promise<IndexerBlock | null> { return this.blocks.find((b) => b.hash === hash) ?? null; }
  async getTransactionByHash(_hash: Hex): Promise<IndexerTransaction | null> { return null; }
  async getTransactionReceipt(_hash: Hex): Promise<IndexerReceipt | null> { return null; }
  async getLogs(filter: LogFilter420): Promise<IndexerLog[]> { return this.logsByBlock.get(filter.fromBlock) ?? []; }
  async call(): Promise<Hex> { return '0x'; }
  async getCode(): Promise<Hex> { return '0x'; }
}

class RecordingConsumer420 implements BlockConsumer420 {
  readonly seen: bigint[] = [];
  failOn: bigint | null = null;
  async applyBlock(batch: IndexedBlockBatch420): Promise<void> {
    if (this.failOn === batch.block.number) throw new Error(`consumer failed at ${batch.block.number}`);
    this.seen.push(batch.block.number);
  }
}

function chain420(count: number): IndexerBlock[] {
  const blocks: IndexerBlock[] = [];
  for (let i = 0; i < count; i += 1) {
    blocks.push({ number: BigInt(i), hash: h(i + 100), parentHash: i === 0 ? h(0) : h(i + 99), timestamp: BigInt(1000 + i) });
  }
  return blocks;
}

test('bounded ingestion resumes from the persisted checkpoint', async () => {
  const source = new FakeSource420(chain420(5));
  const checkpoints = new MemoryCheckpointStore420();
  const consumer = new RecordingConsumer420();
  const make = () => new IndexerIngestor420(source, checkpoints, consumer, {
    finality: { mode: 'head' },
    maxBlocksPerRun: 2
  });

  const first = await make().runOnce();
  assert.deepEqual(consumer.seen, [0n, 1n]);
  assert.equal(first.checkpoint?.blockNumber, 1n);

  const second = await make().runOnce();
  assert.deepEqual(consumer.seen, [0n, 1n, 2n, 3n]);
  assert.equal(second.checkpoint?.blockNumber, 3n);

  const third = await make().runOnce();
  assert.deepEqual(consumer.seen, [0n, 1n, 2n, 3n, 4n]);
  assert.equal(third.checkpoint?.blockNumber, 4n);
});

test('consumer failure does not advance the checkpoint past the failed block', async () => {
  const source = new FakeSource420(chain420(3));
  const checkpoints = new MemoryCheckpointStore420();
  const consumer = new RecordingConsumer420();
  consumer.failOn = 1n;
  const ingestor = new IndexerIngestor420(source, checkpoints, consumer, { finality: { mode: 'head' } });

  await assert.rejects(ingestor.runOnce(), /consumer failed at 1/);
  assert.equal((await checkpoints.load())?.blockNumber, 0n);

  consumer.failOn = null;
  await ingestor.runOnce();
  assert.deepEqual(consumer.seen, [0n, 1n, 2n]);
});

test('checkpoint continuation fails closed on a reorg', async () => {
  const blocks = chain420(3);
  blocks[2] = { ...blocks[2], parentHash: h(999) };
  const source = new FakeSource420(blocks);
  const checkpoints = new MemoryCheckpointStore420();
  await checkpoints.save({ chainId: 420n, blockNumber: 1n, blockHash: blocks[1].hash, parentHash: blocks[1].parentHash });
  const ingestor = new IndexerIngestor420(source, checkpoints, new RecordingConsumer420(), { finality: { mode: 'head' } });
  await assert.rejects(ingestor.runOnce(), /reorg detected at block 2/);
  assert.equal((await checkpoints.load())?.blockNumber, 1n);
});

test('file checkpoint store round-trips bigint fields atomically', async () => {
  const dir = await mkdtemp(join(tmpdir(), '420-indexer-'));
  try {
    const store = new FileCheckpointStore420(join(dir, 'state', 'checkpoint.json'));
    assert.equal(await store.load(), null);
    await store.save({ chainId: 420n, blockNumber: 123n, blockHash: h(123), parentHash: h(122) });
    assert.deepEqual(await store.load(), { chainId: 420n, blockNumber: 123n, blockHash: h(123), parentHash: h(122) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('finalized mode fails closed when the source lacks finalized block semantics', async () => {
  const ingestor = new IndexerIngestor420(
    new FakeSource420(chain420(1)),
    new MemoryCheckpointStore420(),
    new RecordingConsumer420(),
    { finality: { mode: 'finalized' } }
  );
  await assert.rejects(ingestor.runOnce(), /chain source does not expose finalized block semantics/);
});

class StubTransport420 implements JsonRpcTransport420 {
  readonly calls: Array<{ method: string; params: readonly unknown[] }> = [];
  constructor(readonly responses: Map<string, unknown>) {}
  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    this.calls.push({ method, params });
    return this.responses.get(method) as T;
  }
}

test('EVM JSON-RPC source converts canonical quantities and filters', async () => {
  const log = {
    address: h(1), blockHash: h(10), blockNumber: '0xa', transactionHash: h(11),
    transactionIndex: '0x2', logIndex: '0x1', topics: [h(12)], data: '0x', removed: false
  };
  const transport = new StubTransport420(new Map<string, unknown>([
    ['eth_chainId', '0x1a4'],
    ['eth_blockNumber', '0xa'],
    ['eth_getBlockByNumber', { number: '0xa', hash: h(10), parentHash: h(9), timestamp: '0x64' }],
    ['eth_getLogs', [log]]
  ]));
  const source = new EvmJsonRpcSource420(transport);

  assert.equal(await source.chainId(), 420n);
  assert.equal(await source.blockNumber(), 10n);
  assert.deepEqual(await source.getBlockByNumber(10n), { number: 10n, hash: h(10), parentHash: h(9), timestamp: 100n });
  const logs = await source.getLogs({ fromBlock: 10n, toBlock: 10n, addresses: [h(1)] });
  assert.equal(logs[0].transactionIndex, 2);
  assert.equal(logs[0].logIndex, 1);
  const getLogsCall = transport.calls.find((call) => call.method === 'eth_getLogs');
  assert.deepEqual(getLogsCall?.params, [{ fromBlock: '0xa', toBlock: '0xa', address: h(1) }]);
});
