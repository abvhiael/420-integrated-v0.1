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
}],assets:[{assetId:'420',symbol:'420',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'test'}],routes:[{routeId:'r1',marketSubjectId:id(1),qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'test'}]});
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
 });
});

test('version headers are exact v13.6 and /ready reflects dependency readiness',async()=>{
 const service=new ExchangeReadService({indexer:source({ready:false}),rpc,store:new MemoryProjectionStore().open(),catalogue});
 await withServer(service,async base=>{
   const r=await fetch(base+'/ready');assert.equal(r.status,503);assert.equal(r.headers.get('x-420-api-major'),'13');assert.equal(r.headers.get('x-420-api-minor'),'6');
   assert.equal((await r.json()).ready,false);
 });
});
