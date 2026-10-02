import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const BRIDGE_CONTRACTS_420 = [
  'BridgeChainRegistry420',
  'BridgeAssetRegistry',
  'BridgeRouteRegistry',
  'BridgeRiskManager',
  'BridgeTransferRegistry',
  'BridgeAccountingRegistry',
  'GatewayRouter420',
  'VerifiedGateway420',
  'CADCBridgeIntegration'
] as const;

export type BridgeContract420 = typeof BRIDGE_CONTRACTS_420[number];

export interface BridgeManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}
export interface BridgeManifestEvent420 {
  name: string;
  signature: string;
  inputs: BridgeManifestInput420[];
}
export interface BridgeManifestContract420 {
  contractName: BridgeContract420;
  sourcePath: string;
  sourceBlobSha: string;
  events: BridgeManifestEvent420[];
}
export interface BridgeArtifactManifest420 {
  schema: '420-bridge-artifact-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Bridge';
  authority: 'artifact_events_only_addresses_resolved_by_deployment';
  contracts: BridgeManifestContract420[];
}
export interface BridgeEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: BridgeContract420;
  signature: string;
}

const SUPPORTED_BRIDGE_FIELD_KINDS_420 = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

export function bridgeDescriptorsFromManifest420(manifest: BridgeArtifactManifest420): BridgeEventDescriptor420[] {
  if (
    manifest.schema !== '420-bridge-artifact-descriptor-v1' ||
    manifest.descriptorVersion !== 1 ||
    manifest.protocol !== '420Bridge' ||
    manifest.authority !== 'artifact_events_only_addresses_resolved_by_deployment'
  ) throw new Error('Bridge descriptor manifest identity mismatch');

  const names = manifest.contracts.map((contract) => contract.contractName).sort();
  const expected = [...BRIDGE_CONTRACTS_420].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error('Bridge descriptor contract set mismatch');

  const out: BridgeEventDescriptor420[] = [];
  for (const contract of manifest.contracts) {
    if (!/^contracts\/src\/bridge\/[A-Za-z0-9]+\.sol$/.test(contract.sourcePath) ||
        !/^[0-9a-f]{40}$/.test(contract.sourceBlobSha)) {
      throw new Error('Bridge descriptor source provenance invalid: ' + contract.contractName);
    }
    const seen = new Set<string>();
    for (const event of contract.events) {
      if (!event.name || !event.signature || seen.has(event.signature)) {
        throw new Error('Bridge descriptor duplicate/invalid event: ' + contract.contractName);
      }
      seen.add(event.signature);
      const signature = `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
      if (signature !== event.signature) throw new Error('Bridge descriptor signature drift: ' + event.signature);
      const fields = event.inputs.map((input) => {
        if (!input.name || !SUPPORTED_BRIDGE_FIELD_KINDS_420.has(input.type)) {
          throw new Error('Bridge descriptor field drift: ' + event.signature);
        }
        return { name: input.name, kind: input.type, indexed: Boolean(input.indexed) };
      });
      out.push({
        protocol: '420Bridge',
        contractName: contract.contractName,
        eventName: event.name,
        signature: event.signature,
        topic0: id(event.signature) as Hex,
        fields
      });
    }
  }
  out.sort((a,b) => a.contractName.localeCompare(b.contractName) || a.signature.localeCompare(b.signature));
  return out;
}

export function bindBridgeDescriptors420(
  descriptors: readonly BridgeEventDescriptor420[],
  addresses: Readonly<Record<BridgeContract420, Hex>>
): GenesisDescriptor420[] {
  const canonical = new Set<BridgeContract420>(BRIDGE_CONTRACTS_420);
  const seen = new Set<BridgeContract420>();
  const out = descriptors.map((descriptor) => {
    if (!canonical.has(descriptor.contractName)) throw new Error('Bridge descriptor unknown contract');
    const address = addresses[descriptor.contractName];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/.test(address)) {
      throw new Error('Bridge deployment address invalid: ' + descriptor.contractName);
    }
    seen.add(descriptor.contractName);
    return { ...descriptor, contractAddress: address.toLowerCase() as Hex } as GenesisDescriptor420;
  });
  if (seen.size !== BRIDGE_CONTRACTS_420.length) throw new Error('Bridge deployment address set incomplete');
  return out;
}
