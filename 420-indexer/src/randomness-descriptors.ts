import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const RANDOMNESS_REGISTRY_ADDRESS_420 =
  '0x0000000000000000000000000000000000000428' as Hex;

export type RandomnessEventContract420 = 'RandomnessRegistry' | 'RandomnessRouter420';

export interface RandomnessManifestInput420 {
  name: string;
  type: ProtocolFieldKind420;
  indexed: boolean;
}

export interface RandomnessManifestEvent420 {
  name: string;
  signature: string;
  inputs: RandomnessManifestInput420[];
}

export interface RandomnessManifestContract420 {
  contractName: RandomnessEventContract420;
  sourcePath: string;
  addressPolicy:
    | 'FROZEN_0x0000000000000000000000000000000000000428'
    | 'PROTOCOL_REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS';
  events: RandomnessManifestEvent420[];
}

export interface RandomnessReleaseDescriptor420 {
  schema: '420-randomness-release-descriptor-v1';
  descriptorVersion: 1;
  protocol: '420Randomness';
  protocolVersion: 1;
  authority: 'repository_descriptor_only_live_router_address_resolved_by_protocol_registry';
  contracts: RandomnessManifestContract420[];
}

export interface RandomnessEventDescriptor420 extends ProtocolEventDescriptor420 {
  contractName: RandomnessEventContract420;
  signature: string;
}

const SUPPORTED = new Set<ProtocolFieldKind420>([
  'bytes4','bytes8','bytes16','bytes32','address','bool',
  'uint8','uint16','uint32','uint64','uint128','uint256'
]);

const EXPECTED: Readonly<Record<RandomnessEventContract420, readonly string[]>> = {
  RandomnessRegistry: [
    'RandomnessRouterBound(address)',
    'RandomnessRequested(bytes32,bytes32,uint64)',
    'RandomnessFulfilled(bytes32,bytes32,bytes32,bytes32,uint64)'
  ],
  RandomnessRouter420: [
    'RandomnessRequestCreated(bytes32,address,bytes32,uint32,bytes32,bytes32,bytes32,bytes32,uint64,uint64,uint8,uint8)',
    'RandomnessFallbackActivated(bytes32,bytes32)',
    'RandomnessRequestVoided(bytes32)',
    'RandomnessResolved(bytes32,bytes32,bytes32,bytes32)'
  ]
};

export function randomnessDescriptors420(
  manifest: RandomnessReleaseDescriptor420
): RandomnessEventDescriptor420[] {
  if (
    manifest.schema !== '420-randomness-release-descriptor-v1' ||
    manifest.descriptorVersion !== 1 ||
    manifest.protocol !== '420Randomness' ||
    manifest.protocolVersion !== 1 ||
    manifest.authority !== 'repository_descriptor_only_live_router_address_resolved_by_protocol_registry'
  ) throw new Error('Randomness descriptor manifest identity mismatch');

  const contracts = new Map(manifest.contracts.map((contract) => [contract.contractName, contract]));
  if (contracts.size !== 2 || !contracts.has('RandomnessRegistry') || !contracts.has('RandomnessRouter420')) {
    throw new Error('Randomness descriptor contract set mismatch');
  }

  const registry = contracts.get('RandomnessRegistry')!;
  const router = contracts.get('RandomnessRouter420')!;
  if (
    registry.sourcePath !== 'contracts/src/randomness/RandomnessRegistry.sol' ||
    registry.addressPolicy !== 'FROZEN_0x0000000000000000000000000000000000000428'
  ) throw new Error('RandomnessRegistry descriptor authority drift');
  if (
    router.sourcePath !== 'contracts/src/randomness/RandomnessRouter420.sol' ||
    router.addressPolicy !== 'PROTOCOL_REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS'
  ) throw new Error('RandomnessRouter descriptor authority drift');

  const out: RandomnessEventDescriptor420[] = [];
  for (const contract of [registry, router]) {
    const expected = new Set(EXPECTED[contract.contractName]);
    if (contract.events.length !== expected.size) {
      throw new Error('Randomness descriptor event count mismatch: ' + contract.contractName);
    }
    for (const event of contract.events) {
      const signature = event.name + '(' + event.inputs.map((input) => input.type).join(',') + ')';
      if (signature !== event.signature || !expected.delete(signature)) {
        throw new Error('Randomness descriptor event drift: ' + contract.contractName + '.' + event.name);
      }
      for (const input of event.inputs) {
        if (!input.name || !SUPPORTED.has(input.type) || typeof input.indexed !== 'boolean') {
          throw new Error('Randomness descriptor input drift: ' + event.signature);
        }
      }
      out.push({
        protocol: '420Randomness',
        contractName: contract.contractName,
        eventName: event.name,
        signature,
        topic0: id(signature) as Hex,
        fields: event.inputs.map((input) => ({
          name: input.name,
          kind: input.type,
          indexed: input.indexed
        }))
      });
    }
    if (expected.size !== 0) throw new Error('Randomness descriptor required event missing: ' + contract.contractName);
  }

  out.sort((a,b) => a.contractName.localeCompare(b.contractName) || a.signature.localeCompare(b.signature));
  return out;
}

export function bindRandomnessDescriptors420(
  descriptors: readonly RandomnessEventDescriptor420[],
  routerAddress: Hex
): ProtocolEventDescriptor420[] {
  if (!/^0x[0-9a-fA-F]{40}$/.test(routerAddress) || /^0x0{40}$/i.test(routerAddress)) {
    throw new Error('RandomnessRouter deployment address invalid');
  }
  if (routerAddress.toLowerCase() === RANDOMNESS_REGISTRY_ADDRESS_420) {
    throw new Error('RandomnessRouter cannot equal RandomnessRegistry predeploy');
  }

  return descriptors.map((descriptor) => ({
    ...descriptor,
    contractAddress: descriptor.contractName === 'RandomnessRegistry'
      ? RANDOMNESS_REGISTRY_ADDRESS_420
      : routerAddress.toLowerCase() as Hex
  }));
}
