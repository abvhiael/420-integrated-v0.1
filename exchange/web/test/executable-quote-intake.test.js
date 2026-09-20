import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExecutableSwapQuote,fetchExecutableSwapReview} from '../core/executable-quote-intake.js';
const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),tokenIn=address(3),tokenOut=address(4);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},api:{baseUrl:'https://quotes.example.invalid/exchange',executableQuoteUrl:'https://quotes.example.invalid/exchange/executable-swap-quote'},contracts:{ExchangeAtomicRouter420:address(100)}};
const request={account,recipient,tokenIn,tokenOut,amountInRaw:'1000000000000000000',minimumOutputRaw:'4000000'};
const response={schema:'420-exchange-executable-swap-quote-v1',marketSource:'api',demo:false,fixture:false,quoteId:id(99),chainId:'0x420',account,observedAt:1000,expiresAt:1050,reviewedIntent:{kind:'EXACT_INPUT_PATH',recipient,routeCommitment:id(900),hops:[{marketId:id(10),outputToken:tokenOut}]},execution:{mode:'ERC20_TO_ERC20',tokenIn,recipient,amountInRaw:request.amountInRaw,minFinalAmountOutRaw:'4100000',expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut,minAmountOutRaw:'4100000',routeData:'0x'}]},tokens:{input:{address:tokenIn,decimals:18,symbol:'BOB',verified:true},output:{address:tokenOut,decimals:6,symbol:'ARRR',verified:true}}};
const validate=(changes={},req=request,rt=runtime,nowSeconds=1010)=>validateExecutableSwapQuote({runtime:rt,request:req,response:{...response,...changes},nowSeconds});
const transport=(override={})=>async()=>({ok:true,redirected:false,url:runtime.api.executableQuoteUrl,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>structuredClone(response),...override});
const fetchCandidate=(overrides={})=>fetchExecutableSwapReview({runtime,request,nowSeconds:1010,readNowSeconds:()=>1011,fetchImpl:transport(),...overrides});
test('projects matching quote as review candidate only, never authorization to send',()=>{
 const result=validate();
 assert.equal(result.status,'REVIEW_CANDIDATE_ONLY');assert.equal(result.projection.amountIn,'1');assert.equal(result.projection.minimumOutput,'4.1');
 assert.equal(result.prepared.transaction.request.to,address(100));assert.equal(Object.hasOwn(result,'sourceAuthenticated'),false);
});
test('rejects unqualified, stale, wrong wallet, chain and altered trade requests',()=>{
 for(const changes of [{schema:'display-v1'},{marketSource:'demo'},{demo:true},{fixture:true},{quoteId:'demo'},{chainId:'0x421'},{account:address(8)},{observedAt:900},{expiresAt:1010},
  {execution:{...response.execution,amountInRaw:'2'}},{execution:{...response.execution,tokenIn:address(8)}},{execution:{...response.execution,recipient:address(8)}},{execution:{...response.execution,minFinalAmountOutRaw:'1'}},
  {reviewedIntent:{...response.reviewedIntent,routeCommitment:id(901)}},{tokens:{...response.tokens,input:{...response.tokens.input,verified:false}}}]){
  assert.throws(()=>validate(changes),error=>error.name==='QuoteIntakeError',JSON.stringify(changes));
 }
 assert.throws(()=>validate({}, {...request,amountInRaw:'2'}),error=>error.code==='QUOTE_REQUEST_MISMATCH');
 assert.throws(()=>validate({},request,{...runtime,deployment:{status:'UNRESOLVED',environment:'testnet'}}),error=>error.code==='DEPLOYMENT_UNRESOLVED');
});
test('no endpoint and invalid cross-origin or insecure endpoints fail before HTTP',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('unexpected network call');};
 for(const api of [{...runtime.api,executableQuoteUrl:null},{...runtime.api,executableQuoteUrl:'http://quotes.example.invalid/exchange/executable-swap-quote'},{...runtime.api,executableQuoteUrl:'https://other.example.invalid/exchange/executable-swap-quote'},{...runtime.api,executableQuoteUrl:'https://quotes.example.invalid/exchange/executable-swap-quote?demo=1'}]){
  await assert.rejects(fetchCandidate({runtime:{...runtime,api},fetchImpl}),error=>error.name==='QuoteIntakeError');
 }
 assert.equal(calls,0);
});
test('configured quote transport sends exact request, refuses non-JSON and does not sign',async()=>{
 let seen;const fetchImpl=async(url,options)=>{seen={url,options};return transport()();};
 const result=await fetchCandidate({fetchImpl});
 assert.equal(result.status,'REVIEW_CANDIDATE_ONLY');assert.equal(seen.options.method,'POST');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.cache,'no-store');
 assert.deepEqual(JSON.parse(seen.options.body),{schema:'420-exchange-swap-quote-request-v1',...request});
 await assert.rejects(fetchCandidate({fetchImpl:transport({headers:{get:()=> 'text/html'}})}),error=>error.code==='UNQUALIFIED_RESPONSE');
});
test('quote expiring or becoming stale while HTTP or JSON is pending fails at receipt',async()=>{
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1050}),error=>error.code==='STALE_QUOTE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1031}),error=>error.code==='STALE_QUOTE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>1009}),error=>error.code==='CLOCK_UNAVAILABLE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>NaN}),error=>error.code==='CLOCK_UNAVAILABLE');
 await assert.rejects(fetchCandidate({readNowSeconds:()=>{throw Error('no clock');}}),error=>error.code==='CLOCK_UNAVAILABLE');
});
test('redirected or endpoint-substituted replies are rejected even when JSON is valid',async()=>{
 await assert.rejects(fetchCandidate({fetchImpl:transport({redirected:true})}),error=>error.code==='ENDPOINT_CHANGED');
 await assert.rejects(fetchCandidate({fetchImpl:transport({url:'https://other.example.invalid/executable-swap-quote'})}),error=>error.code==='ENDPOINT_CHANGED');
});
