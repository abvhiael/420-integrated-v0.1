import type { ChainSource420, Hex, IndexerLog, LogFilter420 } from './chain-source.js';
import { id, keccak256, AbiCoder } from 'ethers';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';
import { compensationDescriptors420, type CompensationDeployment420 } from './compensation-descriptors.js';

// The caller must obtain addresses from the verified canonical deployment/Registry.
// This construction does not grant any Compensation or Vault authority.
export async function createCompensationIndexer420(source: ChainSource420, db: TransactionalSql420, chainId: bigint, genesisHash: Hex,
  deployment: CompensationDeployment420, options: IngestionOptions420): Promise<IndexerIngestor420> {
  if (chainId <= 0n || await source.chainId() !== chainId) throw new Error('Compensation source chain mismatch');
  if (!/^0x[0-9a-fA-F]{64}$/.test(genesisHash) || /^0x0{64}$/.test(genesisHash)) throw new Error('Compensation genesis identity invalid');
  const genesis = await source.getBlockByNumber(0n);
  if (!genesis || genesis.number !== 0n || genesis.hash.toLowerCase() !== genesisHash.toLowerCase()) throw new Error('Compensation source genesis mismatch');
  const descriptors = compensationDescriptors420(deployment);
  const verifyDeployment = async () => {
    for (const [address, expected] of [[deployment.vault,deployment.vaultCodeHash],[deployment.splitter,deployment.splitterCodeHash]] as const) {
      const code = await source.getCode(address);
      if (code === '0x' || !/^0x[0-9a-fA-F]{64}$/.test(expected) || keccak256(code).toLowerCase() !== expected.toLowerCase()) throw new Error('compensation runtime identity mismatch');
    }
    const readAddress = async (to: Hex, signature: string) => String(AbiCoder.defaultAbiCoder().decode(['address'],await source.call({to,data:id(signature).slice(0,10) as Hex}))[0]).toLowerCase();
    if (await readAddress(deployment.vault,'beneficiary()') !== deployment.splitter.toLowerCase() ||
        await readAddress(deployment.splitter,'compensationVault()') !== deployment.vault.toLowerCase()) throw new Error('compensation binding mismatch');
  };
  await verifyDeployment();
  const decoders = new ProtocolDecoderRegistry420(descriptors);
  const protocols = new ProtocolProjection420(db, decoders);
  const knownTopics = new Set(descriptors.map(d=>d.topic0.toLowerCase()));
  const same = (a:IndexerLog,b:IndexerLog) => a.blockNumber===b.blockNumber && a.blockHash.toLowerCase()===b.blockHash.toLowerCase() && a.transactionHash.toLowerCase()===b.transactionHash.toLowerCase() && a.transactionIndex===b.transactionIndex && a.logIndex===b.logIndex && a.address.toLowerCase()===b.address.toLowerCase() && a.data.toLowerCase()===b.data.toLowerCase() && JSON.stringify(a.topics.map(t=>t.toLowerCase()))===JSON.stringify(b.topics.map(t=>t.toLowerCase())) && !b.removed;
  const pinned = new Proxy(source, { get(target, property) {
    if (property === 'chainId') return async () => {
      if (await target.chainId() !== chainId) throw new Error('Compensation source chain mismatch');
      const block = await target.getBlockByNumber(0n);
      if (!block || block.number !== 0n || block.hash.toLowerCase() !== genesisHash.toLowerCase()) throw new Error('Compensation source genesis mismatch');
      await verifyDeployment();
      return chainId;
    };
    if (property === 'getLogs') return async (filter:LogFilter420) => {
      const logs = await target.getLogs(filter);
      for (const log of logs) {
        if(log.removed || !knownTopics.has(log.topics[0]?.toLowerCase() ?? '')) continue;
        decoders.decode(log); // strict ABI and deployment-address verification
        const [tx,receipt] = await Promise.all([target.getTransactionByHash(log.transactionHash),target.getTransactionReceipt(log.transactionHash)]);
        if(!tx || !receipt || receipt.status!==1 || tx.hash.toLowerCase()!==log.transactionHash.toLowerCase() || receipt.transactionHash.toLowerCase()!==log.transactionHash.toLowerCase() || tx.blockNumber!==log.blockNumber || receipt.blockNumber!==log.blockNumber || tx.blockHash.toLowerCase()!==log.blockHash.toLowerCase() || receipt.blockHash.toLowerCase()!==log.blockHash.toLowerCase() || tx.transactionIndex!==log.transactionIndex || receipt.transactionIndex!==log.transactionIndex || !receipt.logs.some(candidate=>same(log,candidate))) throw new Error('Compensation transaction or receipt provenance mismatch');
      }
      return logs;
    };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  return new IndexerIngestor420(pinned, new SqlCheckpointStore420(db, chainId),
    new CoreProjectionConsumer420(db, protocols, chainId), options, new SqlCanonicalHistoryStore420(db, chainId));
}
