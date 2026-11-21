import test from 'node:test';
import assert from 'node:assert/strict';
import {forwardSocialRequest} from '../../cloudflare/social-proxy/worker.mjs';

const ORIGIN='https://bonggoggles.420integrated.org';
const RENDER='https://bonggoggles-social.onrender.com';
const secret='S'.repeat(43);
const env={SOCIAL420_EDGE_SECRET:secret};

test('authenticated same-origin Worker transport preserves cookies, path, and redirects',async()=>{
 const calls=[];
 const respond=async request=>{
  calls.push(request);
  return new Response(null,{status:303,headers:{
   'Location':'https://auth.420integrated.org/v1/sso/authorize',
   'Set-Cookie':'bg_flow=example; Secure; HttpOnly; SameSite=Lax; Path=/',
   'Cache-Control':'public,max-age=3600'
  }});
 };
 const incoming=new Request(ORIGIN+'/social-api/auth/start?step=1',{
  headers:{'Cookie':'session=opaque','X-Social420-Edge-Key':'spoofed','X-Forwarded-Host':'evil.example'}
 });
 const result=await forwardSocialRequest(incoming,env,respond);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,RENDER+'/social-api/auth/start?step=1');
 assert.equal(calls[0].headers.get('Host'),null);
 assert.equal(calls[0].headers.get('Cookie'),'session=opaque');
 assert.equal(calls[0].headers.get('X-Social420-Edge-Key'),secret);
 assert.equal(calls[0].headers.get('X-Forwarded-Host'),null);
 assert.equal(calls[0].headers.get('X-Forwarded-Proto'),'https');
 assert.equal(calls[0].redirect,'manual');
 assert.equal(result.status,303);
 assert.equal(result.headers.get('Location'),'https://auth.420integrated.org/v1/sso/authorize');
 assert.match(result.headers.get('Set-Cookie'),/HttpOnly/);
 assert.equal(result.headers.get('Cache-Control'),'no-store');
});

test('Worker retains authenticated POST data, exact Origin, and private response',async()=>{
 let forwarded;
 const incoming=new Request(ORIGIN+'/social-api/v1/posts',{
  method:'POST',
  headers:{'Origin':ORIGIN,'Content-Type':'application/json',
   'Cookie':'bg_session=opaque','Sec-Fetch-Site':'same-origin'},
  body:JSON.stringify({body:'one off-chain post'})
 });
 const result=await forwardSocialRequest(incoming,env,async request=>{
  forwarded=request;
  return Response.json({saved:true},{headers:{'Cache-Control':'public,max-age=5',
    'Access-Control-Allow-Origin':'*'}});
 });
 assert.equal(forwarded.url,RENDER+'/social-api/v1/posts');
 assert.equal(forwarded.method,'POST');
 assert.equal(forwarded.headers.get('Origin'),ORIGIN);
 assert.equal(forwarded.headers.get('Cookie'),'bg_session=opaque');
 assert.deepEqual(await forwarded.json(),{body:'one off-chain post'});
 assert.deepEqual(await result.json(),{saved:true});
 assert.equal(result.headers.get('Cache-Control'),'no-store');
 assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
});

test('Worker denies noncanonical hosts, non-HTTPS, missing secret and unrelated paths',async()=>{
 const mustNeverFetch=async()=>{throw new Error('upstream access was not supposed to occur')};
 for(const url of [
  'https://bonggoggles-social-proxy.workers.dev/social-api/healthz',
  'https://evil.example/social-api/healthz',
  'http://bonggoggles.420integrated.org/social-api/healthz',
  ORIGIN+'/social',
  ORIGIN+'/social-api/%2Fhidden'
 ]){
  const answer=await forwardSocialRequest(new Request(url),env,mustNeverFetch);
  assert.equal(answer.status,404,url);
 }
 const unconfigured=await forwardSocialRequest(
  new Request(ORIGIN+'/social-api/healthz'),{},mustNeverFetch);
 assert.equal(unconfigured.status,503);
 const tooShort=await forwardSocialRequest(
  new Request(ORIGIN+'/social-api/healthz'),{SOCIAL420_EDGE_SECRET:'weak'},mustNeverFetch);
 assert.equal(tooShort.status,503);
});

test('Worker returns generic noncacheable 502 without exposing secret on upstream failure',async()=>{
 const answer=await forwardSocialRequest(
  new Request(ORIGIN+'/social-api/healthz'),
  env,async()=>{throw new Error('private upstream details '+secret)});
 assert.equal(answer.status,502);
 assert.equal(answer.headers.get('Cache-Control'),'no-store');
 assert.equal((await answer.text()).includes(secret),false);
});
