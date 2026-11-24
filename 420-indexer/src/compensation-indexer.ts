import { Interface, id, keccak256 } from 'ethers';
import { descriptorsFromArtifact420, type Artifact420 } from './abi-manifest.js';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog, LogFilter420 } from './chain-source.js';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';

export const COMPENSATION_PROTOCOL_420 = '420DevelopmentCompensation';
const SERVICE = id('420/service/development-compensation/v1');
const registryABI = new Interface(['function resolveActive(bytes32 service) view returns (address,uint32)']);
const bindingsABI = new Interface([
  'function beneficiary() view returns (address)',
  'function compensationVault() view returns (address)'
]);
const events = {
  DevelopmentCompensationVault420: [
    'DevelopmentCompensationForwarded(bytes32,bytes32,bytes32,address,address,address,uint256,uint16,uint256,bytes32)'
  ],
  FoundingDeveloperCompensationSplitter420: [
    'FounderCompensationDeposited(address,uint256)',
    'FounderTokenCompensationCredited(address,address,bytes32,uint256)',
    'FounderCompensationClaimed(address,address,uint256)'
  ]
} as const;
type ContractName = keyof typeof events;

export interface CompensationDeployment420 {
  chainId: bigint;
  genesisHash: Hex;
  deploymentBlock: bigint;
  deploymentBlockHash: Hex;
  registry: { address: Hex; runtimeHash: Hex };
  vault: { address: Hex; runtimeHash: Hex };
  splitter: { address: Hex; runtimeHash: Hex };
}

function sameLog(a: IndexerLog, b: IndexerLog): boolean {
  return !b.removed && a.blockNumber === b.blockNumber && a.blockHash.toLowerCase() === b.blockHash.toLowerCase()
    && a.transactionHash.toLowerCase() === b.transactionHash.toLowerCase() && a.transactionIndex === b.transactionIndex
    && a.logIndex === b.logIndex && a.address.toLowerCase() === b.address.toLowerCase()
    && a.data.toLowerCase() === b.data.toLowerCase() && a.topics.length === b.topics.length
    && a.topics.every((topic, index) => topic.toLowerCase() === b.topics[index]?.toLowerCase());
}

/** Pass the trusted release pins and the ABI artifacts from the same release. */
export async function createCompensationIndexer420(
  source: ChainSource420,
  db: TransactionalSql420,
  deployment: CompensationDeployment420,
  artifacts: ReadonlyMap<string, Artifact420>,
  options: IngestionOptions420
): Promise<IndexerIngestor420> {
  const { chainId, genesisHash, deploymentBlock, deploymentBlockHash, registry, vault, splitter } = deployment;
  const contracts = [registry, vault, splitter];
  const addresses = contracts.map(binding => binding.address.toLowerCase());
  const isHash = (hash: Hex) => /^0x[0-9a-f]{64}$/i.test(hash) && BigInt(hash) !== 0n;
  if (chainId <= 0n || deploymentBlock < 0n || !isHash(genesisHash) || !isHash(deploymentBlockHash)
    || new Set(addresses).size !== addresses.length
    || contracts.some(({ address, runtimeHash }) => !/^0x[0-9a-f]{40}$/i.test(address)
      || BigInt(address) === 0n || !isHash(runtimeHash))) {
    throw new Error('invalid compensation deployment pins');
  }

  const call = async (abi: Interface, address: Hex, method: string, args: unknown[] = []) =>
    abi.decodeFunctionResult(method, await source.call({ to: address, data: abi.encodeFunctionData(method, args) as Hex },
      deploymentBlock));

  async function verifyDeployment(): Promise<bigint> {
    if (await source.chainId() !== chainId) throw new Error('compensation chain mismatch');
    const [genesis, anchor] = await Promise.all([source.getBlockByNumber(0n), source.getBlockByNumber(deploymentBlock)]);
    if (genesis?.number !== 0n || genesis.hash.toLowerCase() !== genesisHash.toLowerCase()
      || anchor?.number !== deploymentBlock || anchor.hash.toLowerCase() !== deploymentBlockHash.toLowerCase()) {
      throw new Error('compensation deployment chain or block mismatch');
    }
    await Promise.all(contracts.map(async ({ address, runtimeHash }) => {
      const code = await source.getCode(address, deploymentBlock);
      if (code === '0x' || keccak256(code).toLowerCase() !== runtimeHash.toLowerCase()) {
        throw new Error('compensation deployment runtime mismatch');
      }
    }));
    const [active, beneficiary, bound] = await Promise.all([
      call(registryABI, registry.address, 'resolveActive', [SERVICE]),
      call(bindingsABI, vault.address, 'beneficiary'),
      call(bindingsABI, splitter.address, 'compensationVault')
    ]);
    if (String(active[0]).toLowerCase() !== addresses[1] || active[1] !== 1n
      || String(beneficiary[0]).toLowerCase() !== addresses[2] || String(bound[0]).toLowerCase() !== addresses[1]) {
      throw new Error('compensation deployment registration or binding mismatch');
    }
    return chainId;
  }

  await verifyDeployment();
  const descriptors = (Object.keys(events) as ContractName[]).flatMap(name => {
    const artifact = artifacts.get(name);
    if (!artifact) throw new Error('missing compensation ABI: ' + name);
    const address = name === 'DevelopmentCompensationVault420' ? vault.address : splitter.address;
    const expected: readonly string[] = events[name];
    const descriptors = descriptorsFromArtifact420(COMPENSATION_PROTOCOL_420, { name, address, artifact: name }, artifact)
      .filter(descriptor => expected.includes(descriptor.signature));
    if (descriptors.length !== expected.length || new Set(descriptors.map(d => d.signature)).size !== expected.length) {
      throw new Error('compensation ABI event signature mismatch: ' + name);
    }
    return descriptors;
  });
  const decoders = new ProtocolDecoderRegistry420(descriptors);
  const emitters = new Map(descriptors.map(d => [d.topic0.toLowerCase(), d.contractAddress]));

  const pinned = new Proxy(source, {
    get(target, property) {
      if (property === 'chainId') return verifyDeployment;
      if (property === 'getLogs') return async (filter: LogFilter420) => {
        const logs = await target.getLogs(filter);
        for (const log of logs) {
          const emitter = emitters.get(log.topics[0]?.toLowerCase() ?? '');
          if (log.removed || emitter !== log.address.toLowerCase()) continue;
          if (log.blockNumber < deploymentBlock) throw new Error('compensation event predates deployment');
          decoders.decode(log);
          const receipt = await target.getTransactionReceipt(log.transactionHash);
          if (!receipt || receipt.status !== 1 || receipt.blockNumber !== log.blockNumber
            || receipt.blockHash.toLowerCase() !== log.blockHash.toLowerCase()
            || receipt.transactionHash.toLowerCase() !== log.transactionHash.toLowerCase()
            || receipt.transactionIndex !== log.transactionIndex || !receipt.logs.some(candidate => sameLog(log, candidate))) {
            throw new Error('compensation receipt provenance mismatch');
          }
        }
        return logs;
      };
      if (property === 'getNativeLogs') return target.getNativeLogs
        ? async (block: IndexerBlock) =>
          (await target.getNativeLogs!(block)).filter(log => !emitters.has(log.topics[0]?.toLowerCase() ?? ''))
        : undefined;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  const projection = new ProtocolProjection420(db, decoders);
  return new IndexerIngestor420(pinned, new SqlCheckpointStore420(db, chainId),
    new CoreProjectionConsumer420(db, projection, chainId), options,
    new SqlCanonicalHistoryStore420(db, chainId));
}
