import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { Artifact420, AbiEvent420, GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const TREASURY_EVENT_CONTRACTS_420 = [
  'TreasuryPolicyRegistry420',
  'TreasuryBudgetRegistry420',
  'TreasuryDisbursementRegistry420'
] as const;

export type TreasuryEventContract420 = typeof TREASURY_EVENT_CONTRACTS_420[number];

export interface TreasuryManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}

export interface TreasuryManifestEvent420 {
  name: string;
  signature: string;
  inputs: TreasuryManifestInput420[];
}

export interface TreasuryManifestContract420 {
  contractName: TreasuryEventContract420;
  sourcePath: string;
  events: TreasuryManifestEvent420[];
}

export interface TreasuryArtifactManifest420 {
  schema: '420-treasury-artifact-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Treasury';
  authority: 'artifact_events_only_addresses_resolved_by_deployment';
  contracts: TreasuryManifestContract420[];
}

export interface TreasuryEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: TreasuryEventContract420;
  signature: string;
}

const SUPPORTED_TREASURY_FIELD_KINDS_420 = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

function eventSignature420(event: AbiEvent420): string {
  return `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
}

function artifactEvents420(artifact: Artifact420): AbiEvent420[] {
  return artifact.abi.filter((item): item is AbiEvent420 => (item as AbiEvent420).type === 'event');
}

export function treasuryDescriptorsFromArtifacts420(
  manifest: TreasuryArtifactManifest420,
  artifacts: ReadonlyMap<string, Artifact420>
): TreasuryEventDescriptor420[] {
  if (
    manifest.schema !== '420-treasury-artifact-descriptor-v1' ||
    manifest.descriptorVersion !== 1 ||
    manifest.protocol !== '420Treasury' ||
    manifest.authority !== 'artifact_events_only_addresses_resolved_by_deployment'
  ) throw new Error('Treasury descriptor manifest identity mismatch');

  const manifestNames = manifest.contracts.map((contract) => contract.contractName).sort();
  const canonicalNames = [...TREASURY_EVENT_CONTRACTS_420].sort();
  if (JSON.stringify(manifestNames) !== JSON.stringify(canonicalNames)) {
    throw new Error('Treasury descriptor contract set mismatch');
  }

  const descriptors: TreasuryEventDescriptor420[] = [];
  for (const contract of manifest.contracts) {
    const artifact = artifacts.get(contract.contractName);
    if (!artifact || artifact.contractName !== contract.contractName) {
      throw new Error('Treasury artifact missing or mismatched: ' + contract.contractName);
    }
    const events = artifactEvents420(artifact);
    if (events.length !== contract.events.length) {
      throw new Error('Treasury artifact event count mismatch: ' + contract.contractName);
    }

    const artifactBySignature = new Map(events.map((event) => [eventSignature420(event), event]));
    for (const expected of contract.events) {
      const event = artifactBySignature.get(expected.signature);
      if (!event || event.name !== expected.name) {
        throw new Error('Treasury artifact event missing: ' + contract.contractName + '.' + expected.signature);
      }
      if (event.inputs.length !== expected.inputs.length) {
        throw new Error('Treasury artifact input count mismatch: ' + expected.signature);
      }
      const fields = event.inputs.map((input, index) => {
        const declared = expected.inputs[index]!;
        if (
          input.name !== declared.name ||
          input.type !== declared.type ||
          Boolean(input.indexed) !== declared.indexed ||
          !SUPPORTED_TREASURY_FIELD_KINDS_420.has(input.type as ProtocolFieldKind420)
        ) throw new Error('Treasury artifact input drift: ' + expected.signature + ':' + index);
        return { name: input.name, kind: input.type as ProtocolFieldKind420, indexed: Boolean(input.indexed) };
      });
      descriptors.push({
        protocol: '420Treasury',
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

export function bindTreasuryDescriptors420(
  descriptors: readonly TreasuryEventDescriptor420[],
  addresses: Readonly<Record<TreasuryEventContract420, Hex>>
): GenesisDescriptor420[] {
  const seen = new Set<TreasuryEventContract420>();
  const out = descriptors.map((descriptor) => {
    const address = addresses[descriptor.contractName];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Treasury deployment address invalid: ' + descriptor.contractName);
    }
    seen.add(descriptor.contractName);
    return { ...descriptor, contractAddress: address.toLowerCase() as Hex } as GenesisDescriptor420;
  });
  if (seen.size !== TREASURY_EVENT_CONTRACTS_420.length) {
    throw new Error('Treasury deployment address set incomplete');
  }
  return out;
}
