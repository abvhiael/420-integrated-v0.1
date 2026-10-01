import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExecutableSwapQuote,fetchExecutableSwapReview} from '../core/executable-quote-intake.js';
import {createQuoteReplayGuard} from '../core/quote-authentication.js';
import {engineForAuth,request,runtimeForAuth,vector} from './authenticated-quote-fixture.js';

const runtime=runtimeForAuth();
const response=await engineForAuth()(request);
const validate=(changes={},req=request,rt=runtime,nowSeconds=1010)=>validateExecutableSwapQuote({runtime:rt,request:req,response:{...structuredClone(response),...changes},nowSeconds});
const transport=(override={})=>async()=>({ok:true,redirected:false,url:runtime.api.executableQuoteUrl,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>structuredClone(response),...override});
const fetchCandidate=(overrides={})=>fetchExecutableSwapReview({
 runtime,request,nowSeconds:1010,readNowSeconds:()=>1011,fetchImpl:transport(),replayGuard:createQuoteReplayGuard(),...overrides,
});

test('schema-valid signed quote remains review-candidate until cryptographic promotion',()=>{
 const result=validate({},request,runtime,1010);
 assert.equal(result.status,'REVIEW_CANDIDATE_ONLY');
 assert.equal(result.prepared.context.trustLevel,'REVIEW_CANDIDATE');
 assert.equal(result.projection.amountIn,'1');
 assert.equal(result.projection.minimumOutput,'4.1');
 assert.equal(result.projection.fees.totalFee,'0.0125');
 assert.equal(result.prepared.transaction.request.to,vector.router);
 assert.equal(Object.hasOwn(result,'sourceAuthenticated'),false);
});

test('structural intake rejects unqualified, stale, wrong wallet, chain and altered trade requests',()=>{
 const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0'),id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
 for(const changes of [
  {schema:'display-v1'},{marketSource:'demo'},{demo:true},{fixture:true},{quoteId:'demo'},{chainId:'0x421'},{account:address(8)},{observedAt:900},{expiresAt:1010},
  {execution:{...response.execution,amountInRaw:'2'}},
  {execution:{...response.execution,tokenIn:address(8)}},
  {execution:{...response.execution,recipient:address(8)}},
  {execution:{...response.execution,minFinalAmountOutRaw:'1'}},
  {reviewedIntent:{...response.reviewedIntent,routeCommitment:id(901)}},
  {tokens:{...response.tokens,input:{...response.tokens.input,verified:false}}},
 ]){
  assert.throws(()=>validate(changes),error=>error.name==='QuoteIntakeError',JSON.stringify(changes));
 }
 assert.throws(()=>validate({}, {...request,amountInRaw:'2'}),error=>error.code==='QUOTE_REQUEST_MISMATCH');
 assert.throws(()=>validate({},request,{...runtime,deployment:{status:'UNRESOLVED',environment:'testnet'}}),error=>error.code==='DEPLOYMENT_UNRESOLVED');
});

test('no endpoint and invalid cross-origin or insecure endpoints fail before HTTP',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('unexpected network call');};
 for(const api of [
  {...runtime.api,executableQuoteUrl:null},
  {...runtime.api,executableQuoteUrl:'http://api.example.invalid/executable-swap-quote'},
  {...runtime.api,executableQuoteUrl:'https://other.example.invalid/executable-swap-quote'},
  {...runtime.api,executableQuoteUrl:'https://api.example.invalid/executable-swap-quote?demo=1'},
 ]){
  await assert.rejects(fetchCandidate({runtime:{...runtime,api},fetchImpl}),error=>error.name==='QuoteIntakeError');
 }
 assert.equal(calls,0);
});

test('configured quote transport sends exact request and returns authenticated quote without signing in browser',async()=>{
 let seen;const fetchImpl=async(url,options)=>{seen={url,options};return transport()();};
 const result=await fetchCandidate({fetchImpl});
 assert.equal(result.status,'TRUSTED_EXECUTION_QUOTE');
 assert.equal(result.authentication.verified,true);
 assert.equal(seen.options.method,'POST');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.cache,'no-store');
 assert.deepEqual(JSON.parse(seen.options.body),request);
 await assert.rejects(fetchCandidate({fetchImpl:transport({headers:{get:()=> 'text/html'}})}),error=>error.code==='UNQUALIFIED_RESPONSE');
});

test('quote expiring or becoming stale while HTTP or JSON is pending fails at receipt',async()=>{
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1030}),error=>error.code==='STALE_QUOTE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1031}),error=>error.code==='STALE_QUOTE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1009}),error=>error.code==='CLOCK_UNAVAILABLE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>NaN}),error=>error.code==='CLOCK_UNAVAILABLE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>{throw Error('no clock');}}),error=>error.code==='CLOCK_UNAVAILABLE');
});

test('redirected or endpoint-substituted replies are rejected even when signed JSON is valid',async()=>{
 await assert.rejects(fetchCandidate({fetchImpl:transport({redirected:true})}),error=>error.code==='ENDPOINT_CHANGED');
 await assert.rejects(fetchCandidate({fetchImpl:transport({url:'https://other.example.invalid/executable-swap-quote'})}),error=>error.code==='ENDPOINT_CHANGED');
});

test('same authenticated quote cannot be admitted twice through the fetch path',async()=>{
 const guard=createQuoteReplayGuard();
 await fetchCandidate({replayGuard:guard});
 await assert.rejects(fetchCandidate({replayGuard:guard}),error=>error.code==='QUOTE_REPLAYED');
});
