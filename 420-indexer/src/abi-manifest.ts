import { createHash } from 'node:crypto';
import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export interface AbiInput420 { name: string; type: string; indexed?: boolean; }
export interface AbiEvent420 { type: 'event'; name: string; anonymous?: boolean; inputs: AbiInput420[]; }
export interface Artifact420 { contractName: string; abi: Array<AbiEvent420 | Record<string, unknown>>; }
export interface Predeploy420 { name: string; address: Hex; artifact: string; }
export interface PredeployPlan420 { predeploys: Predeploy420[]; }

export interface GenesisDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: string;
  contractAddress: Hex;
  signature: string;
}

const SUPPORTED = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

export const GENESIS_PROTOCOL_BY_CONTRACT_420: Record<string, string> = {
  ProtocolRegistry: '420Registry',
  Names420: '420Names',
  Identity420: '420Identity',
  Stake420: '420Stake',
  ValidatorRegistry: '420Stake',
  ListingRegistry420: '420Market',
  RightsAssetRegistry420: '420Rights',
  RightsClaimRegistry420: '420Rights',
  RightsLicenseRegistry420: '420Rights',
  CommonsSpaceRegistry420: '420Commons',
  PulsePublicationRegistry420: '420Pulse',
  Governance420: '420Governance',
  GovernanceTimelock: '420Governance',
  CivicConstitution420: '420Governance',
  CivicProposalRegistry420: '420Governance',
  CivicElectorateRegistry420: '420Governance',
  CivicVoting420: '420Governance',
  CivicGovernor420: '420Governance',
  MerchantRegistry420: '420Pay',
  InvoiceRegistry420: '420Pay',
  PaymentRegistry420: '420Pay',
  PaymentRouter420: '420Pay',
  SettlementRouter420: '420Pay',
  RefundManager420: '420Pay',
  GasSponsor420: '420Pay',
  CanonicalSettlementAdapter420: '420Pay',
  CanonicalSwapHealthAdapter420: '420Pay',
  AttentionTreasury: '420Treasury',
  DevelopmentTreasury: '420Treasury',
  GenesisDEXFactory: '420Swap',
  PublicBatchAuction: '420Swap',
  ApprovedQuoteAssetRegistry: '420Swap',
  VerifiedGateway420: '420Bridge',
  RandomnessRegistry: '420Randomness'
};

export function descriptorsFromArtifact420(
  protocol: string,
  predeploy: Predeploy420,
  artifact: Artifact420
): GenesisDescriptor420[] {
  if (artifact.contractName !== predeploy.name) throw new Error(`artifact contract mismatch for ${predeploy.name}`);
  const out: GenesisDescriptor420[] = [];
  for (const item of artifact.abi) {
    if ((item as AbiEvent420).type !== 'event') continue;
    const event = item as AbiEvent420;
    if (event.anonymous) throw new Error(`anonymous event unsupported: ${predeploy.name}.${event.name}`);
    const fields = event.inputs.map((input) => {
      if (!SUPPORTED.has(input.type as ProtocolFieldKind420)) {
        throw new Error(`unsupported event field ${input.type}: ${predeploy.name}.${event.name}.${input.name}`);
      }
      return { name: input.name, kind: input.type as ProtocolFieldKind420, indexed: Boolean(input.indexed) };
    });
    const signature = `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
    out.push({
      protocol,
      eventName: event.name,
      topic0: id(signature) as Hex,
      fields,
      contractName: predeploy.name,
      contractAddress: predeploy.address.toLowerCase() as Hex,
      signature
    });
  }
  return out;
}

export function buildGenesisDescriptorManifest420(
  plan: PredeployPlan420,
  artifacts: ReadonlyMap<string, Artifact420>,
  protocolByContract: Readonly<Record<string, string>> = GENESIS_PROTOCOL_BY_CONTRACT_420
): GenesisDescriptor420[] {
  const descriptors: GenesisDescriptor420[] = [];
  for (const predeploy of plan.predeploys) {
    const protocol = protocolByContract[predeploy.name];
    if (!protocol) continue;
    const artifact = artifacts.get(predeploy.name);
    if (!artifact) throw new Error(`required genesis artifact missing: ${predeploy.name}`);
    descriptors.push(...descriptorsFromArtifact420(protocol, predeploy, artifact));
  }
  descriptors.sort((a,b) => a.contractAddress.localeCompare(b.contractAddress) || a.signature.localeCompare(b.signature));
  return descriptors;
}


export const PROTOCOL_REGISTRY_DESCRIPTOR_SHA256_420 = '0bb8d571d38eeb66d7b277253cdae65b6b14c7538f95dc809db6818c8a79db81';
export const PROTOCOL_REGISTRY_ADDRESS_420 = '0x0000000000000000000000000000000000000434' as Hex;

export interface ProtocolRegistryReleaseDescriptorEvent420 extends AbiEvent420 {
  signature: string;
  topic0: Hex;
}

export interface ProtocolRegistryReleaseDescriptor420 {
  schema: '420-protocol-registry-release-descriptor-v1';
  descriptorVersion: 1;
  contractName: 'ProtocolRegistry';
  protocol: '420Registry';
  protocolVersion: 4;
  canonicalAddress: Hex;
  source: { path: string; gitBlobSha: string };
  events: ProtocolRegistryReleaseDescriptorEvent420[];
  descriptorSha256: string;
  authority: 'repository_descriptor_only_not_live_registry_authority';
}

function canonicalJson420(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson420).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson420(record[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function protocolRegistryDescriptorDigest420(manifest: ProtocolRegistryReleaseDescriptor420): string {
  const payload = {
    canonicalAddress: manifest.canonicalAddress,
    contractName: manifest.contractName,
    events: manifest.events,
    protocolVersion: manifest.protocolVersion,
    source: manifest.source
  };
  return createHash('sha256').update(canonicalJson420(payload)).digest('hex');
}

export function descriptorsFromProtocolRegistryRelease420(
  manifest: ProtocolRegistryReleaseDescriptor420
): GenesisDescriptor420[] {
  if (manifest.schema !== '420-protocol-registry-release-descriptor-v1' ||
      manifest.descriptorVersion !== 1 ||
      manifest.contractName !== 'ProtocolRegistry' ||
      manifest.protocol !== '420Registry' ||
      manifest.protocolVersion !== 4) {
    throw new Error('ProtocolRegistry release descriptor identity mismatch');
  }
  if (manifest.canonicalAddress.toLowerCase() !== PROTOCOL_REGISTRY_ADDRESS_420) {
    throw new Error('ProtocolRegistry release descriptor address mismatch');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.source.gitBlobSha)) {
    throw new Error('ProtocolRegistry release descriptor source blob invalid');
  }
  const digest = protocolRegistryDescriptorDigest420(manifest);
  if (digest !== manifest.descriptorSha256 || digest !== PROTOCOL_REGISTRY_DESCRIPTOR_SHA256_420) {
    throw new Error('ProtocolRegistry release descriptor hash drift');
  }

  const required = new Set([
    'ServiceVersionPublished',
    'ServiceRegistrationProfilePublished',
    'ServiceDeprecated'
  ]);
  if (manifest.events.length !== required.size) throw new Error('ProtocolRegistry release descriptor event set mismatch');

  const artifact: Artifact420 = { contractName: manifest.contractName, abi: manifest.events };
  const predeploy: Predeploy420 = {
    name: manifest.contractName,
    address: manifest.canonicalAddress,
    artifact: '420-indexer/descriptors/protocol-registry-v4.json'
  };
  const descriptors = descriptorsFromArtifact420(manifest.protocol, predeploy, artifact);
  for (const event of manifest.events) {
    if (!required.delete(event.name)) throw new Error('ProtocolRegistry release descriptor unexpected or duplicate event');
    const signature = event.name + '(' + event.inputs.map((input) => input.type).join(',') + ')';
    if (signature !== event.signature || id(signature).toLowerCase() !== event.topic0.toLowerCase()) {
      throw new Error('ProtocolRegistry release descriptor event identity mismatch: ' + event.name);
    }
    const built = descriptors.find((descriptor) => descriptor.eventName === event.name);
    if (!built || built.topic0.toLowerCase() !== event.topic0.toLowerCase()) {
      throw new Error('ProtocolRegistry release descriptor build mismatch: ' + event.name);
    }
  }
  if (required.size !== 0) throw new Error('ProtocolRegistry release descriptor required event missing');
  return descriptors;
}


export const NAMES420_ADDRESS_420 = '0x0000000000000000000000000000000000000435' as Hex;
export const NAMES420_SOURCE_BLOB_SHA1_420 = '4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d';
export const NAMES420_ARTIFACT_PAYLOAD_SHA256_420 = 'c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c';
export const NAMES420_RUNTIME_CODE_HASH_420 = '0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7';
export const NAMES420_DESCRIPTOR_SHA256_420 = '74602adfdde367c82fcefcd35a89a5b0e415e92721289cca9e827be32299b3be';

export interface Names420ReleaseDescriptorEvent420 extends AbiEvent420 {
  signature: string;
  topic0: Hex;
}

export interface Names420ReleaseDescriptor420 {
  schema: '420-names-release-descriptor-v1';
  descriptorVersion: 1;
  contractName: 'Names420';
  protocol: '420Names';
  protocolVersion: 3;
  canonicalAddress: Hex;
  source: { path: 'contracts/src/apps/Names420.sol'; gitBlobSha: string };
  artifact: {
    path: 'contracts/artifacts/Names420.json';
    payloadSha256: string;
    runtimeCodeHash: Hex;
  };
  events: Names420ReleaseDescriptorEvent420[];
  descriptorSha256: string;
  authority: 'repository_descriptor_only_not_live_names_authority';
}

export function names420DescriptorDigest420(manifest: Names420ReleaseDescriptor420): string {
  const payload = {
    canonicalAddress: manifest.canonicalAddress,
    contractName: manifest.contractName,
    protocol: manifest.protocol,
    protocolVersion: manifest.protocolVersion,
    source: manifest.source,
    artifact: manifest.artifact,
    events: manifest.events
  };
  return createHash('sha256').update(canonicalJson420(payload)).digest('hex');
}

export function descriptorsFromNames420Release420(
  manifest: Names420ReleaseDescriptor420
): GenesisDescriptor420[] {
  if (manifest.schema !== '420-names-release-descriptor-v1' ||
      manifest.descriptorVersion !== 1 ||
      manifest.contractName !== 'Names420' ||
      manifest.protocol !== '420Names' ||
      manifest.protocolVersion !== 3) {
    throw new Error('Names420 release descriptor identity mismatch');
  }
  if (manifest.canonicalAddress.toLowerCase() !== NAMES420_ADDRESS_420) {
    throw new Error('Names420 release descriptor address mismatch');
  }
  if (manifest.source.path !== 'contracts/src/apps/Names420.sol' ||
      manifest.source.gitBlobSha !== NAMES420_SOURCE_BLOB_SHA1_420) {
    throw new Error('Names420 release descriptor source drift');
  }
  if (manifest.artifact.path !== 'contracts/artifacts/Names420.json' ||
      manifest.artifact.payloadSha256 !== NAMES420_ARTIFACT_PAYLOAD_SHA256_420 ||
      manifest.artifact.runtimeCodeHash.toLowerCase() !== NAMES420_RUNTIME_CODE_HASH_420) {
    throw new Error('Names420 release descriptor artifact drift');
  }
  const digest = names420DescriptorDigest420(manifest);
  if (digest !== manifest.descriptorSha256 || digest !== NAMES420_DESCRIPTOR_SHA256_420) {
    throw new Error('Names420 release descriptor hash drift');
  }

  const required = new Set([
    'CommitmentMade(bytes32,address,uint64)',
    'NameRegistered(bytes32,address,uint64,uint8)',
    'NameRenewed(bytes32,address,uint64)',
    'NameTransferStarted(bytes32,address,address)',
    'NameTransferred(bytes32,address,address)',
    'ResolutionUpdated(bytes32,address,bytes32,bytes32)',
    'ReverseNameSet(address,bytes32)'
  ]);
  if (manifest.events.length !== required.size) {
    throw new Error('Names420 release descriptor event set mismatch');
  }

  const artifact: Artifact420 = { contractName: manifest.contractName, abi: manifest.events };
  const predeploy: Predeploy420 = {
    name: manifest.contractName,
    address: manifest.canonicalAddress,
    artifact: manifest.artifact.path
  };
  const descriptors = descriptorsFromArtifact420(manifest.protocol, predeploy, artifact);

  for (const event of manifest.events) {
    const signature = event.name + '(' + event.inputs.map((input) => input.type).join(',') + ')';
    if (!required.delete(signature)) {
      throw new Error('Names420 release descriptor unexpected or duplicate event: ' + signature);
    }
    if (signature !== event.signature || id(signature).toLowerCase() !== event.topic0.toLowerCase()) {
      throw new Error('Names420 release descriptor event identity mismatch: ' + event.name);
    }
    const built = descriptors.find((descriptor) => descriptor.signature === signature);
    if (!built || built.topic0.toLowerCase() !== event.topic0.toLowerCase()) {
      throw new Error('Names420 release descriptor build mismatch: ' + event.name);
    }
  }
  if (required.size !== 0) throw new Error('Names420 release descriptor required event missing');
  return descriptors;
}
