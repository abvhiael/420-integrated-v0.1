import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { Artifact420, AbiEvent420, GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const GRANTS_EVENT_CONTRACTS_420 = [
  'GrantProgramRegistry420',
  'GrantApplicationRegistry420',
  'GrantAwardRegistry420',
  'GrantMilestoneRegistry420'
] as const;

export type GrantsEventContract420 = typeof GRANTS_EVENT_CONTRACTS_420[number];

export interface GrantsManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}

export interface GrantsManifestEvent420 {
  name: string;
  signature: string;
  inputs: GrantsManifestInput420[];
}

export interface GrantsManifestContract420 {
  contractName: GrantsEventContract420;
  sourcePath: string;
  events: GrantsManifestEvent420[];
}

export interface GrantsArtifactManifest420 {
  schema: '420-grants-artifact-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Grants';
  authority: 'artifact_events_only_addresses_resolved_by_registry';
  contracts: GrantsManifestContract420[];
}

export interface GrantsEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: GrantsEventContract420;
  signature: string;
}

const SUPPORTED_GRANTS_FIELD_KINDS_420 = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

function eventSignature420(event: AbiEvent420): string {
  return `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
}

function artifactEvents420(artifact: Artifact420): AbiEvent420[] {
  return artifact.abi.filter((item): item is AbiEvent420 => (item as AbiEvent420).type === 'event');
}

export function grantsDescriptorsFromArtifacts420(
  manifest: GrantsArtifactManifest420,
  artifacts: ReadonlyMap<string, Artifact420>
): GrantsEventDescriptor420[] {
  if (
    manifest.schema !== '420-grants-artifact-descriptor-v1' ||
    manifest.descriptorVersion !== 1 ||
    manifest.protocol !== '420Grants' ||
    manifest.authority !== 'artifact_events_only_addresses_resolved_by_registry'
  ) throw new Error('Grants descriptor manifest identity mismatch');

  const manifestNames = manifest.contracts.map((contract) => contract.contractName).sort();
  const canonicalNames = [...GRANTS_EVENT_CONTRACTS_420].sort();
  if (JSON.stringify(manifestNames) !== JSON.stringify(canonicalNames)) {
    throw new Error('Grants descriptor contract set mismatch');
  }

  const descriptors: GrantsEventDescriptor420[] = [];
  for (const contract of manifest.contracts) {
    const artifact = artifacts.get(contract.contractName);
    if (!artifact || artifact.contractName !== contract.contractName) {
      throw new Error('Grants artifact missing or mismatched: ' + contract.contractName);
    }
    const events = artifactEvents420(artifact);
    if (events.length !== contract.events.length) {
      throw new Error('Grants artifact event count mismatch: ' + contract.contractName);
    }

    const artifactBySignature = new Map(events.map((event) => [eventSignature420(event), event]));
    for (const expected of contract.events) {
      const event = artifactBySignature.get(expected.signature);
      if (!event || event.name !== expected.name) {
        throw new Error('Grants artifact event missing: ' + contract.contractName + '.' + expected.signature);
      }
      if (event.inputs.length !== expected.inputs.length) {
        throw new Error('Grants artifact input count mismatch: ' + expected.signature);
      }
      const fields = event.inputs.map((input, index) => {
        const declared = expected.inputs[index]!;
        if (
          input.name !== declared.name ||
          input.type !== declared.type ||
          Boolean(input.indexed) !== declared.indexed ||
          !SUPPORTED_GRANTS_FIELD_KINDS_420.has(input.type as ProtocolFieldKind420)
        ) throw new Error('Grants artifact input drift: ' + expected.signature + ':' + index);
        return { name: input.name, kind: input.type as ProtocolFieldKind420, indexed: Boolean(input.indexed) };
      });
      descriptors.push({
        protocol: '420Grants',
        contractName: contract.contractName,
        eventName: event.name,
        signature: expected.signature,
        topic0: id(expected.signature) as Hex,
        fields
      });
    }
  }

  descriptors.sort((a,b) => a.contractName.localeCompare(b.contractName) || a.signature.localeCompare(b.signature));
  return descriptors;
}

export function bindGrantsDescriptors420(
  descriptors: readonly GrantsEventDescriptor420[],
  addresses: Readonly<Record<GrantsEventContract420, Hex>>
): GenesisDescriptor420[] {
  const seen = new Set<GrantsEventContract420>();
  const out = descriptors.map((descriptor) => {
    const address = addresses[descriptor.contractName];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Grants deployment address invalid: ' + descriptor.contractName);
    }
    seen.add(descriptor.contractName);
    return { ...descriptor, contractAddress: address.toLowerCase() as Hex } as GenesisDescriptor420;
  });
  if (seen.size !== GRANTS_EVENT_CONTRACTS_420.length) {
    throw new Error('Grants deployment address set incomplete');
  }
  return out;
}
