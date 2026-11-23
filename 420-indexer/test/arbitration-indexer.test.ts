import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interface} from 'ethers';
import type {Artifact420} from '../src/abi-manifest.js';
import type {Hex} from '../src/chain-source.js';
import {ProtocolDecoderRegistry420} from '../src/protocol-decoder.js';
import {
 arbitrationDescriptorsFromManifest420,ARBITRATION_INDEXER_EVENT_SIGNATURES_420,
 type ArbitrationIndexerManifest420,type ArbitrationIndexerDeployment420
} from '../src/arbitration-indexer.js';
import {replayArbitrationCase420,type ArbitrationHistoryEntry420} from '../src/arbitration-read-model.js';

const h=(n:number):Hex=>('0x'+n.toString(16).padStart(64,'0')) as Hex;
const a=(n:number):Hex=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const id=h(500),claimant=a(100),respondent=a(101),resolver=a(102),appealResolver=a(103);
const caseAddress=a(201),rulingAddress=a(202);
export const arbitrationManifestFixture420=JSON.parse(readFileSync(new URL('../descriptors/arbitration420-v1.json',import.meta.url),'utf8')) as ArbitrationIndexerManifest420;
export const arbitrationArtifactsFixture420=new Map<string,Artifact420>(
 arbitrationManifestFixture420.contracts.map(c=>[c.contractName,{
  contractName:c.contractName,
  abi:c.events.map(e=>({type:'event' as const,name:e.name,inputs:e.inputs.map(x=>({...x}))}))
 }]));
export const arbitrationDeploymentFixture420:ArbitrationIndexerDeployment420={
 chainId:420n,genesisHash:h(1),registryAddress:a(0x434),version:1,
 verificationBlock:7n,verificationBlockHash:h(8),router:a(200),routerCodeHash:h(300),
 dependencyRoot:h(301),
 addresses:{ArbitrationCaseRegistry420:caseAddress,ArbitrationRulingRegistry420:rulingAddress},
 runtimeHashes:{ArbitrationCaseRegistry420:h(302),ArbitrationRulingRegistry420:h(303)}
};
export const arbitrationEventsFixture420=arbitrationDescriptorsFromManifest420(
 arbitrationManifestFixture420,arbitrationArtifactsFixture420,arbitrationDeploymentFixture420);
export function sampleHistory420():ArbitrationHistoryEntry420[]{
 const row=(eventName:string,fields:Record<string,string>,block:number,log=0,tx=block):ArbitrationHistoryEntry420=>({
  eventName,caseId:id,round:eventName==='CaseOpened'?0:Number(fields.round),
  fields,blockNumber:String(block),blockHash:h(1000+block),transactionHash:h(2000+tx),
  transactionIndex:0,logIndex:log,
  contractAddress:['RulingSubmitted','RulingFinalized'].includes(eventName)?rulingAddress:caseAddress
 });
 const base={caseId:id};
 return [
  row('CaseOpened',{...base,domainId:h(10),claimant,respondent,
   originComponentId:h(11),originObjectId:h(12)},1),
  row('EvidenceCommitted',{...base,round:'0',submitter:claimant,evidenceHash:h(13)},2),
  row('CaseRuled',{...base,round:'0',appealDeadline:'1000'},3,0),
  row('RulingSubmitted',{...base,round:'0',resolver,outcomeCode:'1',
   rulingHash:h(14),remedyCommitment:h(15),panelCommitment:h(0)},3,1),
  row('CaseAppealed',{...base,round:'1',appellant:respondent,evidenceDeadline:'1200'},4),
  row('EvidenceCommitted',{...base,round:'1',submitter:respondent,evidenceHash:h(16)},5),
  row('CaseRuled',{...base,round:'1',appealDeadline:'1600'},6,0),
  row('RulingSubmitted',{...base,round:'1',resolver:appealResolver,outcomeCode:'2',
   rulingHash:h(17),remedyCommitment:h(18),panelCommitment:h(0)},6,1),
  row('CaseFinalized',{...base,round:'1'},7,0),
  row('RulingFinalized',{...base,round:'1',rulingHash:h(17),remedyCommitment:h(18)},7,1)
 ];
}
test('Foundry-compiled real Arbitration contract ABI matches required descriptor without manual guesses',
 {skip:!process.env.ARBITRATION_FOUNDRY_ARTIFACTS},()=>{
  const base=process.env.ARBITRATION_FOUNDRY_ARTIFACTS!;
  const compiled=new Map<string,Artifact420>();
  for(const {contractName} of arbitrationManifestFixture420.contracts){
   const artifact=JSON.parse(readFileSync(base+'/'+contractName+'.sol/'+contractName+'.json','utf8'));
   compiled.set(contractName,{contractName,abi:artifact.abi});
  }
  const descriptors=arbitrationDescriptorsFromManifest420(arbitrationManifestFixture420,
   compiled,arbitrationDeploymentFixture420);
  assert.equal(descriptors.length,7);
  assert.deepEqual(descriptors.map(x=>x.topic0).sort(),
   arbitrationEventsFixture420.map(x=>x.topic0).sort());
});

test('exact Arbitration descriptor contains seven ABI-verified canonical events only',()=>{
 assert.equal(arbitrationEventsFixture420.length,7);
 assert.deepEqual(arbitrationManifestFixture420.contracts.map(c=>c.events.length),[5,2]);
 for(const [name,signatures] of Object.entries(ARBITRATION_INDEXER_EVENT_SIGNATURES_420)){
  assert.deepEqual(arbitrationEventsFixture420.filter(d=>d.contractName===name)
   .map(d=>d.signature).sort(),[...signatures].sort());
 }
 const drift=structuredClone(arbitrationManifestFixture420);
 drift.contracts[0]!.events[1]!.inputs[3]!.type='address';
 assert.throws(()=>arbitrationDescriptorsFromManifest420(drift,arbitrationArtifactsFixture420,
  arbitrationDeploymentFixture420),/drift/);
 const missing=structuredClone(arbitrationManifestFixture420);
 missing.contracts[1]!.events.pop();
 assert.throws(()=>arbitrationDescriptorsFromManifest420(missing,arbitrationArtifactsFixture420,
  arbitrationDeploymentFixture420),/count/);
});
test('strict canonical decoder recovers exact indexed and non-indexed ABI and rejects wrong emitter',()=>{
 const decoders=new ProtocolDecoderRegistry420(arbitrationEventsFixture420);
 for(const e of sampleHistory420()){
  const descriptor=arbitrationEventsFixture420.find(d=>d.eventName===e.eventName)!;
  const input=arbitrationManifestFixture420.contracts.flatMap(c=>c.events).find(x=>x.name===e.eventName)!;
  const iface=new Interface([{type:'event',name:e.eventName,inputs:input.inputs}]);
  const fragment=iface.getEvent(e.eventName)!;
  const values=input.inputs.map(f=>e.fields[f.name]);
  const encoded=iface.encodeEventLog(fragment,values);
  const log={address:e.contractAddress as Hex,blockNumber:BigInt(e.blockNumber),
   blockHash:e.blockHash as Hex,transactionHash:e.transactionHash as Hex,
   transactionIndex:e.transactionIndex,logIndex:e.logIndex,
   topics:encoded.topics as Hex[],data:encoded.data as Hex};
  const decoded=decoders.decode(log)!;
  assert.equal(decoded.eventName,e.eventName);
  assert.equal(decoded.fields.caseId,id);
  assert.equal(decoded.transactionHash,e.transactionHash);
  assert.equal(descriptor.topic0,encoded.topics[0]);
  assert.throws(()=>decoders.decode({...log,address:a(900)}),/contract mismatch/);
  assert.throws(()=>decoders.decode({...log,topics:encoded.topics.slice(0,2) as Hex[]}),/malformed canonical Arbitration log/);
  assert.throws(()=>decoders.decode({...log,data:'0x' as Hex}),/malformed canonical Arbitration log/);
 }
});
test('deterministic full canonical history reconstruction and repeated duplicate delivery',()=>{
 const events=sampleHistory420();
 const state=replayArbitrationCase420(events);
 assert.equal(state?.state,'FINALIZED');
 assert.equal(state?.round,1);
 assert.equal(state?.evidenceCount,2);
 assert.equal(state?.appeals,1);
 assert.equal(state?.outcomeCode,'2');
 assert.equal(state?.rulingHash,h(17));
 assert.equal(state?.remedyCommitment,h(18));
 assert.equal(state?.authoritative,false);
 assert.deepEqual(replayArbitrationCase420([...events].reverse()),state);
 assert.deepEqual(replayArbitrationCase420([...events,structuredClone(events[1]!)]),state);
 assert.deepEqual(replayArbitrationCase420(events.slice(0,2))?.state,'OPEN');
 assert.deepEqual(replayArbitrationCase420(events.slice(0,4))?.state,'RULED');
});
test('reject missing, corrupted, contradictory or cross-case canonical event timelines',()=>{
 const events=sampleHistory420();
 const mutation=(n:number,modify:(entry:ArbitrationHistoryEntry420)=>void)=>{
  const altered=structuredClone(events);modify(altered[n]!);return altered;
 };
 const invalid=[
  events.slice(1),
  events.filter(e=>e.eventName!=='CaseOpened'),
  events.filter(e=>e.eventName!=='RulingSubmitted'),
  events.filter(e=>e.eventName!=='RulingFinalized'),
  mutation(2,e=>{e.round=1;e.fields.round='1';}),
  mutation(3,e=>{e.transactionHash=h(777);}),
  mutation(4,e=>{e.fields.appellant=a(444);}),
  mutation(5,e=>{e.caseId=h(999);}),
  mutation(9,e=>{e.fields.rulingHash=h(999);}),
  mutation(8,e=>{e.round=0;e.fields.round='0';}),
  mutation(1,e=>{e.fields.evidenceHash=h(0);}),
  [...events,structuredClone(events[1]!),structuredClone(events[1]!)],
 ];
 for(const input of invalid){
  // Idempotent exact duplicates are allowed, not contradictory event content.
  if(input.length===12&&input.at(-1)?.eventName==='EvidenceCommitted')continue;
  assert.throws(()=>replayArbitrationCase420(input));
 }
 const conflicting=structuredClone(events[1]!);
 conflicting.fields.evidenceHash=h(777);
 assert.throws(()=>replayArbitrationCase420([...events,conflicting]),/conflicting duplicate/);
 const substitute=structuredClone(events[1]!);
 substitute.blockNumber='10';substitute.blockHash=h(1010);
 substitute.transactionHash=h(2010);substitute.logIndex=0;
 assert.throws(()=>replayArbitrationCase420([...events,substitute]),/duplicate evidence/);
});
