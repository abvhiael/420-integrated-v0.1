import type { ChainSource420, Hex } from './chain-source.js';
import type { Artifact420 } from './abi-manifest.js';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';
import { bindTreasuryDescriptors420, treasuryDescriptorsFromArtifacts420, type TreasuryArtifactManifest420, type TreasuryEventContract420 } from './treasury-descriptors.js';

// The caller must obtain addresses from the verified canonical deployment/Registry.
// This construction does not grant any Treasury or Vault authority.
export async function createTreasuryIndexer420(source: ChainSource420, db: TransactionalSql420, chainId: bigint, genesisHash: Hex,
  manifest: TreasuryArtifactManifest420, artifacts: ReadonlyMap<string, Artifact420>,
  addresses: Readonly<Record<TreasuryEventContract420, Hex>>, options: IngestionOptions420): Promise<IndexerIngestor420> {
  if (chainId <= 0n || await source.chainId() !== chainId) throw new Error('Treasury source chain mismatch');
  if (!/^0x[0-9a-fA-F]{64}$/.test(genesisHash) || /^0x0{64}$/.test(genesisHash)) throw new Error('Treasury genesis identity invalid');
  const genesis = await source.getBlockByNumber(0n);
  if (!genesis || genesis.number !== 0n || genesis.hash.toLowerCase() !== genesisHash.toLowerCase()) throw new Error('Treasury source genesis mismatch');
  const descriptors = bindTreasuryDescriptors420(treasuryDescriptorsFromArtifacts420(manifest, artifacts), addresses);
  const protocols = new ProtocolProjection420(db, new ProtocolDecoderRegistry420(descriptors));
  const pinned = new Proxy(source, { get(target, property) {
    if (property === 'chainId') return async () => {
      if (await target.chainId() !== chainId) throw new Error('Treasury source chain mismatch');
      const block = await target.getBlockByNumber(0n);
      if (!block || block.number !== 0n || block.hash.toLowerCase() !== genesisHash.toLowerCase()) throw new Error('Treasury source genesis mismatch');
      return chainId;
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  return new IndexerIngestor420(pinned, new SqlCheckpointStore420(db, chainId),
    new CoreProjectionConsumer420(db, protocols, chainId), options, new SqlCanonicalHistoryStore420(db, chainId));
}
