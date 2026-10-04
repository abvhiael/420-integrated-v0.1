import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { Artifact420, AbiEvent420, GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const RIGHTS_EVENT_CONTRACTS_420 = [
  'RightsPolicyRegistry420',
  'RightsAssetRegistry420',
  'RightsClaimRegistry420',
  'RightsLicenseRegistry420'
] as const;

export type RightsEventContract420 = typeof RIGHTS_EVENT_CONTRACTS_420[number];

export interface RightsManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}
export interface RightsManifestEvent420 {
  name: string;
  signature: string;
  inputs: RightsManifestInput420[];
}
export interface RightsManifestContract420 {
  contractName: RightsEventContract420;
  sourcePath: string;
  events: RightsManifestEvent420[];
}
export interface RightsArtifactManifest420 {
  schema: '420-rights-artifact-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Rights';
  authority: 'artifact_events_only_addresses_resolved_by_registry';
  contracts: RightsManifestContract420[];
}
export interface RightsEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: RightsEventContract420;
  signature: string;
}

const SUPPORTED = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);
const signature = (event: AbiEvent420): string =>
  `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;

export function rightsDescriptorsFromArtifacts420(
  manifest: RightsArtifactManifest420,
  artifacts: ReadonlyMap<string, Artifact420>
): RightsEventDescriptor420[] {
  if (manifest.schema !== '420-rights-artifact-descriptor-v1' ||
      manifest.descriptorVersion !== 1 ||
      manifest.protocol !== '420Rights' ||
      manifest.authority !== 'artifact_events_only_addresses_resolved_by_registry') {
    throw new Error('Rights descriptor manifest identity mismatch');
  }
  const names = manifest.contracts.map((contract) => contract.contractName).sort();
  const expectedNames = [...RIGHTS_EVENT_CONTRACTS_420].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) throw new Error('Rights descriptor contract set mismatch');

  const out: RightsEventDescriptor420[] = [];
  for (const contract of manifest.contracts) {
    const artifact = artifacts.get(contract.contractName);
    if (!artifact || artifact.contractName !== contract.contractName) {
      throw new Error('Rights artifact missing or mismatched: ' + contract.contractName);
    }
    const events = artifact.abi.filter((item): item is AbiEvent420 => (item as AbiEvent420).type === 'event');
    if (events.length !== contract.events.length) throw new Error('Rights artifact event count mismatch: ' + contract.contractName);
    const bySignature = new Map(events.map((event) => [signature(event), event]));
    for (const expected of contract.events) {
      const event = bySignature.get(expected.signature);
      if (!event || event.name !== expected.name || event.inputs.length !== expected.inputs.length) {
        throw new Error('Rights artifact event missing: ' + contract.contractName + '.' + expected.signature);
      }
      const fields = event.inputs.map((input, index) => {
        const declared = expected.inputs[index]!;
        if (input.name !== declared.name || input.type !== declared.type ||
            Boolean(input.indexed) !== declared.indexed || !SUPPORTED.has(input.type as ProtocolFieldKind420)) {
          throw new Error('Rights artifact input drift: ' + expected.signature + ':' + index);
        }
        return { name: input.name, kind: input.type as ProtocolFieldKind420, indexed: Boolean(input.indexed) };
      });
      out.push({
        protocol: '420Rights',
        contractName: contract.contractName,
        eventName: event.name,
        signature: expected.signature,
        topic0: id(expected.signature) as Hex,
        fields
      });
    }
  }
  out.sort((a,b) => a.contractName.localeCompare(b.contractName) || a.signature.localeCompare(b.signature));
  return out;
}

export function bindRightsDescriptors420(
  descriptors: readonly RightsEventDescriptor420[],
  addresses: Readonly<Record<RightsEventContract420, Hex>>
): GenesisDescriptor420[] {
  const seen = new Set<RightsEventContract420>();
  const out = descriptors.map((descriptor) => {
    const address = addresses[descriptor.contractName];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Rights deployment address invalid: ' + descriptor.contractName);
    seen.add(descriptor.contractName);
    return { ...descriptor, contractAddress: address.toLowerCase() as Hex } as GenesisDescriptor420;
  });
  if (seen.size !== RIGHTS_EVENT_CONTRACTS_420.length) throw new Error('Rights deployment address set incomplete');
  return out;
}
