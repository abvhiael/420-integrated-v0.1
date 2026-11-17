import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {ExchangeClient} from '../../web/core/exchange-client.js';
import {validateCatalogue} from '../src/catalogue.mjs';
import {MemoryProjectionStore} from '../src/projection-store.mjs';
import {ExchangeReadService} from '../src/service.mjs';
import {createExchangeReadHttpServer} from '../src/http.mjs';

const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const catalogue=validateCatalogue({schema:'420-exchange-catalogue-v1',version:1,markets:[{
  marketSubjectId:id(1),canonicalMarketId:id(11),marketLabel:'420 / TEST',baseSymbol:'420',quoteSymbol:'TEST',
  qualification:'DISPLAY_ONLY_QUALIFIED_METADATA',routeHealthy:true,settlementHealthy:true,source:'test-catalogue'
}],assets:[{assetId:'420',symbol:'420',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'test'}],routes:[{routeId:'r1',marketSubjectId:id(1),qualification:'DISPLAY_ONLY_QUALIFIED_METADATA',source:'test',bridge:{
  exchangeAssetId:id(70),localToken:addr(70),canonicalAsset:id(71),sourceChain:'ethereum:1',destinationChain:'420:1056',
  sourceAssetId:id(72),destinationAssetId:id(73),adapterId:id(74),adapterAddress:addr(74),verifierId:id(75),
  provenanceHash:id(76),verificationHash:id(76),direction:'OUTBOUND',qualified:true,representationActive:true,
  canonicalRepresentation:true,routeActive:true,directionEnabled:true,adapterLive:true,adapterMatches:true,
  verifierConfigured:true,settlementHealthy:true,paused:false,bridgeFee:0,routeLimit:'1000',assetLimit:'10000'
}}]});
function event({eventName='AtomicPathExecuted',blockNumber='10',blockHash=id(20),tx=id(30),logIndex=0,fields={},protocol='420Exchange'}={}){
 return {chainId:'1056',blockNumber,blockHash,transactionHash:tx,transactionIndex:0,logIndex,contractAddress:addr(99),protocol,eventName,objectKey:null,lifecycleState:null,fields};
}
function source({events=[],stale=false,ready=true}={}){
 return {
   async readiness(){return {ready,databaseReady:true,chainId:'1056',indexedHead:'12',runtime:{stale,readinessReason:stale?'stale_ingest':null}};},
   async status(){return {chainId:'1056',indexedHead:'12',indexedHeadHash:id(50),indexedHeadTimestamp:'1000',finality:{mode:'safe',confirmations:null,safeHead:'12'},lag:'0',runtime:{stale,readinessReason:stale?'stale_ingest':null},authoritative:false};},
   async protocolEvents({protocol}){return {items:events.filter(e=>e.protocol===protocol),nextCursor:''};},
 };
}
const rpc={async health(){return {ok:true,chainId:'1056'};}};

async function withServer(service,fn){
 const server=createExchangeReadHttpServer(service);server.listen(0,'127.0.0.1');await once(server,'listening');
 try{return await fn('http://127.0.0.1:'+server.address().port);}
 finally{server.close();await once(server,'close');}
}

test('browser ExchangeClient and server adapter pass the same V13 snapshot/history contract',async()=>{
 const events=[
   event({eventName:'SnapshotApplied',fields:{marketSubjectId:id(1),snapshotId:id(2),windowEnd:999,sourceSetHash:id(3)}}),
   event({eventName:'AtomicPathExecuted',tx:id(31),logIndex:1,fields:{pathHash:id(4),recipient:addr(7),amountIn:100,amountOut:90}}),
 ];
 const service=new ExchangeReadService({indexer:source({events}),rpc,store:new MemoryProjectionStore().open(),catalogue,nowSeconds:()=>1000});
 await withServer(service,async base=>{
   const client=new ExchangeClient({baseUrl:base});
   const snap=await client.snapshot(id(1));
   assert.equal(snap.snapshotId,id(2));assert.equal(snap.canonicalHead,12);assert.equal(snap.provenance.authoritative,false);
   const page=await client.history({kind:'TRADE',activeOnly:false});
   assert.equal(page.records.length,1);assert.equal(page.records[0].provenance.source,'420Indexer/v1');assert.equal(page.records[0].active,true);
   const bridge=await client.bridge();
   assert.equal(bridge.routes.length,1);assert.equal(bridge.routes[0].routeId,'r1');
   assert.equal(bridge.routes[0].freshness,'canonical');assert.equal(bridge.provenance.rpcFallbackReady,true);
 });
});

test('version headers are exact v13.6 and /ready reflects dependency readiness',async()=>{
 const service=new ExchangeReadService({indexer:source({ready:false}),rpc,store:new MemoryProjectionStore().open(),catalogue});
 await withServer(service,async base=>{
   const r=await fetch(base+'/ready');assert.equal(r.status,503);assert.equal(r.headers.get('x-420-api-major'),'13');assert.equal(r.headers.get('x-420-api-minor'),'6');
   assert.equal((await r.json()).ready,false);
 });
});

test('Bridge admission is not completion and reorged completion cannot survive replacement history',async()=>{
 const transfer=id(420),route='r1';const events=[
  event({protocol:'420Bridge',eventName:'TransferCreated',fields:{transferId:transfer,routeId:route,assetId:id(70),amount:100}}),
  event({protocol:'420Bridge',eventName:'InboundAccepted',logIndex:1,fields:{transferId:transfer,adapterId:id(74)}}),
  event({protocol:'420Bridge',eventName:'TransferStatus',blockNumber:'11',tx:id(33),fields:{transferId:transfer,status:6}})
 ];
 const store=new MemoryProjectionStore().open(),service=new ExchangeReadService({indexer:source({events}),rpc,store,catalogue,nowSeconds:()=>1000});
 await withServer(service,async base=>{
  const client=new ExchangeClient({baseUrl:base});let surface=await client.bridge();
  assert.equal(surface.settlements.length,1);assert.equal(surface.settlements[0].state,'DESTINATION_PENDING');assert.equal(surface.provenance.authoritative,false);assert.equal(surface.routes[0].executionQualified,false);
  const completion=event({protocol:'420Bridge',eventName:'TransferStatus',blockNumber:'12',blockHash:id(60),tx:id(34),fields:{transferId:transfer,status:7}});events.push(completion);
  surface=await client.bridge();assert.equal(surface.settlements[0].state,'COMPLETED');assert.equal(surface.settlements[0].finality,'safe');
  assert.equal(store.values().filter(r=>r.active&&r.eventName==='TransferStatus').length,2,'distinct canonical state changes must not replace each other');
  events.pop();events.push(event({protocol:'420Bridge',eventName:'TransferStatus',blockNumber:'12',blockHash:id(61),tx:id(35),fields:{transferId:transfer,status:9}}));
  surface=await client.bridge();assert.equal(surface.settlements[0].state,'RETRYABLE');assert.equal(surface.settlements[0].retryable,true);assert.equal(store.values().find(r=>r.txHash===completion.transactionHash).active,false);
 });
});
test('Bridge fallback unavailability fails closed without manufacturing a projection',async()=>{
 const service=new ExchangeReadService({indexer:source(),rpc:{async health(){return{ok:false};}},store:new MemoryProjectionStore().open(),catalogue});
 await assert.rejects(service.bridgeSurface(),/fallback unavailable/);
});
