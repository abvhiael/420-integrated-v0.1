import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { Artifact420, AbiEvent420, GenesisDescriptor420 } from './abi-manifest.js';
import type { ProtocolEventDescriptor420, ProtocolFieldKind420 } from './protocol-decoder.js';

export const AI_EVENT_CONTRACTS_420 = [
  'AIProviderRegistry','AIModelRegistry','AIModelDeploymentRegistry420',
  'AIJobManager','AIJobEscrow','AIPolicyRegistry420'
] as const;
export type AiEventContract420 = typeof AI_EVENT_CONTRACTS_420[number];

export interface AiManifestInput420 { name:string; type:ProtocolFieldKind420; indexed:boolean; }
export interface AiManifestEvent420 { name:string; signature:string; inputs:AiManifestInput420[]; }
export interface AiManifestContract420 { contractName:AiEventContract420; sourcePath:string; events:AiManifestEvent420[]; }
export interface AiArtifactManifest420 {
  schema:'420-ai-artifact-descriptor-v1'; descriptorVersion:1; protocol:'420AI';
  authority:'artifact_events_only_addresses_resolved_by_deployment'; contracts:AiManifestContract420[];
}
export interface AiEventDescriptor420 extends ProtocolEventDescriptor420 { contractName:AiEventContract420; signature:string; }

const SUPPORTED=new Set<ProtocolFieldKind420>(['bytes4','bytes8','bytes16','bytes32','address','bool','uint8','uint16','uint32','uint64','uint128','uint256']);
const PRIVATE_FIELD=/(payload|plaintext|prompt|document|dataset|token|secret|credential|privatekey|apikey|inputbytes|outputbytes|rawoutput)/i;
const signature=(event:AbiEvent420)=>`${event.name}(${event.inputs.map((input)=>input.type).join(',')})`;
const artifactEvents=(artifact:Artifact420)=>artifact.abi.filter((item):item is AbiEvent420=>(item as AbiEvent420).type==='event');

export function aiDescriptorsFromArtifacts420(manifest:AiArtifactManifest420,artifacts:ReadonlyMap<string,Artifact420>):AiEventDescriptor420[]{
  if(manifest.schema!=='420-ai-artifact-descriptor-v1'||manifest.descriptorVersion!==1||manifest.protocol!=='420AI'||manifest.authority!=='artifact_events_only_addresses_resolved_by_deployment') throw new Error('420AI descriptor manifest identity mismatch');
  const names=manifest.contracts.map((c)=>c.contractName).sort();
  if(JSON.stringify(names)!==JSON.stringify([...AI_EVENT_CONTRACTS_420].sort())) throw new Error('420AI descriptor contract set mismatch');
  const out:AiEventDescriptor420[]=[];
  for(const contract of manifest.contracts){
    const artifact=artifacts.get(contract.contractName);
    if(!artifact||artifact.contractName!==contract.contractName) throw new Error('420AI artifact missing or mismatched: '+contract.contractName);
    const bySignature=new Map(artifactEvents(artifact).map((event)=>[signature(event),event]));
    for(const expected of contract.events){
      const event=bySignature.get(expected.signature);
      if(!event||event.name!==expected.name||event.inputs.length!==expected.inputs.length) throw new Error('420AI artifact event missing: '+contract.contractName+'.'+expected.signature);
      const fields=event.inputs.map((input,index)=>{
        const declared=expected.inputs[index]!;
        if(input.name!==declared.name||input.type!==declared.type||Boolean(input.indexed)!==declared.indexed||!SUPPORTED.has(input.type as ProtocolFieldKind420)) throw new Error('420AI artifact input drift: '+expected.signature+':'+index);
        if(PRIVATE_FIELD.test(input.name)) throw new Error('420AI private field cannot enter index descriptor: '+input.name);
        return {name:input.name,kind:input.type as ProtocolFieldKind420,indexed:Boolean(input.indexed)};
      });
      out.push({protocol:'420AI',contractName:contract.contractName,eventName:event.name,signature:expected.signature,topic0:id(expected.signature) as Hex,fields});
    }
  }
  out.sort((a,b)=>a.contractName.localeCompare(b.contractName)||a.signature.localeCompare(b.signature));
  return out;
}

export function bindAiDescriptors420(descriptors:readonly AiEventDescriptor420[],addresses:Readonly<Record<AiEventContract420,Hex>>):GenesisDescriptor420[]{
  const seen=new Set<AiEventContract420>();
  const out=descriptors.map((descriptor)=>{
    const address=addresses[descriptor.contractName];
    if(!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('420AI deployment address invalid: '+descriptor.contractName);
    seen.add(descriptor.contractName);
    return {...descriptor,contractAddress:address.toLowerCase() as Hex} as GenesisDescriptor420;
  });
  if(seen.size!==AI_EVENT_CONTRACTS_420.length) throw new Error('420AI deployment address set incomplete');
  return out;
}
