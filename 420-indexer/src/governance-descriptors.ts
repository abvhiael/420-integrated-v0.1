import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { Artifact420, AbiEvent420, GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const GOVERNANCE_CIVIC_CONTRACTS_420 = [
  'CivicConstitution420',
  'CivicProposalRegistry420',
  'CivicElectorateRegistry420',
  'CivicVoting420',
  'CivicGovernor420'
] as const;

export type GovernanceCivicContract420 = typeof GOVERNANCE_CIVIC_CONTRACTS_420[number];

export interface GovernanceCivicManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}

export interface GovernanceCivicManifestEvent420 {
  name: string;
  signature: string;
  inputs: GovernanceCivicManifestInput420[];
}

export interface GovernanceCivicManifestContract420 {
  contractName: GovernanceCivicContract420;
  sourcePath: string;
  events: GovernanceCivicManifestEvent420[];
}

export interface GovernanceCivicArtifactManifest420 {
  schema: '420-governance-civic-artifact-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Governance';
  authority: 'artifact_events_only_addresses_resolved_by_deployment';
  contracts: GovernanceCivicManifestContract420[];
}

export interface GovernanceCivicEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: GovernanceCivicContract420;
  signature: string;
}

const SUPPORTED_GOVERNANCE_FIELD_KINDS_420 = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

function eventSignature420(event: AbiEvent420): string {
  return `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
}

function artifactEvents420(artifact: Artifact420): AbiEvent420[] {
  return artifact.abi.filter((item): item is AbiEvent420 => (item as AbiEvent420).type === 'event');
}

export function governanceCivicDescriptorsFromArtifacts420(
  manifest: GovernanceCivicArtifactManifest420,
  artifacts: ReadonlyMap<string, Artifact420>
): GovernanceCivicEventDescriptor420[] {
  if (
    manifest.schema !== '420-governance-civic-artifact-descriptor-v1' ||
    manifest.descriptorVersion !== 1 ||
    manifest.protocol !== '420Governance' ||
    manifest.authority !== 'artifact_events_only_addresses_resolved_by_deployment'
  ) throw new Error('Governance Civic descriptor manifest identity mismatch');

  const manifestNames = manifest.contracts.map((contract) => contract.contractName).sort();
  const canonicalNames = [...GOVERNANCE_CIVIC_CONTRACTS_420].sort();
  if (JSON.stringify(manifestNames) !== JSON.stringify(canonicalNames)) {
    throw new Error('Governance Civic descriptor contract set mismatch');
  }

  const descriptors: GovernanceCivicEventDescriptor420[] = [];
  for (const contract of manifest.contracts) {
    const artifact = artifacts.get(contract.contractName);
    if (!artifact || artifact.contractName !== contract.contractName) {
      throw new Error('Governance Civic artifact missing or mismatched: ' + contract.contractName);
    }
    const events = artifactEvents420(artifact);
    if (events.length !== contract.events.length) {
      throw new Error('Governance Civic artifact event count mismatch: ' + contract.contractName);
    }

    const artifactBySignature = new Map(events.map((event) => [eventSignature420(event), event]));
    for (const expected of contract.events) {
      const event = artifactBySignature.get(expected.signature);
      if (!event || event.name !== expected.name) {
        throw new Error('Governance Civic artifact event missing: ' + contract.contractName + '.' + expected.signature);
      }
      if (event.inputs.length !== expected.inputs.length) {
        throw new Error('Governance Civic artifact input count mismatch: ' + expected.signature);
      }
      const fields = event.inputs.map((input, index) => {
        const declared = expected.inputs[index]!;
        if (
          input.name !== declared.name ||
          input.type !== declared.type ||
          Boolean(input.indexed) !== declared.indexed ||
          !SUPPORTED_GOVERNANCE_FIELD_KINDS_420.has(input.type as ProtocolFieldKind420)
        ) throw new Error('Governance Civic artifact input drift: ' + expected.signature + ':' + index);
        return { name: input.name, kind: input.type as ProtocolFieldKind420, indexed: Boolean(input.indexed) };
      });
      descriptors.push({
        protocol: '420Governance',
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

export function bindGovernanceCivicDescriptors420(
  descriptors: readonly GovernanceCivicEventDescriptor420[],
  addresses: Readonly<Record<GovernanceCivicContract420, Hex>>
): GenesisDescriptor420[] {
  const seen = new Set<GovernanceCivicContract420>();
  return descriptors.map((descriptor) => {
    const address = addresses[descriptor.contractName];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Governance Civic deployment address invalid: ' + descriptor.contractName);
    }
    seen.add(descriptor.contractName);
    return { ...descriptor, contractAddress: address.toLowerCase() as Hex };
  }).map((descriptor) => descriptor as GenesisDescriptor420).filter((descriptor, index, all) => {
    if (index === all.length - 1 && seen.size !== GOVERNANCE_CIVIC_CONTRACTS_420.length) {
      throw new Error('Governance Civic deployment address set incomplete');
    }
    return true;
  });
}
