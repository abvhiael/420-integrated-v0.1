import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Interface } from 'ethers';
import { resourceEventArtifacts420, RESOURCE_EVENT_CONTRACTS_420 } from '../src/resource-indexer.js';
import { descriptorsFromArtifact420 } from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import type { Hex, IndexerLog } from '../src/chain-source.js';

test('Resource retained event descriptors exactly match compiler evidence and reject spoofed/malformed logs', async()=>{
 const artifacts=await resourceEventArtifacts420();
 let count=0;
 for(const [i,name] of RESOURCE_EVENT_CONTRACTS_420.entries()){
  const artifact=artifacts.get(name)!;
  const original=JSON.parse(await readFile(new URL('../../../docs/audit/420RESOURCE-8A2-artifacts/after/'+name+'.json',import.meta.url),'utf8'));
  assert.deepEqual(artifact.abi,original.abi.filter((a:{type:string})=>a.type==='event'));
  const address=('0x'+(i+1).toString(16).padStart(40,'0')) as Hex;
  const descriptors=descriptorsFromArtifact420('420Resource',{name,address,artifact:name},artifact);
  const decoder=new ProtocolDecoderRegistry420(descriptors);
  const abi=new Interface(artifact.abi as ConstructorParameters<typeof Interface>[0]);
  for(const d of descriptors){
   const vals=d.fields.map(f=>f.kind==='address'?address:f.kind==='bool'?true:f.kind.startsWith('uint')?(1n<<BigInt(f.kind.slice(4)))-1n:'0x'+'ab'.repeat(32));
   const encoded=abi.encodeEventLog(abi.getEvent(d.signature)!,vals);
   const log:IndexerLog={address,blockNumber:1n,blockHash:('0x'+'11'.repeat(32)) as Hex,transactionHash:('0x'+'22'.repeat(32)) as Hex,transactionIndex:0,logIndex:count,topics:encoded.topics as Hex[],data:encoded.data as Hex};
   const decoded=decoder.decode(log);
   assert.equal(decoded?.eventName,d.eventName);
   for(const [j,f] of d.fields.entries())assert.equal(decoded?.fields[f.name],vals[j]);
   assert.equal(decoder.decode({...log,address:('0x'+'ff'.repeat(20)) as Hex}),null);
   assert.equal(decoder.decode({...log,removed:true}),null);
   assert.throws(()=>decoder.decode({...log,data:(log.data+'00') as Hex}));
   assert.throws(()=>decoder.decode({...log,transactionIndex:-1}));
   assert.throws(()=>new ProtocolDecoderRegistry420([{...d,contractAddress:undefined}]));
   count++;
  }
 }
 assert.equal(count,44);
});
