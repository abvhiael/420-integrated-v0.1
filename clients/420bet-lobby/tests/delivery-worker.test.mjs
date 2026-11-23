import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBetOperationalDeliveryWorker} from '../server/delivery-worker.mjs';

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
function fakeRuntime(log=[],overrides={}){
 let closed=0;
 const runtime={
  syncRevocations:async()=>{log.push('revoke');return {processed:1}},
  publish:async()=>{log.push('publish');return {queued:2,scanned:4,nextBlock:'105'}},
  drain:async()=>{log.push('drain');return {processed:2,delivered:1,pending:1}},
  outbox:{summary:async()=>({halted:false}),getRevocationCursor:async()=>1},
  revocationHealth:()=>({failed:false}),stop:async()=>{closed++;},
  ...overrides
 };
 return {...runtime,closeCount:()=>closed};
}
test('durable worker serializes revocation, checkpoint publication, and delivery with monitoring',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));const calls=[];
 const runtime=fakeRuntime(calls);
 let worker;
 try{
  worker=await openBetOperationalDeliveryWorker({runtime,statePath:join(dir,'worker.json'),
   intervalMs:100,staleAfterMs:1000});
  assert.equal(worker.health().ready,false);
  const first=await worker.runOnce();
  assert.deepEqual(calls,['revoke','publish','drain']);
  assert.equal(first.published.nextBlock,'105');
  assert.equal(worker.checkpoint().completed,1);
  assert.equal(worker.checkpoint().lastPublish.queued,2);
  const stored=JSON.parse(await readFile(join(dir,'worker.json'),'utf8'));
  assert.equal(stored.inFlight,false);
  assert.equal(stored.cycles,1);
  assert.equal((await stat(join(dir,'worker.json'))).mode&0o077,0);
  assert.equal(worker.health().stale,false);
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
test('after an interrupted persisted cycle restart records recovery and resumes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 try{
  const path=join(dir,'worker.json');
  worker=await openBetOperationalDeliveryWorker({runtime:fakeRuntime(),statePath:path,intervalMs:100});
  const checkpoint=worker.checkpoint();
  await worker.stop();
  worker=null;
  checkpoint.cycles=1;checkpoint.inFlight=true;checkpoint.lastStartedAt=Date.now();
  await writeFile(path,JSON.stringify(checkpoint),{mode:0o600});
  worker=await openBetOperationalDeliveryWorker({runtime:fakeRuntime(),statePath:path,intervalMs:100});
  assert.equal(worker.checkpoint().recoveryCount,1);
  assert.equal(worker.checkpoint().inFlight,false);
  assert.equal((await worker.runOnce()).ready,true);
  assert.equal(worker.checkpoint().completed,1);
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
test('single-writer lock refuses concurrent and orphaned process; no forced takeover',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 try{
  const path=join(dir,'worker.json');
  worker=await openBetOperationalDeliveryWorker({runtime:fakeRuntime(),statePath:path,intervalMs:100});
  await assert.rejects(openBetOperationalDeliveryWorker({runtime:fakeRuntime(),statePath:path,intervalMs:100}),/EEXIST/);
  await worker.stop();worker=null;
  const revived=await openBetOperationalDeliveryWorker({runtime:fakeRuntime(),statePath:path,intervalMs:100});
  worker=revived;
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
test('failure is persistent, blocks readiness, and recovers after a successful cycle',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 let available=false;
 try{
  const runtime=fakeRuntime([], {publish:async()=>{if(!available)throw Error('indexer offline');
   return {queued:0,scanned:0,nextBlock:'22'};}});
  worker=await openBetOperationalDeliveryWorker({runtime,statePath:join(dir,'worker.json'),
   intervalMs:100,staleAfterMs:1000});
  await assert.rejects(worker.runOnce(),/indexer offline/);
  assert.equal(worker.health().ready,false);
  assert.equal(worker.health().lastErrorCode,'CANONICAL_DEPENDENCY');
  assert.equal(worker.checkpoint().consecutiveFailures,1);
  available=true;
  assert.equal((await worker.runOnce()).ready,true);
  assert.equal(worker.health().lastErrorCode,null);
  assert.equal(worker.checkpoint().failures,1);
  assert.equal(worker.checkpoint().completed,1);
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
test('scheduled loop executes without overlap and stops gracefully',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 let concurrent=0,maxConcurrent=0,cycles=0;
 try{
  const runtime=fakeRuntime([],{publish:async()=>{
   concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);
   await sleep(120);concurrent--;cycles++;return {queued:0,scanned:0,nextBlock:'1'};
  }});
  worker=await openBetOperationalDeliveryWorker({runtime,statePath:join(dir,'worker.json'),
   intervalMs:100,staleAfterMs:1000});
  worker.start();
  await sleep(450);
  assert(cycles>=1,'schedule did not execute');
  assert.equal(maxConcurrent,1);
  await worker.stop();
  assert.equal(runtime.closeCount(),1);
  const before=cycles;await sleep(220);
  assert.equal(cycles,before,'worker restarted after stop');
  worker=null;
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
test('reorg halt never reports successful worker cycle',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 try{
  worker=await openBetOperationalDeliveryWorker({runtime:fakeRuntime([],{
   publish:async()=>({reorganized:true,halted:true,queued:0})
  }),statePath:join(dir,'worker.json'),intervalMs:100});
  await assert.rejects(worker.runOnce(),/reorg halt/);
  assert.equal(worker.health().ready,false);
  assert.equal(worker.health().lastErrorCode,'CANONICAL_HALT');
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});

test('worker excludes standalone Indexer cursor writers and releases file lock on shutdown',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bet-worker-'));let worker;
 try{
  const indexerPath=join(dir,'indexer.json'),statePath=join(dir,'worker.json');
  worker=await openBetOperationalDeliveryWorker({
   runtime:fakeRuntime(),statePath,indexerCheckpointPath:indexerPath,intervalMs:100
  });
  const {open}=await import('node:fs/promises');
  await assert.rejects(open(indexerPath+'.lock','wx',0o600),/EEXIST/);
  await worker.stop();worker=null;
  const file=await open(indexerPath+'.lock','wx',0o600);await file.close();
  const reopen=await openBetOperationalDeliveryWorker({
   runtime:fakeRuntime(),statePath,indexerCheckpointPath:indexerPath,intervalMs:100
  }).then(()=>false,()=>true);
  assert.equal(reopen,true,'worker started with competing Indexer checkpoint writer');
  const {unlink}=await import('node:fs/promises');await unlink(indexerPath+'.lock');
 }finally{if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});}
});
