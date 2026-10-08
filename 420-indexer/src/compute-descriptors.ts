import { id } from 'ethers';
import type { Artifact420 } from './abi-manifest.js';
import type { Hex } from './chain-source.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const COMPUTE_EVENT_CONTRACTS_420=[
  'ComputeRequestRegistry420','ComputeJobRegistry420','ComputeWorkerRegistry420','ComputeVerifierRegistry420',
  'ComputeResearchProjectRegistry420','ComputeUsefulRewardAccounting420','ComputeWorkerTrust420','ComputeWorkerStake420'
] as const;
export type ComputeEventContract420=typeof COMPUTE_EVENT_CONTRACTS_420[number];
export interface ComputeManifestInput420{name:string;type:ProtocolFieldKind420;indexed:boolean;}
export interface ComputeManifestEvent420{name:string;signature:string;inputs:ComputeManifestInput420[];}
export interface ComputeManifestContract420{contractName:ComputeEventContract420;sourcePath:string;events:ComputeManifestEvent420[];}
export interface ComputeArtifactManifest420{schema:'420-compute-artifact-descriptor-v1';descriptorVersion:1;protocol:'420Compute';authority:'artifact_events_only_addresses_resolved_by_deployment';contracts:ComputeManifestContract420[];}
export interface ComputeEventDescriptor420 extends ProtocolEventDescriptor420{contractName:ComputeEventContract420;signature:string;}
const SUPPORTED=new Set<ProtocolFieldKind420>(['bytes4','bytes8','bytes16','bytes32','address','bool','uint8','uint16','uint32','uint64','uint128','uint256','int256']);
const PRIVATE=/(payload|plaintext|document|dataset|token|secret|credential|privatekey|apikey|inputbytes|outputbytes|rawoutput)/i;
function sig(event:any){return event.name+'('+event.inputs.map((x:any)=>x.type).join(',')+')';}
export function computeDescriptorsFromArtifacts420(manifest:ComputeArtifactManifest420,artifacts:ReadonlyMap<string,Artifact420>):ComputeEventDescriptor420[]{
 if(manifest.schema!=='420-compute-artifact-descriptor-v1'||manifest.descriptorVersion!==1||manifest.protocol!=='420Compute'||manifest.authority!=='artifact_events_only_addresses_resolved_by_deployment') throw new Error('420Compute descriptor manifest identity mismatch');
 const names=manifest.contracts.map(x=>x.contractName).sort(); if(JSON.stringify(names)!==JSON.stringify([...COMPUTE_EVENT_CONTRACTS_420].sort())) throw new Error('420Compute descriptor contract set mismatch');
 const out:ComputeEventDescriptor420[]=[];
 for(const contract of manifest.contracts){const artifact=artifacts.get(contract.contractName);if(!artifact||artifact.contractName!==contract.contractName)throw new Error('420Compute artifact missing: '+contract.contractName);const events=(artifact.abi as any[]).filter(x=>x.type==='event');const bySig=new Map(events.map(e=>[sig(e),e]));
  for(const expected of contract.events){const e:any=bySig.get(expected.signature);if(!e||e.name!==expected.name||e.inputs.length!==expected.inputs.length)throw new Error('420Compute artifact event missing: '+expected.signature);const fields=e.inputs.map((input:any,i:number)=>{const d=expected.inputs[i]!;if(input.name!==d.name||input.type!==d.type||Boolean(input.indexed)!==d.indexed||!SUPPORTED.has(input.type))throw new Error('420Compute artifact input drift: '+expected.signature+':'+i);if(PRIVATE.test(input.name))throw new Error('420Compute private field blocked: '+input.name);return{name:input.name,kind:input.type,indexed:Boolean(input.indexed)};});out.push({protocol:'420Compute',contractName:contract.contractName,eventName:e.name,signature:expected.signature,topic0:id(expected.signature) as Hex,fields});}
 }
 return out.sort((a,b)=>a.contractName.localeCompare(b.contractName)||a.signature.localeCompare(b.signature));
}
export function bindComputeDescriptors420(descriptors:readonly ComputeEventDescriptor420[],addresses:Readonly<Record<ComputeEventContract420,Hex>>){
 const seen=new Set<string>();const out=descriptors.map(d=>{const address=addresses[d.contractName];if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error('420Compute deployment address invalid: '+d.contractName);seen.add(d.contractName);return{...d,contractAddress:address.toLowerCase() as Hex};});if(seen.size!==COMPUTE_EVENT_CONTRACTS_420.length)throw new Error('420Compute deployment address set incomplete');return out;
}
