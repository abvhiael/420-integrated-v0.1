import type { ChainSource420 } from './chain-source.js';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { descriptorsFromStakeRelease420, type RetainedAbiArtifact420, type StakeReleaseDescriptor420 } from './abi-manifest.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';

// Production assembly: ABI provenance validation, canonical raw/protocol rows,
// persistent ancestry and checkpoint all use the same database. Projections
// expose lifecycle evidence and never authorize settlement or consensus votes.
export function createStakeIndexer420(source: ChainSource420, db: TransactionalSql420, chainId: bigint,
  manifest: StakeReleaseDescriptor420, artifacts: ReadonlyMap<string, RetainedAbiArtifact420>, options: IngestionOptions420): IndexerIngestor420 {
  if (!source.finalizedBlockNumber) throw new Error('Stake recovery requires canonical finalized block semantics');
  const protocols = new ProtocolProjection420(db, new ProtocolDecoderRegistry420(descriptorsFromStakeRelease420(manifest, artifacts)));
  return new IndexerIngestor420(source, new SqlCheckpointStore420(db, chainId),
    new CoreProjectionConsumer420(db, protocols, chainId), options, new SqlCanonicalHistoryStore420(db, chainId));
}
