import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountSocialController} from '../core/account-social-controller.js';
import {createAccountSocialClient,renderHomeAccountSocial} from '../core/account-social.js';

const subject='12345678-1234-4123-8123-123456789abc';
const postID='34567890-1234-4345-8345-123456789abc';
const post={id:postID,author:subject,displayName:'Community Member',body:'Restored sample post',createdAt:'2026-11-21T18:01:41Z',reactions:0};
const profile={subject,displayName:'Community Member'};
const good=(data)=>response(200,data);
const response=(status,data,contentType='application/json')=>({
 ok:status>=200&&status<300,status,
 headers:{get:(header)=>header.toLowerCase()==='content-type'?contentType:null},
 json:async()=>data
});
const me=()=>good({profile,walletRequired:false});
const feed=()=>good({posts:[post],nextCursor:null,source:'bonggoggles-account-social',onChain:false});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('HTML 503 from Render is passed through only for read requests',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return response(503,null,'text/html')};
 const client=createAccountSocialClient({enabled:true,fetchImpl});
 assert.deepEqual(await client.request('/v1/me'),{status:503,data:null});
 assert.equal(calls,1);
 await assert.rejects(client.request('/v1/posts',{method:'POST',body:{body:'One shot'}}),/Social service response unavailable/);
 assert.equal(calls,2,'a mutation is never silently repeated');
});

test('transient 503 starts a bounded read-only recovery and restores the verified feed',async()=>{
 const scheduled=[];let availability=false;
 const requested=[];
 const controller=new AccountSocialController({
  enabled:true,
  fetchImpl:async(url,options)=>{
   requested.push({url,method:options.method});
   if(!availability)return response(503,null,'text/html');
   return url.endsWith('/v1/me')?me():feed();
  },
  scheduleWakeRetry:(fn,delay)=>scheduled.push({fn,delay}),
  wakeRetryDelays:[0,0]
 });
 assert.equal((await controller.refresh()).status,'error');
 assert.equal(controller.state.temporary,true);
 assert.equal(scheduled.length,1);
 assert.match(renderHomeAccountSocial(controller.state,{enabled:true}),/checking again automatically/);
 assert.doesNotMatch(renderHomeAccountSocial(controller.state,{enabled:true}),/Restored sample post/);
 availability=true;
 scheduled.shift().fn();
 await settle();
 assert.equal(controller.state.status,'ready');
 assert.match(renderHomeAccountSocial(controller.state,{enabled:true}),/Restored sample post/);
 assert.deepEqual(requested.map(x=>x.method),['GET','GET','GET']);
});

test('verified 401 means guest, and does not loop or leak previously loaded content',async()=>{
 const tasks=[];
 const controller=new AccountSocialController({enabled:true,
  fetchImpl:async()=>response(401,{error:'Unauthorized'}),
  scheduleWakeRetry:(fn)=>tasks.push(fn)
 });
 assert.deepEqual(await controller.refresh(),{status:'guest'});
 assert.equal(tasks.length,0);
 assert.doesNotMatch(renderHomeAccountSocial(controller.state,{enabled:true}),/Restored sample post/);
});

test('non-transient malformed success and 400 do not trigger cold-start retries',async()=>{
 for(const body of [response(400,{error:'Bad Request'}),good({walletRequired:true,profile})]){
  const tasks=[];
  const c=new AccountSocialController({enabled:true,fetchImpl:async()=>body,
   scheduleWakeRetry:fn=>tasks.push(fn)});
  assert.equal((await c.refresh()).status,'error');
  assert.equal(tasks.length,0);
 }
});

test('retry budget is finite, and stale retries cannot overwrite a later verified session',async()=>{
 const pending=[];
 let available=false;let calls=0;
 const c=new AccountSocialController({enabled:true,wakeRetryDelays:[0,0],
  scheduleWakeRetry:(fn)=>pending.push(fn),
  fetchImpl:async url=>{
   calls++;
   if(!available)return response(502,null,'text/html');
   return url.endsWith('/v1/me')?me():feed();
  }
 });
 await c.refresh();
 assert.equal(pending.length,1);
 const obsolete=pending.shift();
 available=true;
 await c.refresh();
 assert.equal(c.state.status,'ready');
 const successfulCalls=calls;
 obsolete();
 await settle();
 assert.equal(calls,successfulCalls,'an obsolete retry never touches the network');
 assert.equal(c.state.status,'ready');

 const scheduled=[];const fail=new AccountSocialController({enabled:true,wakeRetryDelays:[0,0],
  scheduleWakeRetry:fn=>scheduled.push(fn),
  fetchImpl:async()=>response(503,null,'text/html')
 });
 await fail.refresh();
 for(let i=0;i<2;i++){
  assert.equal(scheduled.length,1);
  scheduled.shift()();
  await settle();
 }
 assert.equal(scheduled.length,0,'bounded retry budget exhausted');
 assert.equal(fail.state.status,'error');
});

test('a failed write does not retry or fall back to a guessed publication',async()=>{
 const scheduled=[];let writes=0;
 const c=new AccountSocialController({enabled:true,
  scheduleWakeRetry:(fn)=>scheduled.push(fn),
  fetchImpl:async (url,options)=>{
   if(options.method==='POST'){writes++;return response(503,null,'text/html');}
   return url.endsWith('/v1/me')?me():feed();
  }
 });
 assert.equal((await c.refresh()).status,'ready');
 await assert.rejects(c.act('post',{body:'Do not duplicate'}),/Social service response unavailable/);
 assert.equal(writes,1);
 assert.equal(scheduled.length,0);
 assert.equal(c.state.status,'ready','uncertain write must not be promoted into a successful post');
});
