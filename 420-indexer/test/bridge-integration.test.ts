import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { bridgeTransferDecoder420, bridgeTransferDescriptors420 } from '../src/bridge-descriptors.js';
import { reduceProtocolLifecycle420, protocolObjectKey420 } from '../src/lifecycle-reducer.js';
import type { IndexerLog, Hex } from '../src/chain-source.js';
const addr = ('0x'+'11'.repeat(20)) as Hex;
const h = (n:number) => ('0x'+n.toString(16).padStart(64,'0')) as Hex;
const abi = new Interface(bridgeTransferDescriptors420(addr).map(d => `event ${d.eventName}(${d.fields.map(f=>`${f.kind}${f.indexed?' indexed':''} ${f.name}`).join(',')})`));
const decoder = bridgeTransferDecoder420(addr);
function log(name:string,args:unknown[],block=1):IndexerLog {
 const encoded=abi.encodeEventLog(abi.getEvent(name)!,args);
 return {address:addr,blockNumber:BigInt(block),blockHash:h(block),transactionHash:h(block+100),transactionIndex:0,logIndex:0,topics:encoded.topics as Hex[],data:encoded.data as Hex};
}
function event(name:string,args:unknown[],block=1) {return decoder.decode(log(name,args,block))!;}
test('all five actual transfer events decode with canonical transfer object keys',()=>{
 const samples:Record<string,unknown[]>={TransferCreated:[h(1),h(2),h(3),42n],OutboundTransferCreated:[h(1),h(2),h(3),addr,h(4),h(5),42n],SourceTransactionBound:[h(1),h(5),h(6)],TransferStatus:[h(1),2],TransferTransition:[h(1),2,3,h(6),addr]};
 for(const [name,args] of Object.entries(samples))assert.equal(event(name,args).eventName,name);
 assert.equal(protocolObjectKey420(event('TransferCreated',samples.TransferCreated)),`transferId:${h(1)}`);
});
test('wrong emitter, malformed ABI and removed events cannot become bridge state',()=>{
 const valid=log('TransferStatus',[h(1),2]);
 assert.throws(()=>decoder.decode({...valid,address:('0x'+'22'.repeat(20)) as Hex}),/contract mismatch/);
 assert.throws(()=>decoder.decode({...valid,data:'0x'}),/malformed/);
 assert.throws(()=>decoder.decode({...valid,data:(valid.data+'00') as Hex}),/malformed/);
 assert.throws(()=>decoder.decode({...valid,data:h(256)}),/noncanonical/);
 assert.equal(decoder.decode({...valid,removed:true}),null);
});
test('different transfers on the same route retain independent state',()=>{
 const states=reduceProtocolLifecycle420([event('TransferCreated',[h(1),h(9),h(3),42n]),event('TransferCreated',[h(2),h(9),h(3),42n],2),event('TransferStatus',[h(1),7],3)]);
 assert.equal(states.length,2);assert.equal(states[0].state,'COMPLETED');assert.equal(states[1].state,'CREATED');
});
test('workflow failures can recover; only completed and refunded outcomes are terminal',()=>{
 for(const status of [8,9,10,11,12]){
 const states=reduceProtocolLifecycle420([event('TransferStatus',[h(1),status]),event('TransferStatus',[h(1),6],2)]);
 assert.equal(states[0].state,'DESTINATION_PENDING');assert.equal(states[0].terminal,false);
 }
 for(const status of [7,13]){
 const states=reduceProtocolLifecycle420([event('TransferStatus',[h(1),status]),event('TransferStatus',[h(1),6],2)]);
 assert.equal(states[0].terminal,true);assert.equal(states[0].blockNumber,1n);
 }
});
test('rebuilding canonical history after a reorg removes orphaned completion',()=>{
 const pending=event('TransferStatus',[h(1),6]),complete=event('TransferStatus',[h(1),7],2);
 assert.equal(reduceProtocolLifecycle420([pending,complete])[0].state,'COMPLETED');
 assert.equal(reduceProtocolLifecycle420([pending])[0].state,'DESTINATION_PENDING');
 assert.equal(reduceProtocolLifecycle420([pending,event('TransferStatus',[h(1),8],2)])[0].state,'FAILED');
});
