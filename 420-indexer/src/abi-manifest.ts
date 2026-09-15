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
