import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectionWorker } from '../src/worker.mjs';
import { setup,listingEvent,b32,header } from './fixtures.mjs';
function setupWorker(f,pages){
  let finalized=0;const blocks=new Map([[0,{hash:b32(99),parentHash:b32(98),number:'0x0'}],[1,{hash:b32(100),parentHash:b32(99),number:'0x1'}]]),calls=[];
  f.authority.config={environment:'local'};f.authority.rpc={send:async(_method,[tag])=>blocks.get(tag==='finalized'?finalized:Number(BigInt(tag)))};
  const worker=new ProjectionWorker(f.projection,f.authority,{indexerUrl:'http://127.0.0.1:9000',fetcher:async(url,init)=>{
    calls.push({url,init});const page=pages.shift()??{items:[],nextCursor:null};return new Response(JSON.stringify({apiVersion:'v1',data:page}));
  }});
  return {worker,blocks,calls,setFinalized:n=>finalized=n};
}
const dto=e=>({...e.provenance,protocol:e.protocol,eventName:e.eventName,objectKey:e.objectKey,lifecycleState:null,fields:e.fields});
test('worker consumes existing typed stream, retains tail cursor and refreshes finality on an empty page',async t=>{
  const f=setup();t.after(()=>f.close());const x=setupWorker(f,[{items:[dto(listingEvent(f))],nextCursor:null}]);await x.worker.syncOnce();const first=f.db.get('SELECT cursor FROM projection_checkpoints').cursor;assert.ok(first);assert.equal(f.projection.health().height,1);
  x.setFinalized(1);await x.worker.syncOnce();assert.equal(f.db.get('SELECT finalized FROM catalogue_projection').finalized,1);assert.equal(f.db.get('SELECT cursor FROM projection_checkpoints').cursor,first);assert.equal(x.calls[0].url.pathname,'/v1/protocols/events');assert.equal(x.calls[0].url.searchParams.get('protocol'),'420Market');assert.equal(x.calls[0].init.redirect,'error');
});
test('paged events from the same block resume without skipping or duplicating state',async t=>{
  const f=setup();t.after(()=>f.close());const x=setupWorker(f,[{items:[dto(listingEvent(f))],nextCursor:'opaque-next'},{items:[dto(listingEvent(f,{logIndex:1,revision:'2'}))],nextCursor:null}]);await x.worker.syncOnce();assert.equal(f.projection.health().state,'stale');await x.worker.syncOnce();assert.equal(f.projection.health().state,'ready');assert.equal(JSON.parse(f.db.get('SELECT payload FROM catalogue_projection').payload).revision,'2');assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox').n,2);
});
test('worker detects a nonfinal fork, rewinds shared stream cursor and replaces orphan-derived rows',async t=>{
  const f=setup();t.after(()=>f.close());const replacement=listingEvent(f,{blockHash:b32(101),revision:'2'}),x=setupWorker(f,[{items:[dto(listingEvent(f))],nextCursor:null},{items:[dto(replacement)],nextCursor:null}]);await x.worker.syncOnce();x.blocks.set(1,{hash:b32(101),parentHash:b32(99),number:'0x1'});await x.worker.syncOnce();assert.equal(f.projection.health().blockHash,b32(101));assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox WHERE canonical=0').n,1);
});
test('worker refuses finalized fork repair and persists halt rather than substituting a green empty batch',async t=>{
  const f=setup();t.after(()=>f.close());const x=setupWorker(f,[{items:[dto(listingEvent(f))],nextCursor:null}]);x.setFinalized(1);await x.worker.syncOnce();x.blocks.set(1,{hash:b32(101),parentHash:b32(99),number:'0x1'});await assert.rejects(()=>x.worker.syncOnce(),e=>e.code==='finalized_mismatch');assert.equal(f.projection.health().state,'halted');
});
test('worker bounds large empty-block gaps without skipping unseen event positions',async t=>{
  const f=setup();t.after(()=>f.close());const future=listingEvent(f,{height:300,blockHash:b32(399)}),x=setupWorker(f,[{items:[dto(future)],nextCursor:null},{items:[dto(future)],nextCursor:null}]);
  for(let height=1;height<=300;height++)x.blocks.set(height,{hash:b32(height+99),parentHash:b32(height+98),number:'0x'+height.toString(16)});x.setFinalized(300);
  await x.worker.syncOnce();assert.equal(f.projection.health().height,256);assert.equal(f.projection.health().state,'stale');await x.worker.syncOnce();assert.equal(f.projection.health().height,300);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox').n,1);
});
test('worker indexer schema/dependency errors are failures without checkpoint advancement',async t=>{
  const f=setup();t.after(()=>f.close());const worker=new ProjectionWorker(f.projection,{...f.authority,config:{environment:'local'},rpc:{send:async()=>({number:'0x0'})}},{indexerUrl:'http://127.0.0.1',fetcher:async()=>new Response(JSON.stringify({apiVersion:'v0',data:{items:[]}}))});await assert.rejects(()=>worker.syncOnce(),e=>e.code==='indexer_schema');assert.equal(f.projection.health().height,0);
});
