// BC-1.8 public-target acceptance preflight. Uses the real BongGoggles
// production hostname, WITHOUT passwords, cookies, fabricated responses or
// private routes. Cannot substitute for the two-420ID main-only match workflow.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const origin='https://bonggoggles.420integrated.org';
const paths=['/games','/runtime-config.json','/social-api/healthz'];
const timeout=8000,attempts=5;
async function sample(path){
 let last=null;
 for(let i=0;i<attempts;i++){
  try{
   const res=await fetch(origin+path,{signal:AbortSignal.timeout(timeout),redirect:'error',
    cache:'no-store',headers:{Accept:path.endsWith('.json')||path.includes('healthz')?'application/json':'text/html'}});
   const contentType=res.headers.get('content-type')||'';
   const body=await res.text();
   if(body.length>256*1024)throw Error('oversized public response');
   if(res.ok)return {status:res.status,contentType,body,attempt:i+1};
   last='HTTP '+res.status;
  }catch(e){last=e.name==='TimeoutError'?'timeout':e.message.slice(0,120);}
  if(i<attempts-1)await delay(2500);
 }
 throw Error('BC-1.8 live '+path+' not healthy after '+attempts+' bounded requests: '+last);
}
const [games,runtime,health]=await Promise.all(paths.map(sample));
assert.match(games.contentType,/text\/html/i,'live /games did not serve HTML');
assert.ok(/bong|goggle/i.test(games.body),'site branding not in actual /games HTML');
assert.match(runtime.contentType,/application\/json/i,'no actual runtime-config JSON');
const config=JSON.parse(runtime.body);
assert.equal(config?.appOrigin,origin,'live page origin mismatch');
const features=config?.features;
assert.ok(features&&typeof features==='object','live feature flags absent');
assert.match(health.contentType,/application\/json/i,'worker health did not return JSON');
const workerReady=JSON.parse(health.body)?.ready===true;
console.log('BC-1.8 live production signals:',JSON.stringify({origin,
 responses:paths.map((path,i)=>({path,status:[games,runtime,health][i].status,attempt:[games,runtime,health][i].attempt})),
 flags:{accountSocial:features.accountSocial===true,classicRooms:features.classicRooms===true,
 classicCommunications:features.classicCommunications===true},workerReady}));
assert.equal(workerReady,true,'social Worker->Render service not ready');
assert.equal(features.accountSocial,true,'420ID account site flag disabled');
assert.equal(features.classicRooms,true,'Cribbage room browser flag not active');
assert.equal(features.classicCommunications,true,'Cribbage communications browser flag not active');
console.log('BC-1.8 public target preflight PASS',JSON.stringify({
 origin,paths:paths.map((path,i)=>({path,status:[games,runtime,health][i].status,attempt:[games,runtime,health][i].attempt})),
 flags:{accountSocial:true,classicRooms:true,classicCommunications:true}}));
