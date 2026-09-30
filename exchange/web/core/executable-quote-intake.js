import {normalizeChainId} from './wallet-session.js';
import {prepareCanonicalSwap} from './canonical-execution-inputs.js';
import {canonicalSwapReview} from './human-readable-review.js';
import {createQuoteReplayGuard,verifyQuoteAuthentication} from './quote-authentication.js';

export class QuoteIntakeError extends Error {
  constructor(code,message){super(message);this.name='QuoteIntakeError';this.code=code;}
}
const fail=(code,message)=>{throw new QuoteIntakeError(code,message);};
const addr=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v)&&!/^0x0{40}$/i.test(v);
const bytes32=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
const raw=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<(1n<<256n);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const rawZero=v=>typeof v==='string'&&/^(?:0|[1-9][0-9]*)$/.test(v)&&BigInt(v)<(1n<<256n);
function exactKeys(value,allowed,code='UNQUALIFIED_RESPONSE'){
  if(!object(value))fail(code,'quote object required');
  const actual=Object.keys(value).sort(),expected=[...allowed].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))fail(code,'quote contains missing or unknown fields');
}
function validateExactQuoteShape(response){
  exactKeys(response,['schema','marketSource','demo','fixture','quoteId','chainId','account','observedAt','expiresAt','deployment','replayDomain','transactionFingerprint','reviewedIntent','execution','tokens','fees','quoteEconomics','builder','producer','authentication']);
  exactKeys(response.deployment,['deploymentId','manifestHash','router','spender']);
  exactKeys(response.producer,['schema','id','keyVersion','algorithm','authentication']);
  exactKeys(response.authentication,['schema','algorithm','producerId','keyVersion','publicKeyFingerprint','revocationEpoch','payloadHash','signature']);
  exactKeys(response.quoteEconomics,['grossAmountOutRaw','feeAmountRaw','netAmountOutRaw','minimumNetAmountOutRaw']);
  exactKeys(response.builder,['kind','router','spender','value','execution']);
  exactKeys(response.tokens,['input','output']);
  exactKeys(response.tokens.input,['assetId','address','symbol','decimals','verified']);
  exactKeys(response.tokens.output,['assetId','address','symbol','decimals','verified']);
  exactKeys(response.fees,['outputToken','totalFeeRaw','rateBps','components']);
  if(!Array.isArray(response.fees.components)||response.fees.components.length>16)fail('UNQUALIFIED_RESPONSE','invalid fee components');
  for(const component of response.fees.components)exactKeys(component,['label','amountRaw']);
  exactKeys(response.reviewedIntent,['kind','recipient','routeCommitment','hops']);
  if(!Array.isArray(response.reviewedIntent.hops)||!response.reviewedIntent.hops.length||response.reviewedIntent.hops.length>8)fail('UNQUALIFIED_RESPONSE','invalid reviewed route');
  for(const hop of response.reviewedIntent.hops)exactKeys(hop,['marketId','outputToken']);
  exactKeys(response.execution,['mode','tokenIn','recipient','amountInRaw','minFinalAmountOutRaw','expectedPathHash','hops']);
  if(!Array.isArray(response.execution.hops)||!response.execution.hops.length||response.execution.hops.length>8)fail('UNQUALIFIED_RESPONSE','invalid execution route');
  for(const hop of response.execution.hops)exactKeys(hop,['marketId','routeId','tokenOut','minAmountOutRaw','routeData']);
}

const DEFAULT_REPLAY_GUARD=createQuoteReplayGuard();

// Transport/schema checks alone produce only REVIEW_CANDIDATE provenance.
// PRE-05 promotion to AUTHENTICATED_EXECUTION happens only after independent
// Ed25519 verification against the pinned runtime producer policy.
export function validateExecutableSwapQuote({runtime,request,response,nowSeconds}={}){
  if(runtime?.deployment?.status!=='RESOLVED'||runtime.deployment.environment!=='testnet')fail('DEPLOYMENT_UNRESOLVED','verified testnet deployment required');
  if(!object(request)||!addr(request.account)||!addr(request.tokenIn)||!addr(request.tokenOut)||!raw(request.amountInRaw))fail('INVALID_REQUEST','explicit account, token pair and positive raw amount required');
  if(!object(response)||response.schema!=='420-exchange-executable-swap-quote-v1'||response.marketSource!=='api'||response.demo!==false||response.fixture!==false)fail('UNQUALIFIED_RESPONSE','executable quote schema and non-demo origin required');
  validateExactQuoteShape(response);
  if(!bytes32(response.replayDomain)||!bytes32(response.transactionFingerprint)||response.producer?.schema!=='420-exchange-quote-producer-v1'||response.producer?.algorithm!=='Ed25519'||response.producer?.authentication!=='ED25519_PRE05')fail('UNQUALIFIED_RESPONSE','PRE-05 producer and signed execution identity required');
  if(response.authentication?.schema!=='420-exchange-quote-auth-v1'||response.authentication?.algorithm!=='Ed25519'||response.authentication?.producerId!==response.producer.id||response.authentication?.keyVersion!==response.producer.keyVersion)fail('UNQUALIFIED_RESPONSE','producer/authentication identity mismatch');
  if(!raw(response.quoteEconomics?.grossAmountOutRaw)||!rawZero(response.quoteEconomics?.feeAmountRaw)||!raw(response.quoteEconomics?.netAmountOutRaw)||!raw(response.quoteEconomics?.minimumNetAmountOutRaw))fail('UNQUALIFIED_RESPONSE','canonical quote economics required');
  if(!object(response.builder)||response.builder.kind!=='CANONICAL_SWAP_INPUTS_V1'||!same(response.builder.router,response.deployment?.router)||!same(response.builder.spender,response.deployment?.spender)||response.builder.value!=='0x0'||JSON.stringify(response.builder.execution)!==JSON.stringify(response.execution))fail('UNQUALIFIED_RESPONSE','builder inputs differ from signed execution');
  if(response.quoteEconomics.minimumNetAmountOutRaw!==response.execution.minFinalAmountOutRaw)fail('UNQUALIFIED_RESPONSE','minimum output differs from signed economics');
  if(!same(response.fees?.outputToken,response.tokens?.output?.address)||!rawZero(response.fees?.totalFeeRaw)||response.fees.totalFeeRaw!==response.quoteEconomics.feeAmountRaw)fail('UNQUALIFIED_RESPONSE','fee disclosure differs from signed economics');
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
  const provenance={kind:'REVIEW_CANDIDATE',fixture:false,demo:false,quoteId:response.quoteId,chainId:chain,account:request.account,observedAt:response.observedAt,expiresAt:response.expiresAt};
  let prepared,projection;
  try{
    prepared=prepareCanonicalSwap({runtime,marketSource:'api',account:request.account,provenance,nowSeconds,reviewedIntent,execution});
    projection=canonicalSwapReview({prepared,execution,tokens,quoteId:response.quoteId,fees:response.fees??null});
  }catch(error){fail('INVALID_QUOTE',`Quote cannot reconstruct a canonical review: ${error.code??error.message}`);}
  return Object.freeze({status:'REVIEW_CANDIDATE_ONLY',prepared,projection,execution,reviewedIntent,tokens,quoteId:response.quoteId,response});
}

export async function authenticateExecutableSwapQuote({runtime,request,response,nowSeconds,endpointUrl,replayGuard=DEFAULT_REPLAY_GUARD}={}){
  const candidate=validateExecutableSwapQuote({runtime,request,response,nowSeconds});
  let authentication;
  try{
    authentication=await verifyQuoteAuthentication({runtime,quote:response,prepared:candidate.prepared,nowSeconds,endpointUrl});
  }catch(error){fail(error?.code??'AUTHENTICATION_FAILED',error?.message??'quote authentication failed');}
  if(!replayGuard?.assertFresh)fail('REPLAY_GUARD_UNAVAILABLE','quote replay guard required');
  try{replayGuard.assertFresh({quoteId:response.quoteId,replayDomain:response.replayDomain,expiresAt:response.expiresAt,nowSeconds});}
  catch(error){fail(error?.code??'QUOTE_REPLAYED',error?.message??'quote replay rejected');}

  const provenance={
    kind:'AUTHENTICATED_EXECUTION',fixture:false,demo:false,quoteId:response.quoteId,chainId:response.chainId,account:request.account,
    observedAt:response.observedAt,expiresAt:response.expiresAt,authentication,
  };
  let prepared,projection;
  try{
    prepared=prepareCanonicalSwap({runtime,marketSource:'api',account:request.account,provenance,nowSeconds,reviewedIntent:response.reviewedIntent,execution:response.execution});
    projection=canonicalSwapReview({prepared,execution:response.execution,tokens:response.tokens,quoteId:response.quoteId,fees:response.fees??null});
  }catch(error){fail('INVALID_AUTHENTICATED_QUOTE',`Authenticated quote cannot reconstruct canonical review: ${error.code??error.message}`);}
  if(prepared.transactionFingerprint!==authentication.transactionFingerprint)fail('FINGERPRINT_MISMATCH','authenticated transaction fingerprint changed during preparation');
  return Object.freeze({
    status:'TRUSTED_EXECUTION_QUOTE',prepared,projection,execution:response.execution,reviewedIntent:response.reviewedIntent,
    tokens:response.tokens,quoteId:response.quoteId,authentication,response,
  });
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
  return authenticateExecutableSwapQuote({runtime,request,response:body,nowSeconds:receivedAt,endpointUrl:url.href});
}
