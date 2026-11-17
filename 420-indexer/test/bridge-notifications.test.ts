import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {bridgeTransferDescriptors420,qualifyBridgeNotification420} from '../src/bridge-descriptors.js';
import {NotificationsConsumerAdapter420} from '../src/notifications-adapter.js';
import {IndexerDeliveryQueue420} from '../src/event-delivery.js';
import type {IndexerEventEnvelope420} from '../src/event-stream.js';
import type {ChainSource420,Hex} from '../src/chain-source.js';
const h=(n:number)=>('0x'+n.toString(16).padStart(64,'0')) as Hex;
const registry=('0x'+'11'.repeat(20)) as Hex,transfer=('0x'+'22'.repeat(20)) as Hex;
const abi=new Interface(bridgeTransferDescriptors420(transfer).map(d=>`event ${d.eventName}(${d.fields.map(f=>`${f.kind}${f.indexed?' indexed':''} ${f.name}`).join(',')})`));
const encoded=abi.encodeEventLog(abi.getEvent('TransferStatus')!,[h(1),7]);
const log={address:transfer,blockNumber:10n,blockHash:h(10),transactionHash:h(20),transactionIndex:0,logIndex:1,topics:encoded.topics as Hex[],data:encoded.data as Hex};
const EVENT:IndexerEventEnvelope420={streamVersion:'v1',id:`420evt:v1:420:${h(10)}:${h(20)}:1`,source:'protocol',topic:'420Bridge.TransferStatus',protocol:'420Bridge',eventName:'TransferStatus',objectKey:`transferId:${h(1)}`,lifecycleState:'COMPLETED',fields:{transferId:h(1),status:'7'},provenance:{chainId:'420',blockNumber:'10',blockHash:h(10),transactionHash:h(20),transactionIndex:0,logIndex:1,contractAddress:transfer},authoritative:false};
function fixture(){
 const runtime='0x6000' as Hex,pin={registry,registryRuntimeHash:keccak256(runtime) as Hex};
 const source={async chainId(){return 420n;},async finalizedBlockNumber(){return 10n;},async getBlockByNumber(){return {number:10n,hash:h(10),parentHash:h(9),timestamp:100n};},async getCode(){return runtime;},async call({data}:{data:Hex}){return data.startsWith('0x5c23bdf5')?h(0):('0x'+transfer.slice(2).padStart(64,'0')) as Hex;},async getTransactionReceipt(){return {transactionHash:h(20),blockHash:h(10),blockNumber:10n,transactionIndex:0,status:1 as const,contractAddress:null,logs:[log]};}};
 const regAbi=new Interface(['function resolve(bytes32) view returns(address)','function runtimeCodeHash(bytes32) view returns(bytes32)']);
 source.call=async({data}:{data:Hex})=>regAbi.parseTransaction({data})?.name==='resolve'?regAbi.encodeFunctionResult('resolve',[transfer]) as Hex:regAbi.encodeFunctionResult('runtimeCodeHash',[pin.registryRuntimeHash]) as Hex;
 return {source:source as unknown as ChainSource420,pin};
}
test('bridge notifications require finalized receipt logs from the Registry-qualified historical emitter',async()=>{
 const f=fixture();assert.equal(await qualifyBridgeNotification420(f.source,EVENT,f.pin),true);
 for(const mutation of [{id:'fabricated-id'},{topic:'420Bridge.Refunded'},{lifecycleState:'REFUNDED'},{fields:{...EVENT.fields,status:'13'}},{objectKey:`routeId:${h(1)}`},{provenance:{...EVENT.provenance,contractAddress:registry}},{provenance:{...EVENT.provenance,blockHash:h(11)}}])assert.equal(await qualifyBridgeNotification420(f.source,{...EVENT,...mutation},f.pin),false);
 f.source.finalizedBlockNumber=async()=>9n;assert.equal(await qualifyBridgeNotification420(f.source,EVENT,f.pin),false);
});
test('orphaned and reverted receipts, substituted runtime and unqualified projection claims cannot notify',async()=>{
 for(const mutation of [
 {getCode:async()=> '0x6001' as Hex},
 {getTransactionReceipt:async()=>null},
 {getBlockByNumber:async()=>null},
 {chainId:async()=>421n}
 ]){const f=fixture();Object.assign(f.source,mutation);assert.equal(await qualifyBridgeNotification420(f.source,EVENT,f.pin),false);}
});
test('notification adapter preserves checkpoint on missing or rejected bridge evidence, then resumes with qualified events',async()=>{
 const stream={async protocolEvents(){return {streamVersion:'v1' as const,events:[EVENT],nextCursor:'next',authoritative:false as const};}};
 const binding={subscription:{id:'bridge',enabled:true,protocols:['420Bridge']},delivery:{provider:'push',destination:'device:1'}};
 const blocked=new NotificationsConsumerAdapter420(stream,new IndexerDeliveryQueue420(),[binding]);
 await assert.rejects(blocked.replay(420n),/qualified canonical/);assert.equal(blocked.checkpoint(420n).cursor,null);
 const f=fixture(),qualified=new NotificationsConsumerAdapter420(stream,new IndexerDeliveryQueue420(),[binding],e=>qualifyBridgeNotification420(f.source,e,f.pin));
 assert.equal((await qualified.replay(420n)).enqueued.length,1);assert.equal(qualified.checkpoint(420n).cursor,'next');
});
test('unsubscribed bridge events and non-lifecycle config logs do not block unrelated notification consumers',async()=>{
 const stream={async protocolEvents(){return {streamVersion:'v1' as const,events:[EVENT,{...EVENT,eventName:'RouteSet'}],nextCursor:'next',authoritative:false as const};}};
 const adapter=new NotificationsConsumerAdapter420(stream,new IndexerDeliveryQueue420(),[{subscription:{id:'pay',enabled:true,protocols:['420Pay']},delivery:{provider:'push',destination:'device:1'}}]);
 assert.equal((await adapter.replay(420n)).enqueued.length,0);assert.equal(adapter.checkpoint(420n).cursor,'next');
});
