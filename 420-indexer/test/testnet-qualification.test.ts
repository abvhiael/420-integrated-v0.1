import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog, IndexerReceipt, IndexerTransaction, LogFilter420 } from '../src/chain-source.js';
import type { BlockConsumer420, IndexedBlockBatch420 } from '../src/ingestor.js';
import { parseTestnetQualificationConfig420, runTestnetSmokeQualification420 } from '../src/testnet-qualification.js';

const GENESIS_HASH = `0x${'ab'.repeat(32)}` as Hex;
const base = {
  IDX420_CHAIN_ID: '420420',
  IDX420_RPC_URL: 'https://rpc.testnet.420.example/',
  IDX420_EXPECTED_GENESIS_HASH: GENESIS_HASH,
  IDX420_FINALITY_MODE: 'confirmations',
  IDX420_CONFIRMATIONS: '2',
  IDX420_SUSTAINED_BLOCKS: '3',
  IDX420_MAX_REORG_DEPTH: '64',
  IDX420_RESTART_REPLAY_BLOCKS: '16',
};

function hash420(value: number): Hex {
  return `0x${value.toString(16).padStart(64, '0')}` as Hex;
}

class SmokeSource420 implements ChainSource420 {
  readonly sourceId = 'testnet-smoke-source';
  readonly blocks = new Map<bigint, IndexerBlock>();

  constructor(readonly id = 420420n, readonly head = 5n, genesisHash: Hex = GENESIS_HASH) {
    let parentHash = hash420(999);
    for (let number = 0n; number <= head; number += 1n) {
      const hash = number === 0n ? genesisHash : hash420(Number(number));
      this.blocks.set(number, { number, hash, parentHash, timestamp: 1_700_000_000n + number });
      parentHash = hash;
    }
  }

  async chainId(): Promise<bigint> { return this.id; }
  async blockNumber(): Promise<bigint> { return this.head; }
  async finalizedBlockNumber(): Promise<bigint> { return this.head - 1n; }
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

function withoutFinalized420(source: SmokeSource420): ChainSource420 {
  return {
    sourceId: source.sourceId,
    chainId: source.chainId.bind(source),
    blockNumber: source.blockNumber.bind(source),
    getBlockByNumber: source.getBlockByNumber.bind(source),
    getBlockByHash: source.getBlockByHash.bind(source),
    getBlockTransactionsByNumber: source.getBlockTransactionsByNumber.bind(source),
    getTransactionByHash: source.getTransactionByHash.bind(source),
    getTransactionReceipt: source.getTransactionReceipt.bind(source),
    getLogs: source.getLogs.bind(source),
    call: source.call.bind(source),
    getCode: source.getCode.bind(source),
  };
}

class RecordingConsumer420 implements BlockConsumer420 {
  readonly batches: IndexedBlockBatch420[] = [];
  async applyBlock(batch: IndexedBlockBatch420): Promise<void> { this.batches.push(batch); }
}

test('parses an explicit testnet qualification environment', () => {
  assert.deepEqual(parseTestnetQualificationConfig420(base), {
    chainId: '420420',
    rpcUrl: 'https://rpc.testnet.420.example/',
    expectedGenesisHash: GENESIS_HASH,
    finalityMode: 'confirmations',
    confirmations: 2,
    sustainedBlocks: 3,
    maxReorgDepth: 64,
    restartReplayBlocks: 16,
  });
});

test('fails closed when chain identity is missing or malformed', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CHAIN_ID: undefined }), /missing required/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CHAIN_ID: '0x420' }), /positive base-10 integer/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_EXPECTED_GENESIS_HASH: '0x1234' }), /32-byte/);
});

test('rejects unsafe RPC URL forms and embedded credentials', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_RPC_URL: 'ws://localhost:8545' }), /http or https/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_RPC_URL: 'https://user:pass@example.test' }), /must not embed credentials/);
});

test('enforces finality-specific confirmation settings', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CONFIRMATIONS: undefined }), /IDX420_CONFIRMATIONS/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_FINALITY_MODE: 'head' }), /only valid/);

  const head = parseTestnetQualificationConfig420({
    ...base,
    IDX420_FINALITY_MODE: 'head',
    IDX420_CONFIRMATIONS: undefined,
  });
  assert.equal(head.confirmations, null);
});

test('requires bounded replay to remain inside the reorg qualification window', () => {
  assert.throws(
    () => parseTestnetQualificationConfig420({ ...base, IDX420_MAX_REORG_DEPTH: '8', IDX420_RESTART_REPLAY_BLOCKS: '9' }),
    /must not exceed/,
  );
});

test('IDX-10.2 validates chain/genesis identity and indexes the sustained safe-head window', async () => {
  const config = parseTestnetQualificationConfig420(base);
  const source = new SmokeSource420();
  const consumer = new RecordingConsumer420();

  const report = await runTestnetSmokeQualification420(source, consumer, config);

  assert.equal(report.chainId, 420420n);
  assert.equal(report.observedHead, 5n);
  assert.equal(report.observedSafeHead, 3n);
  assert.equal(report.firstBlock, 1n);
  assert.equal(report.lastBlock, 3n);
  assert.equal(report.processed, 3);
  assert.equal(report.genesisHash, GENESIS_HASH);
  assert.equal(report.checkpointHash, hash420(3));
  assert.deepEqual(consumer.batches.map((batch) => batch.block.number), [1n, 2n, 3n]);
});

test('IDX-10.2 fails closed on wrong chain or genesis identity before indexing', async () => {
  const config = parseTestnetQualificationConfig420(base);

  await assert.rejects(
    () => runTestnetSmokeQualification420(new SmokeSource420(1n), new RecordingConsumer420(), config),
    /testnet chain mismatch/,
  );
  await assert.rejects(
    () => runTestnetSmokeQualification420(new SmokeSource420(420420n, 5n, hash420(777)), new RecordingConsumer420(), config),
    /testnet genesis mismatch/,
  );
});

test('IDX-10.2 refuses to claim qualification before the sustained safe-block window exists', async () => {
  const config = parseTestnetQualificationConfig420({ ...base, IDX420_SUSTAINED_BLOCKS: '5' });
  await assert.rejects(
    () => runTestnetSmokeQualification420(new SmokeSource420(420420n, 3n), new RecordingConsumer420(), config),
    /safe blocks.*required/,
  );
});

test('IDX-10.2 honors finalized finality and requires source support for it', async () => {
  const config = parseTestnetQualificationConfig420({
    ...base,
    IDX420_FINALITY_MODE: 'finalized',
    IDX420_CONFIRMATIONS: undefined,
    IDX420_SUSTAINED_BLOCKS: '2',
  });
  const source = new SmokeSource420(420420n, 5n);
  const report = await runTestnetSmokeQualification420(source, new RecordingConsumer420(), config);
  assert.equal(report.observedSafeHead, 4n);
  assert.equal(report.firstBlock, 3n);
  assert.equal(report.lastBlock, 4n);

  await assert.rejects(
    () => runTestnetSmokeQualification420(withoutFinalized420(source), new RecordingConsumer420(), config),
    /does not expose finalized block semantics/,
  );
});
