import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesIndexerRuntime, MemoryProjectionStore, validateIndexerDeploymentConfig, verifyDeterministicRebuild } from '../src/operationsRuntime.js';
import { BongGogglesProjector } from '../src/projector.js';

const ADDR = (n) => `0x${String(n).padStart(40, '0')}`;
const config = {
  chainId: 420,
  schemaHash: '0xsearch-schema-v1',
  startBlock: 10,
  confirmations: 1,
  reorgWindow: 16,
  maxBlockSpan: 2,
  staleAfterBlocks: 3,
  contracts: {
    profileRegistry: ADDR(1), relationshipGraph: ADDR(2), socialObjectRegistry: ADDR(3),
    communityRegistry: ADDR(4), discoveryRegistry: ADDR(5), searchIndexSurface: ADDR(6),
  },
};

function providerFixture() {
  const blocks = new Map();
  for (let i = 0; i <= 20; i += 1) blocks.set(i, { number:i, hash:`0xb${i}` });
  const logs = [
    { blockNumber:10, blockHash:'0xb10', transactionIndex:0, transactionHash:'0xtx10', logIndex:0, eventName:'Followed', args:{ follower:'0xA', subject:'0xB' } },
    { blockNumber:11, blockHash:'0xb11', transactionIndex:0, transactionHash:'0xtx11', logIndex:0, eventName:'Unfollowed', args:{ follower:'0xA', subject:'0xB' } },
    { blockNumber:12, blockHash:'0xb12', transactionIndex:0, transactionHash:'0xtx12', logIndex:0, eventName:'Followed', args:{ follower:'0xA', subject:'0xC' } },
  ];
  return {
    blocks, logs, head:13,
    async getBlockNumber() { return this.head; },
    async getBlock(number) { return this.blocks.get(number) ?? null; },
    async getLogs({ fromBlock, toBlock }) { return this.logs.filter((x)=>x.blockNumber>=fromBlock && x.blockNumber<=toBlock); },
  };
}

const decodeLog = async (log) => ({ eventName:log.eventName, args:log.args });
const hydrateState = async () => ({});

test('deployment config validates required non-zero canonical contract addresses', () => {
  const normalized = validateIndexerDeploymentConfig(config);
  assert.equal(normalized.chainId, 420);
  assert.equal(normalized.contracts.profileRegistry, ADDR(1));
  assert.throws(()=>validateIndexerDeploymentConfig({ ...config, contracts:{ ...config.contracts, profileRegistry:'0x0000000000000000000000000000000000000000' } }), /contracts.profileRegistry/);
});

test('runtime ingests confirmed RPC log ranges, persists and reports ready health', async () => {
  const provider = providerFixture();
  const store = new MemoryProjectionStore();
  const records = [];
  const runtime = new BongGogglesIndexerRuntime({ config, provider, decodeLog, hydrateState, store, logger:(record)=>records.push(record), now:()=>1000 });
  const result = await runtime.syncOnce();
  assert.equal(result.applied, 3);
  assert.equal(result.indexedBlock, 12);
  assert.equal(result.safeHead, 12);
  assert.equal(result.status, 'ready');
  assert.equal(result.authoritative, false);
  assert.equal(records.filter((x)=>x.event==='range_indexed').length, 2);
  assert.equal(store.load({ schemaHash:config.schemaHash, chainId:config.chainId }).snapshot().stateRoot, runtime.projector.snapshot().stateRoot);
});

test('restart resumes after persisted checkpoint without replay duplication', async () => {
  const provider = providerFixture();
  const store = new MemoryProjectionStore();
  const first = new BongGogglesIndexerRuntime({ config, provider, decodeLog, hydrateState, store });
  await first.syncOnce();
  const root = first.projector.snapshot().stateRoot;
  provider.head = 14;
  provider.logs.push({ blockNumber:13, blockHash:'0xb13', transactionIndex:0, transactionHash:'0xtx13', logIndex:0, eventName:'Followed', args:{ follower:'0xD', subject:'0xE' } });
  const second = new BongGogglesIndexerRuntime({ config, provider, decodeLog, hydrateState, store });
  assert.equal(second.projector.snapshot().stateRoot, root);
  const result = await second.syncOnce();
  assert.equal(result.applied, 1);
  assert.equal(second.projector.snapshot().eventCount, 4);
});

test('runtime detects a head reorg, rolls back within configured window and reindexes canonical replacement', async () => {
  const provider = providerFixture();
  const store = new MemoryProjectionStore();
  const runtime = new BongGogglesIndexerRuntime({ config, provider, decodeLog, hydrateState, store });
  await runtime.syncOnce();
  provider.blocks.set(12, { number:12, hash:'0xb12-new' });
  provider.logs = provider.logs.filter((x)=>x.blockNumber!==12);
  provider.logs.push({ blockNumber:12, blockHash:'0xb12-new', transactionIndex:0, transactionHash:'0xtx12-new', logIndex:0, eventName:'Followed', args:{ follower:'0xF', subject:'0xG' } });
  const result = await runtime.syncOnce();
  assert.equal(result.reorgCount, 1);
  assert.equal(runtime.projector.snapshot().indexedBlockHash, '0xb12-new');
  assert.equal(runtime.projector.exportState().some((x)=>x.entityId==='FOLLOW:0xf:0xg'), true);
});

test('runtime fails closed when a reorg exceeds configured rollback window', async () => {
  const provider = providerFixture();
  const store = new MemoryProjectionStore();
  const narrow = { ...config, reorgWindow:1 };
  const runtime = new BongGogglesIndexerRuntime({ config:narrow, provider, decodeLog, hydrateState, store });
  await runtime.syncOnce();
  provider.blocks.set(12, { number:12, hash:'0xother12' });
  provider.blocks.set(11, { number:11, hash:'0xother11' });
  await assert.rejects(()=>runtime.syncOnce(), /reorg exceeds configured window/);
  assert.equal(runtime.health().status, 'degraded');
});

test('health exposes lag and stale state without claiming authority', () => {
  const provider = providerFixture();
  const runtime = new BongGogglesIndexerRuntime({ config, provider, decodeLog, hydrateState, store:new MemoryProjectionStore() });
  runtime.lastObservedHead = 20;
  const health = runtime.health();
  assert.equal(health.status, 'stale');
  assert.equal(health.authoritative, false);
  assert.equal(health.lagBlocks, 19);
});

test('deterministic rebuild verification matches state root and event count', () => {
  const projector = new BongGogglesProjector({ schemaHash:config.schemaHash, chainId:config.chainId });
  projector.applyBatch([{ chainId:420, blockNumber:10, blockHash:'0xb10', transactionIndex:0, transactionHash:'0xtx', logIndex:0, eventName:'noop', mutations:[] }]);
  const result = verifyDeterministicRebuild(projector);
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.stateRoot, projector.snapshot().stateRoot);
});
