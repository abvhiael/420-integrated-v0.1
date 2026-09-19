import {normalizeChainId} from './wallet-session.js';
import {prepareCanonicalSwap} from './canonical-execution-inputs.js';
import {canonicalSwapReview} from './human-readable-review.js';

export class QuoteIntakeError extends Error {
  constructor(code,message){super(message);this.name='QuoteIntakeError';this.code=code;}
}
const fail=(code,message)=>{throw new QuoteIntakeError(code,message);};
const addr=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v)&&!/^0x0{40}$/i.test(v);
const bytes32=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
const raw=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<(1n<<256n);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

// A transport response is only a REVIEW CANDIDATE. TLS and JSON schema validation
// do not authenticate the quote provider, establish on-chain qualification, or
// authorize a browser wallet prompt. This module never returns sourceAuthenticated.
export function validateExecutableSwapQuote({runtime,request,response,nowSeconds}={}){
  if(runtime?.deployment?.status!=='RESOLVED'||runtime.deployment.environment!=='testnet')fail('DEPLOYMENT_UNRESOLVED','verified testnet deployment required');
  if(!object(request)||!addr(request.account)||!addr(request.tokenIn)||!addr(request.tokenOut)||!raw(request.amountInRaw))fail('INVALID_REQUEST','explicit account, token pair and positive raw amount required');
  if(!object(response)||response.schema!=='420-exchange-executable-swap-quote-v1'||response.marketSource!=='api'||response.demo!==false||response.fixture!==false)fail('UNQUALIFIED_RESPONSE','executable quote schema and non-demo origin required');
  if(!bytes32(response.quoteId)||!Number.isSafeInteger(nowSeconds)||!Number.isSafeInteger(response.observedAt)||!Number.isSafeInteger(response.expiresAt)||response.observedAt>nowSeconds||nowSeconds-response.observedAt>30||response.expiresAt<=nowSeconds||response.expiresAt<=response.observedAt)fail('STALE_QUOTE','quote identity and current bounded validity required');
  let chain;
  try{chain=normalizeChainId(runtime.network?.chainId);if(normalizeChainId(response.chainId)!==chain)fail('CHAIN_MISMATCH','quote network differs from deployment');}
  catch(error){if(error instanceof QuoteIntakeError)throw error;fail('CHAIN_MISMATCH','valid matching quote network required');}
  if(!same(response.account,request.account))fail('ACCOUNT_MISMATCH','quote account differs from request');
  const execution=response.execution,reviewedIntent=response.reviewedIntent,tokens=response.tokens;
  if(!object(execution)||!object(reviewedIntent)||!object(tokens)||!Array.isArray(execution.hops)||!execution.hops.length||
     !same(execution.tokenIn,request.tokenIn)||!same(execution.hops.at(-1)?.tokenOut,request.tokenOut)||execution.amountInRaw!==request.amountInRaw||
     !addr(execution.recipient)||!same(execution.recipient,request.recipient)||!raw(execution.minFinalAmountOutRaw)||
     reviewedIntent.kind!=='EXACT_INPUT_PATH'||!same(reviewedIntent.recipient,request.recipient)||!bytes32(reviewedIntent.routeCommitment)||
     !same(reviewedIntent.routeCommitment,execution.expectedPathHash))fail('QUOTE_REQUEST_MISMATCH','quoted amounts, asset pair, recipient or route differ from request');
  if(request.minimumOutputRaw!==undefined&&(!raw(request.minimumOutputRaw)||BigInt(execution.minFinalAmountOutRaw)<BigInt(request.minimumOutputRaw)))fail('MINIMUM_OUTPUT_MISMATCH','quote violates user minimum output');
  const provenance={kind:'QUALIFIED_EXECUTION',fixture:false,demo:false,quoteId:response.quoteId,chainId:chain,account:request.account,observedAt:response.observedAt,expiresAt:response.expiresAt};
  let prepared,projection;
  try{
    prepared=prepareCanonicalSwap({runtime,marketSource:'api',account:request.account,provenance,nowSeconds,reviewedIntent,execution});
    projection=canonicalSwapReview({prepared,execution,tokens,quoteId:response.quoteId});
  }catch(error){fail('INVALID_QUOTE',`Quote cannot reconstruct a canonical review: ${error.code??error.message}`);}
  return Object.freeze({status:'REVIEW_CANDIDATE_ONLY',prepared,projection,execution,reviewedIntent,tokens,quoteId:response.quoteId});
}

// An endpoint must be explicitly configured; snapshots, fixture catalogs and
// guessed /quote paths are never used as fallbacks. Same-origin HTTPS relative
// to the configured API base prevents arbitrary endpoint substitution.
export async function fetchExecutableSwapReview({runtime,request,nowSeconds,fetchImpl=globalThis.fetch,signal,readNowSeconds=()=>Math.floor(Date.now()/1000)}={}){
  const configured=runtime?.api?.executableQuoteUrl,base=runtime?.api?.baseUrl;
  if(typeof configured!=='string'||typeof base!=='string')fail('ENDPOINT_UNCONFIGURED','live executable quote endpoint is not configured');
  let url,api;
  try{url=new URL(configured);api=new URL(base);}catch{fail('ENDPOINT_INVALID','invalid executable quote endpoint');}
  if(url.protocol!=='https:'||api.protocol!=='https:'||url.origin!==api.origin||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/executable-swap-quote'))fail('ENDPOINT_INVALID','configured executable quote URL must be HTTPS and on the configured API origin');
  if(typeof fetchImpl!=='function')fail('FETCH_UNAVAILABLE','quote transport unavailable');
  if(runtime?.deployment?.status!=='RESOLVED'||runtime.deployment.environment!=='testnet'||!object(request)||!addr(request.account)||!addr(request.tokenIn)||!addr(request.tokenOut)||!addr(request.recipient)||!raw(request.amountInRaw))fail('INVALID_REQUEST','resolved testnet runtime and explicit canonical swap request required');
  // Caller-supplied timestamps may be used for deterministic intake tests only;
  // the response MUST be checked against the actual clock at receipt, not the
  // timestamp captured before awaiting the network or JSON parser.
  if(typeof readNowSeconds!=='function')fail('CLOCK_UNAVAILABLE','trusted quote receipt clock required');
  let response;
  try{response=await fetchImpl(url.href,{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({schema:'420-exchange-swap-quote-request-v1',account:request.account,tokenIn:request.tokenIn,tokenOut:request.tokenOut,recipient:request.recipient,amountInRaw:request.amountInRaw,minimumOutputRaw:request.minimumOutputRaw??null}),signal});}
  catch{fail('TRANSPORT_ERROR','live executable quote request failed');}
  if(response?.redirected===true||(typeof response?.url==='string'&&response.url.length>0&&response.url!==url.href))fail('ENDPOINT_CHANGED','quote transport followed an unexpected endpoint');
  if(!response?.ok||response?.headers?.get?.('content-type')?.toLowerCase().includes('application/json')!==true)fail('UNQUALIFIED_RESPONSE','quote endpoint did not return a successful JSON response');
  let body;
  try{body=await response.json();}catch{fail('UNQUALIFIED_RESPONSE','invalid quote response JSON');}
  let receivedAt;
  try{receivedAt=readNowSeconds();}catch{fail('CLOCK_UNAVAILABLE','quote receipt clock unavailable');}
  if(!Number.isSafeInteger(receivedAt))fail('CLOCK_UNAVAILABLE','valid quote receipt clock required');
  if(Number.isSafeInteger(nowSeconds)&&receivedAt<nowSeconds)fail('CLOCK_UNAVAILABLE','receipt clock precedes quote request');
  return validateExecutableSwapQuote({runtime,request,response:body,nowSeconds:receivedAt});
}
