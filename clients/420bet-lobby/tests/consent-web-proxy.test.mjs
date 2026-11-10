import test from 'node:test';
import assert from 'node:assert/strict';
import {handle420BetWorker} from '../worker/index.js';
import {createBetConsentClient} from '../src/consent-enrollment.js';
const origin='https://bet.example';
const backend='https://consent.example';
const edge='edge-service-secret-0000000000000000000000';
const A='0x'+'a'.repeat(40);
function req(path,originHeader=origin){
 return new Request(origin+path,{method:'POST',
  headers:{Origin:originHeader,'Content-Type':'application/json'},
  body:'{}'});
}
test('Cloudflare consent proxy requires enablement, same origin and private backend credential',async()=>{
 const env={BET_CONSENT_ENABLED:'true',BET_CONSENT_BACKEND_URL:backend+'/',
  BET_CONSENT_BACKEND_TOKEN:edge};
 const disabled=await handle420BetWorker(req('/api/420bet/consent/challenge'),{},null);
 assert.equal(disabled.status,503);
 const wrongOrigin=await handle420BetWorker(req('/api/420bet/consent/challenge','https://evil.test'),env,null);
 assert.equal(wrongOrigin.status,403);
 let count=0;
 const response=await handle420BetWorker(req('/api/420bet/consent/challenge'),env,null,{
  consentFetch:async(url,opts)=>{
   count++;
   assert.equal(url,backend+'/v1/420bet/consent/challenge');
   assert.equal(opts.headers['X-Bet-Edge-Secret'],edge);
   assert.equal(opts.headers.Origin,origin);
   return new Response(JSON.stringify({challenge:{nonce:'a'.repeat(64)}}),{
    status:200,headers:{'Content-Type':'application/json'}});
  }
 });
 assert.equal(response.status,200);
 assert.equal(count,1);
});
test('browser client requires explicit wallet action and rejects silently changed wallet',async()=>{
 let now=Date.now(),count=0,account=A;
 const provider={request:async ({method})=>{
  if(method==='eth_requestAccounts')return [account];
  if(method==='eth_chainId')return '0x1a4';
  if(method==='personal_sign'){count++;return '0x'+'12'.repeat(65);}
  throw Error('bad wallet method');
 }};
 const client=createBetConsentClient({provider,expectedOrigin:origin,
  fetcher:async(url,options)=>{
   const body=JSON.parse(options.body);
   if(url.endsWith('/challenge'))return {ok:true,json:async()=>({
    challenge:{...body,origin,chainId:'420',nonce:'a'.repeat(64),
     expiresAt:now+90000},signature:'signed-challenge',
    message:['420Bet Notification Consent','Action: enroll','Account: '+A,
     'Route: route-1','Policy version: p1'].join('\n')+'\n'
   })};
   return {ok:true,json:async()=>({consent:true,revoked:false,revision:1})};
  }});
 assert.equal(count,0,'page load signed wallet without authorization');
 const value=await client.enroll({subscriptionId:'sub-1',recipient:'route-1',
  channel:'notifications',policyVersion:'p1',expectedRevision:0});
 assert.equal(value.consent,true);assert.equal(count,1);
 account='0x'+'b'.repeat(40);
 await assert.rejects(client.enroll({subscriptionId:'sub-1',recipient:'route-1',
  channel:'notifications',policyVersion:'p1',expectedRevision:0}),/not bound/);
 client.dispose();
 await assert.rejects(client.revoke({}),/unavailable/);
});
