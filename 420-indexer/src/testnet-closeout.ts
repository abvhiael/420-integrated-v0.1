import type {
  TestnetQualificationConfig420,
  TestnetReorgQualificationReport420,
  TestnetRestartQualificationReport420,
  TestnetSmokeQualificationReport420,
} from './testnet-qualification.js';
import type { TestnetConsumerQualificationReport420 } from './testnet-consumer-qualification.js';

export type TestnetCloseoutDecision420 = 'go' | 'no-go';

export interface TestnetDeploymentEvidence420 {
  indexerRevision: string;
  nodeRevision: string;
  liveSmokeQualified: boolean;
  liveRestartQualified: boolean;
  liveReorgQualified: boolean;
  liveConsumerQualified: boolean;
  descriptorManifestQualified: boolean;
  descriptorManifestDigest?: string;
  compiledArtifactsDigest?: string;
  operator?: string;
  notes?: string[];
}

export interface TestnetCloseoutInput420 {
  config: TestnetQualificationConfig420;
  smoke: TestnetSmokeQualificationReport420;
  restart: TestnetRestartQualificationReport420;
  reorg: TestnetReorgQualificationReport420;
  consumer: TestnetConsumerQualificationReport420;
  deployment: TestnetDeploymentEvidence420;
}

export interface TestnetCloseoutReport420 {
  phase: 'IDX-10.5';
  decision: TestnetCloseoutDecision420;
  blockers: string[];
  chainId: string;
  genesisHash: string;
  rpcOrigin: string;
  finalityMode: TestnetQualificationConfig420['finalityMode'];
  confirmations: number | null;
  sustainedWindow: { firstBlock: string; lastBlock: string; processed: number };
  restart: { checkpointBefore: string; checkpointAfter: string; replayGap: number; idempotentProcessed: number };
  reorg: { recoveredDepth: number; replayedBlocks: number; checkpointAfter: string };
  consumer: { indexedHead: string; witnessBlock: string; streamEvents: number; searchResults: number };
  revisions: { indexer: string; node: string };
  descriptors: { qualified: boolean; manifestDigest: string | null; artifactsDigest: string | null };
  operator: string | null;
  notes: string[];
  authoritative: false;
}

function nonEmpty420(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function rpcOrigin420(value: string): string {
  const parsed = new URL(value);
  return parsed.origin;
}

export function buildTestnetCloseoutReport420(input: TestnetCloseoutInput420): TestnetCloseoutReport420 {
  const blockers: string[] = [];
  const expectedChainId = input.config.chainId;

  if (input.smoke.chainId.toString() !== expectedChainId) blockers.push('smoke report chain ID does not match qualification config');
  if (input.consumer.chainId !== expectedChainId) blockers.push('consumer report chain ID does not match qualification config');
  if (input.smoke.genesisHash.toLowerCase() !== input.config.expectedGenesisHash.toLowerCase()) blockers.push('smoke report genesis hash does not match qualification config');
  if (input.restart.observedSafeHead !== input.smoke.observedSafeHead) blockers.push('restart safe head does not match smoke safe head');
  if (input.reorg.observedSafeHead !== input.smoke.observedSafeHead) blockers.push('reorg safe head does not match smoke safe head');
  if (input.restart.checkpointAfter.blockNumber !== input.restart.observedSafeHead) blockers.push('restart checkpoint did not reach observed safe head');
  if (input.restart.idempotentProcessed !== 0) blockers.push('restart idempotence qualification processed additional blocks');
  if (input.reorg.recoveredReorgDepth <= 0 || input.reorg.replayedBlocks <= 0) blockers.push('bounded reorg qualification did not recover and replay a canonical branch');
  if (input.reorg.checkpointAfter.blockNumber !== input.reorg.observedSafeHead) blockers.push('reorg checkpoint did not return to observed safe head');
  if (BigInt(input.consumer.indexedHead) < BigInt(input.consumer.blockNumber)) blockers.push('consumer indexed head is behind its witness block');

  if (!nonEmpty420(input.deployment.indexerRevision)) blockers.push('exact 420Indexer revision is missing');
  if (!nonEmpty420(input.deployment.nodeRevision)) blockers.push('exact node/client revision is missing');
  if (!input.deployment.liveSmokeQualified) blockers.push('live testnet smoke evidence is missing');
  if (!input.deployment.liveRestartQualified) blockers.push('live restart/replay evidence is missing');
  if (!input.deployment.liveReorgQualified) blockers.push('live bounded-reorg evidence is missing');
  if (!input.deployment.liveConsumerQualified) blockers.push('live API/consumer evidence is missing');
  if (!input.deployment.descriptorManifestQualified) blockers.push('compiled genesis descriptor/artifact qualification is missing');
  if (input.deployment.descriptorManifestQualified && !nonEmpty420(input.deployment.descriptorManifestDigest)) blockers.push('qualified descriptor manifest digest is missing');
  if (input.deployment.descriptorManifestQualified && !nonEmpty420(input.deployment.compiledArtifactsDigest)) blockers.push('qualified compiled-artifacts digest is missing');

  return {
    phase: 'IDX-10.5',
    decision: blockers.length === 0 ? 'go' : 'no-go',
    blockers,
    chainId: expectedChainId,
    genesisHash: input.config.expectedGenesisHash.toLowerCase(),
    rpcOrigin: rpcOrigin420(input.config.rpcUrl),
    finalityMode: input.config.finalityMode,
    confirmations: input.config.confirmations,
    sustainedWindow: {
      firstBlock: input.smoke.firstBlock.toString(),
      lastBlock: input.smoke.lastBlock.toString(),
      processed: input.smoke.processed,
    },
    restart: {
      checkpointBefore: input.restart.checkpointBefore.blockNumber.toString(),
      checkpointAfter: input.restart.checkpointAfter.blockNumber.toString(),
      replayGap: input.restart.replayGap,
      idempotentProcessed: input.restart.idempotentProcessed,
    },
    reorg: {
      recoveredDepth: input.reorg.recoveredReorgDepth,
      replayedBlocks: input.reorg.replayedBlocks,
      checkpointAfter: input.reorg.checkpointAfter.blockNumber.toString(),
    },
    consumer: {
      indexedHead: input.consumer.indexedHead,
      witnessBlock: input.consumer.blockNumber,
      streamEvents: input.consumer.streamEventCount,
      searchResults: input.consumer.searchResultCount,
    },
    revisions: {
      indexer: input.deployment.indexerRevision.trim(),
      node: input.deployment.nodeRevision.trim(),
    },
    descriptors: {
      qualified: input.deployment.descriptorManifestQualified,
      manifestDigest: input.deployment.descriptorManifestDigest?.trim() || null,
      artifactsDigest: input.deployment.compiledArtifactsDigest?.trim() || null,
    },
    operator: input.deployment.operator?.trim() || null,
    notes: [...(input.deployment.notes ?? [])],
    authoritative: false,
  };
}
