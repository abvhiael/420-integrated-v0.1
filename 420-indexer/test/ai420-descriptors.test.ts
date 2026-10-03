import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Artifact420 } from '../src/abi-manifest.js';
import type { Hex } from '../src/chain-source.js';
import { AI_EVENT_CONTRACTS_420, aiDescriptorsFromArtifacts420, bindAiDescriptors420, type AiArtifactManifest420, type AiEventContract420 } from '../src/ai-descriptors.js';

const manifest=JSON.parse(readFileSync(new URL('../descriptors/ai420-v1.json',import.meta.url),'utf8')) as AiArtifactManifest420;
function artifacts():ReadonlyMap<string,Artifact420>{return new Map(manifest.contracts.map((c)=>[c.contractName,{contractName:c.contractName,abi:c.events.map((e)=>({type:'event' as const,name:e.name,anonymous:false,inputs:e.inputs.map((i)=>({...i}))}))}]));}

test('420AI descriptor covers provider/model/deployment/job/escrow/policy read families without private fields',()=>{
 const descriptors=aiDescriptorsFromArtifacts420(manifest,artifacts());
 assert.equal(descriptors.length,27);
 assert.deepEqual([...new Set(descriptors.map((d)=>d.contractName))].sort(),[...AI_EVENT_CONTRACTS_420].sort());
 assert.equal(descriptors.every((d)=>d.protocol==='420AI'),true);
 assert.equal(descriptors.flatMap((d)=>d.fields).some((f)=>/(payload|prompt|secret|token|credential)/i.test(f.name)),false);
});
test('420AI descriptor deployment binding requires complete valid address identities',()=>{
 const descriptors=aiDescriptorsFromArtifacts420(manifest,artifacts());
 const addresses=Object.fromEntries(AI_EVENT_CONTRACTS_420.map((name,i)=>[name,`0x${(i+500).toString(16).padStart(40,'0')}` as Hex])) as Record<AiEventContract420,Hex>;
 assert.equal(bindAiDescriptors420(descriptors,addresses).length,descriptors.length);
 assert.throws(()=>bindAiDescriptors420(descriptors,{...addresses,AIJobManager:'0x1234' as Hex}),/deployment address invalid/);
});
test('420AI descriptor fails on canonical ABI drift',()=>{
 const a=new Map(artifacts());const original=a.get('AIJobManager')!;
 a.set('AIJobManager',{...original,abi:original.abi.map((item)=>((item as {name?:string}).name==='ComputeMatched'?{...(item as any),inputs:(item as any).inputs.map((x:any,i:number)=>i===0?{...x,indexed:false}:x)}:item))});
 assert.throws(()=>aiDescriptorsFromArtifacts420(manifest,a),/artifact input drift/);
});
