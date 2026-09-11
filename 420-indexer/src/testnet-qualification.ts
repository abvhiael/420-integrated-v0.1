import { MemoryCheckpointStore420, type CheckpointStore420 } from './checkpoint-store.js';
import type { ChainSource420, Hex } from './chain-source.js';
import { IndexerIngestor420, type BlockConsumer420 } from './ingestor.js';
import { safeHead420, type FinalityPolicy420, type IndexCheckpoint420 } from './indexing.js';
import type { CanonicalHistoryStore420 } from './reorg.js';

export type TestnetFinalityMode420 = 'head' | 'confirmations' | 'finalized';

export interface TestnetQualificationConfig420 {
  chainId: string;
  rpcUrl: string;
  expectedGenesisHash: string;
  finalityMode: TestnetFinalityMode420;
  confirmations: number | null;
  sustainedBlocks: number;
  maxReorgDepth: number;
  restartReplayBlocks: number;
}

export interface TestnetQualificationEnvironment420 {
  IDX420_CHAIN_ID?: string;
  IDX420_RPC_URL?: string;
  IDX420_EXPECTED_GENESIS_HASH?: string;
  IDX420_FINALITY_MODE?: string;
  IDX420_CONFIRMATIONS?: string;
  IDX420_SUSTAINED_BLOCKS?: string;
  IDX420_MAX_REORG_DEPTH?: string;
  IDX420_RESTART_REPLAY_BLOCKS?: string;
}

export interface TestnetSmokeQualificationReport420 {
  chainId: bigint;
  sourceId: string;
  genesisHash: Hex;
  observedHead: bigint;
  observedSafeHead: bigint;
  firstBlock: bigint;
  lastBlock: bigint;
  processed: number;
  checkpointHash: Hex;
}

export interface TestnetRestartQualificationReport420 {
  sourceId: string;
  observedSafeHead: bigint;
  checkpointBefore: IndexCheckpoint420;
  replayGap: number;
  processed: number;
  checkpointAfter: IndexCheckpoint420;
  idempotentProcessed: number;
}

export interface TestnetReorgQualificationReport420 {
  sourceId: string;
  observedSafeHead: bigint;
  checkpointBefore: IndexCheckpoint420;
  recoveredReorgDepth: number;
  checkpointAfter: IndexCheckpoint420;
  replayedBlocks: number;
}

const DECIMAL = /^(0|[1-9][0-9]*)$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`missing required testnet qualification setting: ${name}`);
  return normalized;
}

function positiveInt(name: string, value: string | undefined): number {
  const raw = required(name, value);
  if (!DECIMAL.test(raw)) throw new Error(`${name} must be a base-10 integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive safe integer`);
  return parsed;
}

function nonNegativeInt(name: string, value: string | undefined): number {
  const raw = required(name, value);
  if (!DECIMAL.test(raw)) throw new Error(`${name} must be a base-10 integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return parsed;
}

function rpcUrl(value: string | undefined): string {
  const raw = required('IDX420_RPC_URL', value);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('IDX420_RPC_URL must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('IDX420_RPC_URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('IDX420_RPC_URL must not embed credentials; inject provider secrets separately');
  }
  return parsed.toString();
}

function finalityPolicy420(config: TestnetQualificationConfig420): FinalityPolicy420 {
  if (config.finalityMode === 'confirmations') {
    if (config.confirmations === null) throw new Error('testnet qualification confirmations are missing');
    return { mode: 'confirmations', confirmations: BigInt(config.confirmations) };
  }
  return { mode: config.finalityMode };
}

async function qualificationSafeHead420(
  source: ChainSource420,
  config: TestnetQualificationConfig420,
  observedHead: bigint,
): Promise<bigint> {
  if (config.finalityMode === 'finalized') {
    if (!source.finalizedBlockNumber) {
      throw new Error('testnet qualification source does not expose finalized block semantics');
    }
    return source.finalizedBlockNumber();
  }
  return safeHead420(observedHead, finalityPolicy420(config));
}

async function assertTestnetIdentity420(
  source: ChainSource420,
  config: TestnetQualificationConfig420,
): Promise<{ chainId: bigint; genesisHash: Hex }> {
  const expectedChainId = BigInt(config.chainId);
  const actualChainId = await source.chainId();
  if (actualChainId !== expectedChainId) {
    throw new Error(`testnet chain mismatch: expected ${expectedChainId}, got ${actualChainId}`);
  }

  const genesis = await source.getBlockByNumber(0n);
  if (!genesis || genesis.number !== 0n) throw new Error('testnet source returned no canonical genesis block');
  if (genesis.hash.toLowerCase() !== config.expectedGenesisHash.toLowerCase()) {
    throw new Error(`testnet genesis mismatch: expected ${config.expectedGenesisHash}, got ${genesis.hash}`);
  }
  return { chainId: actualChainId, genesisHash: genesis.hash };
}

export function parseTestnetQualificationConfig420(
  env: TestnetQualificationEnvironment420,
): TestnetQualificationConfig420 {
  const chainId = required('IDX420_CHAIN_ID', env.IDX420_CHAIN_ID);
  if (!DECIMAL.test(chainId) || BigInt(chainId) <= 0n) {
    throw new Error('IDX420_CHAIN_ID must be a positive base-10 integer');
  }

  const expectedGenesisHash = required('IDX420_EXPECTED_GENESIS_HASH', env.IDX420_EXPECTED_GENESIS_HASH);
  if (!HASH32.test(expectedGenesisHash)) {
    throw new Error('IDX420_EXPECTED_GENESIS_HASH must be a 32-byte 0x-prefixed hash');
  }

  const finalityMode = required('IDX420_FINALITY_MODE', env.IDX420_FINALITY_MODE) as TestnetFinalityMode420;
  if (!['head', 'confirmations', 'finalized'].includes(finalityMode)) {
    throw new Error('IDX420_FINALITY_MODE must be head, confirmations, or finalized');
  }

  const confirmations = finalityMode === 'confirmations'
    ? positiveInt('IDX420_CONFIRMATIONS', env.IDX420_CONFIRMATIONS)
    : null;

  if (finalityMode !== 'confirmations' && env.IDX420_CONFIRMATIONS?.trim()) {
    throw new Error('IDX420_CONFIRMATIONS is only valid when IDX420_FINALITY_MODE=confirmations');
  }

  const maxReorgDepth = positiveInt('IDX420_MAX_REORG_DEPTH', env.IDX420_MAX_REORG_DEPTH);
  const restartReplayBlocks = nonNegativeInt('IDX420_RESTART_REPLAY_BLOCKS', env.IDX420_RESTART_REPLAY_BLOCKS);
  if (restartReplayBlocks > maxReorgDepth) {
    throw new Error('IDX420_RESTART_REPLAY_BLOCKS must not exceed IDX420_MAX_REORG_DEPTH');
  }

  return {
    chainId,
    rpcUrl: rpcUrl(env.IDX420_RPC_URL),
    expectedGenesisHash: expectedGenesisHash.toLowerCase(),
    finalityMode,
    confirmations,
    sustainedBlocks: positiveInt('IDX420_SUSTAINED_BLOCKS', env.IDX420_SUSTAINED_BLOCKS),
    maxReorgDepth,
    restartReplayBlocks,
  };
}

export async function runTestnetSmokeQualification420(
  source: ChainSource420,
  consumer: BlockConsumer420,
  config: TestnetQualificationConfig420,
): Promise<TestnetSmokeQualificationReport420> {
  const identity = await assertTestnetIdentity420(source, config);
  const observedHead = await source.blockNumber();
  const observedSafeHead = await qualificationSafeHead420(source, config, observedHead);
  const requiredWindow = BigInt(config.sustainedBlocks);
  if (observedSafeHead + 1n < requiredWindow) {
    throw new Error(`testnet has only ${observedSafeHead + 1n} safe blocks; ${requiredWindow} required for smoke qualification`);
  }

  const firstBlock = observedSafeHead - requiredWindow + 1n;
  const checkpoints = new MemoryCheckpointStore420();
  const ingestor = new IndexerIngestor420(
    source,
    checkpoints,
    consumer,
    {
      finality: finalityPolicy420(config),
      startBlock: firstBlock,
      maxBlocksPerRun: config.sustainedBlocks,
      maxReorgDepth: config.maxReorgDepth,
    },
  );

  const run = await ingestor.runOnce();
  if (run.processed !== config.sustainedBlocks) {
    throw new Error(`testnet smoke qualification processed ${run.processed} blocks; expected ${config.sustainedBlocks}`);
  }
  if (run.firstBlock !== firstBlock || run.lastBlock !== observedSafeHead) {
    throw new Error(`testnet smoke qualification window changed unexpectedly: expected ${firstBlock}-${observedSafeHead}, got ${run.firstBlock}-${run.lastBlock}`);
  }
  if (!run.checkpoint || run.checkpoint.blockNumber !== observedSafeHead) {
    throw new Error('testnet smoke qualification did not advance checkpoint through the observed safe head');
  }

  return {
    chainId: identity.chainId,
    sourceId: source.sourceId,
    genesisHash: identity.genesisHash,
    observedHead,
    observedSafeHead,
    firstBlock,
    lastBlock: observedSafeHead,
    processed: run.processed,
    checkpointHash: run.checkpoint.blockHash,
  };
}

export async function runTestnetRestartQualification420(
  source: ChainSource420,
  consumer: BlockConsumer420,
  checkpoints: CheckpointStore420,
  history: CanonicalHistoryStore420,
  config: TestnetQualificationConfig420,
): Promise<TestnetRestartQualificationReport420> {
  await assertTestnetIdentity420(source, config);
  const checkpointBefore = await checkpoints.load();
  if (!checkpointBefore) throw new Error('IDX-10.3 restart qualification requires an existing durable checkpoint');
  if (checkpointBefore.chainId !== BigInt(config.chainId)) {
    throw new Error(`IDX-10.3 checkpoint chain mismatch: expected ${config.chainId}, got ${checkpointBefore.chainId}`);
  }

  const observedHead = await source.blockNumber();
  const observedSafeHead = await qualificationSafeHead420(source, config, observedHead);
  if (checkpointBefore.blockNumber > observedSafeHead) {
    throw new Error(`IDX-10.3 checkpoint ${checkpointBefore.blockNumber} is ahead of safe head ${observedSafeHead}`);
  }
  const gap = observedSafeHead - checkpointBefore.blockNumber;
  if (gap > BigInt(config.restartReplayBlocks)) {
    throw new Error(`IDX-10.3 restart replay gap ${gap} exceeds configured window ${config.restartReplayBlocks}`);
  }

  const ingestor = new IndexerIngestor420(
    source,
    checkpoints,
    consumer,
    {
      finality: finalityPolicy420(config),
      maxBlocksPerRun: Math.max(1, config.restartReplayBlocks),
      maxReorgDepth: config.maxReorgDepth,
    },
    history,
  );
  const resumed = await ingestor.runOnce();
  const checkpointAfter = await checkpoints.load();
  if (!checkpointAfter || checkpointAfter.blockNumber !== observedSafeHead) {
    throw new Error('IDX-10.3 restart qualification did not recover through the observed safe head');
  }

  const idempotent = await ingestor.runOnce();
  if (idempotent.processed !== 0 || idempotent.checkpoint?.blockNumber !== checkpointAfter.blockNumber || idempotent.checkpoint.blockHash.toLowerCase() !== checkpointAfter.blockHash.toLowerCase()) {
    throw new Error('IDX-10.3 repeated restart was not idempotent at the same safe head');
  }

  return {
    sourceId: source.sourceId,
    observedSafeHead,
    checkpointBefore,
    replayGap: Number(gap),
    processed: resumed.processed,
    checkpointAfter,
    idempotentProcessed: idempotent.processed,
  };
}

export async function runTestnetReorgQualification420(
  source: ChainSource420,
  consumer: BlockConsumer420,
  checkpoints: CheckpointStore420,
  history: CanonicalHistoryStore420,
  config: TestnetQualificationConfig420,
): Promise<TestnetReorgQualificationReport420> {
  await assertTestnetIdentity420(source, config);
  const checkpointBefore = await checkpoints.load();
  if (!checkpointBefore) throw new Error('IDX-10.3 reorg qualification requires an existing durable checkpoint');

  const observedHead = await source.blockNumber();
  const observedSafeHead = await qualificationSafeHead420(source, config, observedHead);
  const ingestor = new IndexerIngestor420(
    source,
    checkpoints,
    consumer,
    {
      finality: finalityPolicy420(config),
      maxBlocksPerRun: Math.max(1, config.maxReorgDepth + config.restartReplayBlocks + 1),
      maxReorgDepth: config.maxReorgDepth,
    },
    history,
  );

  const recovered = await ingestor.runOnce();
  if (recovered.recoveredReorgDepth <= 0) {
    throw new Error('IDX-10.3 reorg qualification did not observe a canonical reorg');
  }
  const checkpointAfter = await checkpoints.load();
  if (!checkpointAfter || checkpointAfter.blockNumber !== observedSafeHead) {
    throw new Error('IDX-10.3 reorg qualification did not replay through the observed safe head');
  }

  return {
    sourceId: source.sourceId,
    observedSafeHead,
    checkpointBefore,
    recoveredReorgDepth: recovered.recoveredReorgDepth,
    checkpointAfter,
    replayedBlocks: recovered.processed,
  };
}
