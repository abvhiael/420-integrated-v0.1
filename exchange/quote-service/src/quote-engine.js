import {buildSwapTransaction} from '../../web/core/execution.js';
import {transactionFingerprint} from '../../web/core/preflight.js';
import {keccak256} from '../../web/core/abi.js';
import {fail} from './errors.js';
import {hash32,validateAsset,validateRoutePlan} from './canonical.js';
import {normalizeChainId} from './validation.js';

export const REQUEST_SCHEMA='420-exchange-swap-quote-request-v1';
export const RESPONSE_SCHEMA='420-exchange-executable-swap-quote-v1';
export const PRODUCER_SCHEMA='420-exchange-quote-producer-v1';

export function createQuoteEngine({
  chainId,router,spender=router,deploymentId,manifestHash,serviceId='420/service/exchange-quote/v1',
  routeSource,chainAdapter,maxRouteHops=8,maxRouteDataBytes=4096,quoteTtlSeconds=30,maxInputAgeSeconds=15,
  clock=()=>Math.floor(Date.now()/1000),
  signer=null,
}={}){
  const canonicalChainId=normalizeChainId(chainId);
  if(!/^0x[0-9a-f]{40}$/i.test(router??'')||!/^0x[0-9a-f]{40}$/i.test(spender??''))fail('SERVICE_CONFIG_INVALID','router and spender addresses required',{status:503});
  if(!/^0x[0-9a-f]{64}$/i.test(deploymentId??'')||!/^0x[0-9a-f]{64}$/i.test(manifestHash??''))fail('SERVICE_CONFIG_INVALID','deployment and manifest identity required',{status:503});
  if(!routeSource?.quoteExactInput||!chainAdapter?.snapshot)fail('SERVICE_CONFIG_INVALID','route and chain adapters required',{status:503});

  return async function quote(request){
    const observedAt=clock();
    if(!Number.isSafeInteger(observedAt)||observedAt<=0)fail('CLOCK_INVALID','quote clock unavailable',{status:503,retryable:true});
    let state,plan;
    try{[state,plan]=await Promise.all([chainAdapter.snapshot(request),routeSource.quoteExactInput(request,{chainId:canonicalChainId,observedAt})]);}
    catch(error){throw error;}
    if(!state||state.deployment?.deploymentId?.toLowerCase()!==deploymentId.toLowerCase()||state.deployment?.manifestHash?.toLowerCase()!==manifestHash.toLowerCase())fail('DEPLOYMENT_MISMATCH','chain adapter deployment identity mismatch',{status:503});
    if(state.chainId===null||state.chainId===undefined||normalizeChainId(state.chainId)!==canonicalChainId)fail('CHAIN_MISMATCH','chain adapter state belongs to another chain',{status:503});
    if(!Number.isSafeInteger(state.observedAt)||state.observedAt<=0||state.observedAt>observedAt||observedAt-state.observedAt>maxInputAgeSeconds)fail('STALE_INPUT','chain state input is stale',{status:503,retryable:true});
    const input=validateAsset(state.assets?.input,request.tokenIn),output=validateAsset(state.assets?.output,request.tokenOut);
    const route=validateRoutePlan(plan,{tokenIn:request.tokenIn,tokenOut:request.tokenOut,maxHops:maxRouteHops,maxRouteDataBytes});
    if(route.observedAt>observedAt||observedAt-route.observedAt>maxInputAgeSeconds)fail('STALE_INPUT','route input is stale',{status:503,retryable:true});
    if(!Number.isInteger(state.feeBps)||state.feeBps<0||state.feeBps>100)fail('FEE_POLICY_INVALID','exchange fee policy unavailable',{status:503});
    const gross=BigInt(route.grossAmountOutRaw),fee=gross*BigInt(state.feeBps)/10_000n,net=gross-fee;
    if(net<=0n||net<BigInt(request.minimumOutputRaw))fail('MINIMUM_OUTPUT_UNMET','route cannot satisfy requested minimum net output',{status:422});
    const expectedPathHash=hash32(route.hops.map(h=>({marketId:h.marketId,routeId:h.routeId,tokenIn:h.tokenIn,tokenOut:h.tokenOut,routeData:h.routeData})));
    const reviewedIntent={kind:'EXACT_INPUT_PATH',recipient:request.recipient,routeCommitment:expectedPathHash,hops:route.hops.map(h=>({marketId:h.marketId,outputToken:h.tokenOut}))};
    const execution={mode:'ERC20_TO_ERC20',tokenIn:request.tokenIn,recipient:request.recipient,amountInRaw:request.amountInRaw,minFinalAmountOutRaw:request.minimumOutputRaw,expectedPathHash,hops:route.hops.map(h=>({marketId:h.marketId,routeId:h.routeId,tokenOut:h.tokenOut,minAmountOutRaw:h.minAmountOutRaw,routeData:h.routeData}))};
    const expiresAt=observedAt+quoteTtlSeconds;
    const quoteId=hash32({request,chainId:canonicalChainId,deploymentId,manifestHash,expectedPathHash,grossAmountOutRaw:gross.toString(),feeBps:state.feeBps,observedAt,expiresAt});
    const replayDomain=keccak256([
      serviceId,canonicalChainId,deploymentId.toLowerCase(),manifestHash.toLowerCase(),router.toLowerCase(),
      request.account.toLowerCase(),quoteId.toLowerCase(),String(expiresAt),
    ].join('|'));
    const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:canonicalChainId},contracts:{ExchangeAtomicRouter420:router.toLowerCase()}};
    const transaction=buildSwapTransaction({runtime,account:request.account,reviewedIntent,execution});
    const fingerprint=transactionFingerprint(transaction);
    const fees={outputToken:output.address,totalFeeRaw:fee.toString(),rateBps:state.feeBps,components:[{label:'exchange protocol',amountRaw:fee.toString()}]};
    const quote=Object.freeze({
      schema:RESPONSE_SCHEMA,marketSource:'api',demo:false,fixture:false,quoteId,chainId:canonicalChainId,account:request.account,
      observedAt,expiresAt,
      deployment:Object.freeze({deploymentId:deploymentId.toLowerCase(),manifestHash:manifestHash.toLowerCase(),router:router.toLowerCase(),spender:spender.toLowerCase()}),
      replayDomain,transactionFingerprint:fingerprint,
      reviewedIntent:Object.freeze(reviewedIntent),execution:Object.freeze(execution),
      tokens:Object.freeze({input,output}),fees:Object.freeze(fees),
      quoteEconomics:Object.freeze({grossAmountOutRaw:gross.toString(),feeAmountRaw:fee.toString(),netAmountOutRaw:net.toString(),minimumNetAmountOutRaw:request.minimumOutputRaw}),
      builder:Object.freeze({kind:'CANONICAL_SWAP_INPUTS_V1',router:router.toLowerCase(),spender:spender.toLowerCase(),value:'0x0',execution}),
      producer:Object.freeze({
        schema:PRODUCER_SCHEMA,id:signer?.producerId??'UNAUTHENTICATED',keyVersion:signer?.keyVersion??'NONE',
        algorithm:signer?.algorithm??'UNSIGNED',authentication:signer?'ED25519_PRE05':'UNAUTHENTICATED',
      }),
    });
    return signer?.signQuote?signer.signQuote(quote):quote;
  };
}

export const SIGNER_ROTATION_MODEL=Object.freeze({
  schema:'420-exchange-quote-signer-rotation-v1',
  status:'DESIGN_ONLY_PRE04',
  activeKeyVersion:null,
  acceptedKeyVersions:[],
  overlapSeconds:0,
  rules:Object.freeze([
    'PRE-04 stores no private signing key',
    'PRE-05 must bind key version and producer identity into the authenticated quote envelope',
    'rotation must support bounded overlap and explicit revocation without changing quote semantics',
    'retired keys must not authenticate newly issued quotes',
  ]),
});
