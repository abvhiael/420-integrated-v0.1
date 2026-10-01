import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalogue} from '../src/catalogue.mjs';
import {MemoryProjectionStore} from '../src/projection-store.mjs';
import {ExchangeReadService} from '../src/service.mjs';

const catalogue=validateCatalogue({schema:'420-exchange-catalogue-v1',version:1,markets:[{marketSubjectId:'m1',canonicalMarketId:null,marketLabel:'420 / X',baseSymbol:'420',quoteSymbol:'X',qualification:'DISPLAY_ONLY_UNQUALIFIED',routeHealthy:false,settlementHealthy:false,source:'test'}],assets:[{assetId:'420',symbol:'420',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'test'}],routes:[{routeId:'r1',marketSubjectId:'m1',qualification:'DISPLAY_ONLY_UNQUALIFIED',source:'test'}]});
const rpc={async health(){return {ok:true,chainId:'1056'};}};
function source({stale=false,events=[]}={}){
 return {async readiness(){return {ready:!stale,databaseReady:true,chainId:'1056',indexedHead:'5',runtime:{stale,readinessReason:stale?'stale_ingest':null}};},
 async status(){return {chainId:'1056',indexedHead:'5',indexedHeadHash:'h',indexedHeadTimestamp:'1',finality:{mode:'head'},runtime:{stale},authoritative:false};},
 async protocolEvents({protocol}){return {items:events.filter(e=>e.protocol===protocol),nextCursor:''};}};
}

test('stale Indexer projection makes readiness false and snapshot explicitly stale',async()=>{
 const svc=new ExchangeReadService({indexer:source({stale:true}),rpc,store:new MemoryProjectionStore().open(),catalogue,nowSeconds:()=>100});
 assert.equal((await svc.readiness()).ready,false);
 const snap=await svc.snapshot('m1');assert.equal(snap.canonicality,'stale');assert.equal(snap.qualification,'DISPLAY_ONLY_UNQUALIFIED');assert.equal(snap.routeHealthy,false);
});

test('catalogue metadata never becomes execution or settlement authority',async()=>{
 const svc=new ExchangeReadService({indexer:source(),rpc,store:new MemoryProjectionStore().open(),catalogue});
 const snap=await svc.snapshot('m1');
 assert.equal(snap.provenance.authoritative,false);assert.equal(snap.qualification,'DISPLAY_ONLY_UNQUALIFIED');assert.equal(snap.settlementHealthy,false);
});
