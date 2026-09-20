import test from 'node:test';
import assert from 'node:assert/strict';
import {createQualifiedProjectionReader} from '../core/qualified-read.js';

const A='0x'+'1'.repeat(40), B='0x'+'2'.repeat(40);
const binding={qualified:true,available:true,version:'v1'};
const session=(account=A)=>({connected:true,supportedNetwork:true,account,chainId:'0x66a44'});
const setup=({service={request:async()=>({ok:true,data:{items:[]}})},getSession=()=>session(),validate=data=>data,privateRead=true,path='/v1/feed'}={})=>createQualifiedProjectionReader({service,bindingName:'feedRead',binding,path,validate,getSession,privateRead});

test('BG-19 follow-up refuses unqualified or inferred read transports',()=>{
 assert.throws(()=>createQualifiedProjectionReader({service:{request(){}},bindingName:'feedRead',binding:{...binding,qualified:false},path:'/feed',validate:x=>x}),/unqualified/);
 assert.throws(()=>setup({path:'https://evil.example/feed'}),/safe projection path/);
 assert.throws(()=>setup({path:'/feed?account=secret'}),/safe projection path/);
 assert.throws(()=>setup({validate:null}),/validator/);
});

test('BG-19 follow-up supplies only explicit GET path and abort signal',async()=>{
 const seen=[];const reader=setup({service:{request:async(path,options)=>{seen.push({path,options});return {ok:true,data:{items:[1]}};}}});
 assert.deepEqual((await reader.read()).data,{items:[1]});
 assert.equal(seen[0].path,'/v1/feed');assert.equal(seen[0].options.method,'GET');assert.ok(seen[0].options.signal);
});

test('BG-19 follow-up keeps private projection locked without a supported Wallet session',async()=>{
 let calls=0;const reader=setup({getSession:()=>({...session(),supportedNetwork:false}),service:{request:async()=>{calls++;return {ok:true,data:{items:[]}};}}});
 assert.equal((await reader.read()).status,'locked');assert.equal(calls,0);
});

test('BG-19 follow-up discards previous account projection after account change',async()=>{
 let release;let viewer=session();
 const reader=setup({getSession:()=>viewer,service:{request:()=>new Promise(resolve=>{release=resolve;})}});
 const pending=reader.read();viewer=session(B);release({ok:true,data:{items:['private from A']}});
 assert.deepEqual(await pending,{status:'stale',data:null});
});

test('BG-19 follow-up invalidation discards in-flight results and failure stays unavailable',async()=>{
 let release;const reader=setup({service:{request:()=>new Promise(resolve=>{release=resolve;})}});
 const pending=reader.read();reader.invalidate();release({ok:true,data:{items:['stale']}});
 assert.equal((await pending).status,'stale');
 assert.equal((await setup({service:{request:async()=>({ok:false,status:503})}}).read()).status,'unavailable');
 assert.equal((await setup({validate:()=>null}).read()).status,'unavailable');
});
