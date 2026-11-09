import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{handle420BetWorker} from '../worker/index.js';
const ORIGIN='https://420bet.420integrated.org';
const request=(path,init={})=>new Request(ORIGIN+path,init);
const ASSETS={fetch:async()=>new Response('SPA')};
test('disabled session API is intercepted by Worker and never falls back to SPA',async()=>{
 const env={ASSETS};
 const availability=await worker.fetch(request('/api/420bet/session/capabilities'),env);
 assert.equal(availability.status,200);
 assert.deepEqual(await availability.json(),{readOnlyIdentityAvailable:false});
 const denial=await worker.fetch(request('/api/420bet/session/challenge',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'}),env);
 assert.equal(denial.status,503);
 assert.equal((await denial.json()).error,'identity_not_configured');
 const unknown=await worker.fetch(request('/api/420bet/session/admin'),env);
 assert.equal(unknown.status,404);
});
test('Worker requires explicit enabled backend and does not invent an identity deployment',async()=>{
 const env={ASSETS,BET_IDENTITY_ENABLED:'true',BET_SESSION_BACKEND_URL:'http://localhost:8788',BET_SESSION_BACKEND_TOKEN:'x'.repeat(48)};
 const availability=await worker.fetch(request('/api/420bet/session/capabilities'),env);
 assert.equal((await availability.json()).readOnlyIdentityAvailable,false);
 const requestBody=JSON.stringify({account:'0x'+'a'.repeat(40),chainId:'420'});
 const denied=await worker.fetch(request('/api/420bet/session/challenge',{method:'POST',
   headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:requestBody}),env);
 assert.equal(denied.status,503);
});
test('Worker proxies only approved same-origin route with operator backend authentication',async()=>{
 const received=[],secret='z'.repeat(64);
 const env={BET_IDENTITY_ENABLED:'true',BET_SESSION_BACKEND_URL:'https://identity.example/',
  BET_SESSION_BACKEND_TOKEN:secret,ASSETS};
 const status=await handle420BetWorker(request('/api/420bet/session/capabilities'),env,null,{sessionFetch:async(url,opts)=>{
  assert.equal(url,'https://identity.example/api/420bet/session/ready');
  assert.equal(opts.headers['X-Bet-Edge-Secret'],secret);
  return new Response(JSON.stringify({ready:true}),{status:200,headers:{'content-type':'application/json'}});
 }});
 assert.equal((await status.json()).readOnlyIdentityAvailable,true);
 const req=request('/api/420bet/session/challenge',{method:'POST',
  headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:'should-not-be-forwarded'},body:'{}'});
 const denied=await worker.fetch(req,env);
 assert.equal(denied.status,403);
 const clean=request('/api/420bet/session/challenge',{method:'POST',
  headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({account:'0x'+'a'.repeat(40),chainId:'420'})});
 const res=await handle420BetWorker(clean,env,null,{sessionFetch:async(url,options)=>{
  received.push({url,options});
  return new Response(JSON.stringify({nonce:'safe',message:'verified challenge'}),{status:200,
    headers:{'content-type':'application/json'}});
 }});
 assert.equal(res.status,200);assert.equal((await res.json()).nonce,'safe');
 assert.equal(received[0].url,'https://identity.example/api/420bet/session/challenge');
 assert.equal(received[0].options.headers['X-Bet-Edge-Secret'],secret);
 assert.equal(received[0].options.headers.Cookie,undefined);
 assert.equal(res.headers.get('cache-control'),'no-store');
});
test('Worker protects upstream private details when identity backend fails',async()=>{
 const env={BET_IDENTITY_ENABLED:'true',BET_SESSION_BACKEND_URL:'https://identity.example/',
  BET_SESSION_BACKEND_TOKEN:'w'.repeat(64)};
 const req=request('/api/420bet/session/status',{method:'POST',
  headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'});
 const res=await handle420BetWorker(req,env,null,{sessionFetch:async()=>new Response('private upstream HTML',{status:502})});
 assert.equal(res.status,503);
 assert(!await res.text().then(x=>x.includes('private upstream HTML')));
});
