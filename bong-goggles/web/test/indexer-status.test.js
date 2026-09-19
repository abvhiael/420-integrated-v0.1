import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndexerStatusEnvelope,createIndexerStatusReader} from '../core/indexer-status.js';
const chainId=420;
const status={chainId:'420',indexedHead:'11',indexedHeadHash:'0x'+'a'.repeat(64),indexedHeadTimestamp:'1234',finality:{mode:'finalized',confirmations:null,safeHead:'11'},lag:null,authoritative:false};
const envelope={apiVersion:'v1',data:status};
test('status diagnostic validates exact indexer envelope, chain and finality',()=>{
 assert.equal(validateIndexerStatusEnvelope(envelope,chainId).indexedHead,'11');
 assert.equal(validateIndexerStatusEnvelope({...envelope,apiVersion:'v2'},chainId),null);
 assert.equal(validateIndexerStatusEnvelope(envelope,421),null);
 assert.equal(validateIndexerStatusEnvelope({apiVersion:'v1',data:{...status,authoritative:true}},chainId),null);
 assert.equal(validateIndexerStatusEnvelope({apiVersion:'v1',data:{...status,indexedHead:'-1'}},chainId),null);
 assert.equal(validateIndexerStatusEnvelope({apiVersion:'v1',data:{...status,finality:{...status.finality,mode:'untrusted'}}},chainId),null);
});
test('status reader sends existing route with configured chain ID and validates data',async()=>{
 let called=0;
 const reader=createIndexerStatusReader({chainId,service:{request:async(path,opts)=>{called++;assert.equal(path,'/v1/status?chainId=420');assert.equal(opts.method,'GET');assert.ok(opts.signal);return {ok:true,data:envelope};}}});
 assert.equal((await reader.read()).status,'ready');assert.equal(called,1);
});
test('HTTP errors, wrong chain, schema mismatch and network rejection fail closed',async()=>{
 for(const response of [{ok:false,status:503},{ok:true,data:{apiVersion:'v1',data:{...status,chainId:'421'}}},{ok:true,data:null}]){
  const reader=createIndexerStatusReader({chainId,service:{request:async()=>response}});
  assert.deepEqual(await reader.read(),{status:'unavailable',data:null});
 }
 const reader=createIndexerStatusReader({chainId,service:{request:async()=>{throw new Error('secret token');}}});
 assert.deepEqual(await reader.read(),{status:'unavailable',data:null});
});
test('superseded responses never reappear',async()=>{
 let resolveFirst;let calls=0;
 const reader=createIndexerStatusReader({chainId,service:{request:async()=>{calls++;if(calls===1)return new Promise(resolve=>resolveFirst=resolve);return {ok:true,data:envelope};}}});
 const first=reader.read();const second=await reader.read();resolveFirst({ok:true,data:envelope});
 assert.equal(second.status,'ready');assert.equal((await first).status,'stale');
});
test('explicit invalidation suppresses response',async()=>{
 let release;const reader=createIndexerStatusReader({chainId,service:{request:()=>new Promise(resolve=>release=resolve)}}});
 const first=reader.read();reader.invalidate();release({ok:true,data:envelope});assert.equal((await first).status,'stale');
});
