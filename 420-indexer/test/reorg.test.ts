import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChainSource420, Hex, IndexerBlock } from '../src/chain-source.js';
import { MemoryCheckpointStore420 } from '../src/checkpoint-store.js';
import { checkpointFromBlock420 } from '../src/indexing.js';
import { IndexerIngestor420 } from '../src/ingestor.js';
import { EvmJsonRpcSource420, type JsonRpcTransport420 } from '../src/rpc-source.js';
import { MemoryCanonicalHistoryStore420, recoverCanonicalAncestry420 } from '../src/reorg.js';

const hash = (value: number): Hex => `0x${value.toString(16).padStart(64, '0')}`;
const block = (number: number, id = number, parentId = number - 1): IndexerBlock => ({
  number: BigInt(number),
  hash: hash(id),
  parentHash: hash(parentId),
  timestamp: BigInt(1_700_000_000 + number)
});

function source(blocks: Map<bigint, IndexerBlock>, head = 10n): ChainSource420 {
  return {
    sourceId: 'test',
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

test('recovers to the nearest canonical ancestor and trims local history', async () => {
  const local5 = checkpointFromBlock420(420n, block(5));
  const local6 = checkpointFromBlock420(420n, block(6));
  const local7 = checkpointFromBlock420(420n, block(7));
  const history = new MemoryCanonicalHistoryStore420();
  await history.save(local5);
  await history.save(local6);
  await history.save(local7);
  const checkpoints = new MemoryCheckpointStore420();
  await checkpoints.save(local7);

  const canonical = new Map<bigint, IndexerBlock>([
    [5n, block(5)],
    [6n, block(6, 600, 5)],
    [7n, block(7, 700, 600)]
  ]);
  const rollbacks: Array<bigint | null> = [];
  const result = await recoverCanonicalAncestry420(
    source(canonical), checkpoints, history,
    { async rollbackTo(number) { rollbacks.push(number); } },
    local7, 8
  );

  assert.equal(result.detected, true);
  assert.equal(result.depth, 2);
  assert.equal(result.ancestor?.blockNumber, 5n);
  assert.deepEqual(rollbacks, [5n]);
  assert.equal((await checkpoints.load())?.blockHash, local5.blockHash);
  assert.equal(await history.load(6n), null);
});

test('fails closed when a reorg exceeds configured depth', async () => {
  const history = new MemoryCanonicalHistoryStore420();
  const checkpoints = new MemoryCheckpointStore420();
  for (let n = 5; n <= 10; n += 1) await history.save(checkpointFromBlock420(420n, block(n)));
  const current = checkpointFromBlock420(420n, block(10));
  await checkpoints.save(current);
  const canonical = new Map<bigint, IndexerBlock>();
  for (let n = 7; n <= 10; n += 1) canonical.set(BigInt(n), block(n, n + 1000, n + 999));

  await assert.rejects(
    recoverCanonicalAncestry420(source(canonical), checkpoints, history, { async rollbackTo() {} }, current, 3),
    /reorg exceeds configured max depth 3/
  );
  assert.equal((await checkpoints.load())?.blockNumber, 10n);
});

test('EVM JSON-RPC source resolves the finalized block tag', async () => {
  const calls: Array<{ method: string; params: readonly unknown[] }> = [];
  const transport: JsonRpcTransport420 = {
    async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
      calls.push({ method, params });
      return { number: '0x9', hash: hash(9), parentHash: hash(8), timestamp: '0x1' } as T;
    }
  };
  const rpc = new EvmJsonRpcSource420(transport);
  assert.equal(await rpc.finalizedBlockNumber(), 9n);
  assert.deepEqual(calls[0], { method: 'eth_getBlockByNumber', params: ['finalized', false] });
});

test('ingestor honors source finalized head semantics', async () => {
  const blocks = new Map<bigint, IndexerBlock>([[0n, block(0, 0, 0)], [1n, block(1)]]);
  const s = source(blocks, 20n);
  s.finalizedBlockNumber = async () => 1n;
  const applied: bigint[] = [];
  const ingestor = new IndexerIngestor420(
    s,
    new MemoryCheckpointStore420(),
    { async applyBlock(batch) { applied.push(batch.block.number); }, async rollbackTo() {} },
    { finality: { mode: 'finalized' }, maxBlocksPerRun: 10 }
  );
  const run = await ingestor.runOnce();
  assert.equal(run.safeHead, 1n);
  assert.deepEqual(applied, [0n, 1n]);
});
