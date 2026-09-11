import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hex } from '../src/chain-source.js';
import { buildTestnetCloseoutReport420 } from '../src/testnet-closeout.js';
import type {
  TestnetQualificationConfig420,
  TestnetReorgQualificationReport420,
  TestnetRestartQualificationReport420,
  TestnetSmokeQualificationReport420,
} from '../src/testnet-qualification.js';
import type { TestnetConsumerQualificationReport420 } from '../src/testnet-consumer-qualification.js';

const GENESIS = `0x${'ab'.repeat(32)}` as Hex;
const H2 = `0x${'02'.repeat(32)}` as Hex;
const H3 = `0x${'03'.repeat(32)}` as Hex;
const H4 = `0x${'04'.repeat(32)}` as Hex;
const H5 = `0x${'05'.repeat(32)}` as Hex;

const config: TestnetQualificationConfig420 = {
  chainId: '420420',
  rpcUrl: 'https://rpc.testnet.420.example/path',
  expectedGenesisHash: GENESIS,
  finalityMode: 'confirmations',
  confirmations: 2,
  sustainedBlocks: 3,
  maxReorgDepth: 4,
  restartReplayBlocks: 2,
};

const smoke: TestnetSmokeQualificationReport420 = {
  chainId: 420420n,
  sourceId: 'live-rpc',
  genesisHash: GENESIS,
  observedHead: 7n,
  observedSafeHead: 5n,
  firstBlock: 3n,
  lastBlock: 5n,
  processed: 3,
  checkpointHash: H5,
};

const restart: TestnetRestartQualificationReport420 = {
  sourceId: 'live-rpc',
  observedSafeHead: 5n,
  checkpointBefore: { chainId: 420420n, blockNumber: 3n, blockHash: H3, parentHash: H2 },
  replayGap: 2,
  processed: 2,
  checkpointAfter: { chainId: 420420n, blockNumber: 5n, blockHash: H5, parentHash: H4 },
  idempotentProcessed: 0,
};

const reorg: TestnetReorgQualificationReport420 = {
  sourceId: 'live-rpc',
  observedSafeHead: 5n,
  checkpointBefore: { chainId: 420420n, blockNumber: 5n, blockHash: H5, parentHash: H4 },
  recoveredReorgDepth: 2,
  checkpointAfter: { chainId: 420420n, blockNumber: 5n, blockHash: H5, parentHash: H4 },
  replayedBlocks: 2,
};

const consumer: TestnetConsumerQualificationReport420 = {
  chainId: '420420',
  indexedHead: '5',
  blockNumber: '5',
  transactionHash: `0x${'11'.repeat(32)}`,
  address: `0x${'22'.repeat(20)}`,
  logCount: 1,
  assetTransferCount: 1,
  protocolEventCount: 1,
  streamEventCount: 1,
  searchResultCount: 1,
};

function deployment(overrides: Partial<Parameters<typeof buildTestnetCloseoutReport420>[0]['deployment']> = {}) {
  return {
    indexerRevision: 'idx-sha-123',
    nodeRevision: 'node-sha-456',
    liveSmokeQualified: true,
    liveRestartQualified: true,
    liveReorgQualified: true,
    liveConsumerQualified: true,
    descriptorManifestQualified: true,
    descriptorManifestDigest: 'sha256:manifest',
    compiledArtifactsDigest: 'sha256:artifacts',
    operator: 'test-operator',
    ...overrides,
  };
}

test('IDX-10.5 emits GO only when all live and artifact-backed evidence is present', () => {
  const report = buildTestnetCloseoutReport420({ config, smoke, restart, reorg, consumer, deployment: deployment() });
  assert.equal(report.decision, 'go');
  assert.deepEqual(report.blockers, []);
  assert.equal(report.phase, 'IDX-10.5');
  assert.equal(report.rpcOrigin, 'https://rpc.testnet.420.example');
  assert.equal(report.authoritative, false);
  assert.deepEqual(report.sustainedWindow, { firstBlock: '3', lastBlock: '5', processed: 3 });
  assert.equal(report.descriptors.qualified, true);
});

test('IDX-10.5 fails closed when deployment-time evidence is absent', () => {
  const report = buildTestnetCloseoutReport420({
    config,
    smoke,
    restart,
    reorg,
    consumer,
    deployment: deployment({
      liveSmokeQualified: false,
      liveConsumerQualified: false,
      descriptorManifestQualified: false,
      descriptorManifestDigest: undefined,
      compiledArtifactsDigest: undefined,
    }),
  });
  assert.equal(report.decision, 'no-go');
  assert.match(report.blockers.join('\n'), /live testnet smoke evidence is missing/);
  assert.match(report.blockers.join('\n'), /live API\/consumer evidence is missing/);
  assert.match(report.blockers.join('\n'), /compiled genesis descriptor\/artifact qualification is missing/);
});

test('IDX-10.5 rejects internally inconsistent phase evidence', () => {
  const badRestart: TestnetRestartQualificationReport420 = {
    ...restart,
    observedSafeHead: 6n,
    checkpointAfter: { ...restart.checkpointAfter, blockNumber: 4n },
    idempotentProcessed: 1,
  };
  const report = buildTestnetCloseoutReport420({ config, smoke, restart: badRestart, reorg, consumer, deployment: deployment() });
  assert.equal(report.decision, 'no-go');
  assert.match(report.blockers.join('\n'), /restart safe head does not match smoke safe head/);
  assert.match(report.blockers.join('\n'), /restart checkpoint did not reach observed safe head/);
  assert.match(report.blockers.join('\n'), /restart idempotence qualification processed additional blocks/);
});

test('IDX-10.5 requires descriptor and compiled-artifact digests when qualification is claimed', () => {
  const report = buildTestnetCloseoutReport420({
    config,
    smoke,
    restart,
    reorg,
    consumer,
    deployment: deployment({ descriptorManifestDigest: ' ', compiledArtifactsDigest: undefined }),
  });
  assert.equal(report.decision, 'no-go');
  assert.match(report.blockers.join('\n'), /qualified descriptor manifest digest is missing/);
  assert.match(report.blockers.join('\n'), /qualified compiled-artifacts digest is missing/);
});
