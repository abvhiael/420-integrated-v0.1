export const SWAP_STATES = Object.freeze(['draft','quoted','review','signing','submitted','confirmed','failed']);

function amount(value,label) {
  const n=typeof value==='number'?value:Number(value);
  if (!Number.isFinite(n) || n<=0) throw new Error(`invalid ${label}`);
  return n;
}

export function normalizeRouteQuote(quote) {
  if (!quote?.quoteId || !quote?.marketSubjectId || !quote?.inputToken || !quote?.outputToken) throw new Error('quote identity required');
  if (!Array.isArray(quote.hops) || quote.hops.length<1 || quote.hops.length>4) throw new Error('quote hop count must be 1..4');
  const amountIn=amount(quote.amountIn,'amountIn');
  const grossAmountOut=amount(quote.grossAmountOut,'grossAmountOut');
  const feeAmount=Number(quote.feeAmount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount<0 || feeAmount>=grossAmountOut) throw new Error('invalid feeAmount');
  const netAmountOut=grossAmountOut-feeAmount;
  const finalMinAmountOut=amount(quote.finalMinAmountOut,'finalMinAmountOut');
  if (finalMinAmountOut>netAmountOut) throw new Error('final minimum exceeds quoted net output');
  const hops=quote.hops.map((hop,index)=>{
    if (!hop?.marketId || !hop?.adapter || !hop?.inputToken || !hop?.outputToken) throw new Error(`invalid hop ${index}`);
    return {
      ...hop,
      amountIn:amount(hop.amountIn,`hop ${index} amountIn`),
      quotedAmountOut:amount(hop.quotedAmountOut,`hop ${index} quotedAmountOut`),
      minAmountOut:amount(hop.minAmountOut,`hop ${index} minAmountOut`),
    };
  });
  const now=Number(quote.observedAt);
  const expiresAt=Number(quote.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiresAt) || expiresAt<=now) throw new Error('invalid quote freshness window');
  return {
    ...quote,
    amountIn,grossAmountOut,feeAmount,netAmountOut,finalMinAmountOut,hops,
    observedAt:now,expiresAt,
    routeHealthy:quote.routeHealthy===true,
    settlementHealthy:quote.settlementHealthy===true,
  };
}

export function quoteState(quote, nowSeconds) {
  if (!quote) return 'degraded';
  if (nowSeconds>quote.expiresAt) return 'stale';
  if (!quote.routeHealthy || !quote.settlementHealthy) return 'degraded';
  return 'canonical';
}

export function buildSwapIntent(quote,{recipient,slippageBps}) {
  const normalized=normalizeRouteQuote(quote);
  if (quoteState(normalized,normalized.observedAt)!=='canonical') throw new Error('unhealthy quote');
  if (typeof recipient!=='string' || !recipient) throw new Error('recipient required');
  if (!Number.isInteger(slippageBps) || slippageBps<0 || slippageBps>5000) throw new Error('invalid slippage bps');
  return Object.freeze({
    kind:'EXACT_INPUT_PATH',
    quoteId:normalized.quoteId,
    marketSubjectId:normalized.marketSubjectId,
    inputToken:normalized.inputToken,
    outputToken:normalized.outputToken,
    amountIn:normalized.amountIn,
    recipient,
    hops:normalized.hops.map((hop)=>Object.freeze({
      marketId:hop.marketId,
      adapter:hop.adapter,
      inputToken:hop.inputToken,
      outputToken:hop.outputToken,
      amountIn:hop.amountIn,
      minAmountOut:hop.minAmountOut,
    })),
    finalMinAmountOut:normalized.finalMinAmountOut,
    quotedGrossAmountOut:normalized.grossAmountOut,
    quotedFeeAmount:normalized.feeAmount,
    quotedNetAmountOut:normalized.netAmountOut,
    slippageBps,
    expiresAt:normalized.expiresAt,
    routeCommitment:normalized.routeCommitment ?? null,
  });
}

export function canSubmitSwap({quote,intent,nowSeconds,walletReady=false}) {
  if (!quote || !intent) return {ok:false,reason:'missing-review'};
  if (quoteState(quote,nowSeconds)==='stale') return {ok:false,reason:'stale-quote'};
  if (!quote.routeHealthy) return {ok:false,reason:'route-unhealthy'};
  if (!quote.settlementHealthy) return {ok:false,reason:'settlement-unhealthy'};
  if (!walletReady) return {ok:false,reason:'wallet-unavailable'};
  return {ok:true,reason:null};
}

export class SwapLifecycle {
  constructor(){ this.state='draft'; this.txHash=null; this.error=null; }
  quoted(){ if(this.state!=='draft') throw new Error('invalid swap transition'); this.state='quoted'; }
  review(){ if(this.state!=='quoted') throw new Error('invalid swap transition'); this.state='review'; }
  signing(){ if(this.state!=='review') throw new Error('invalid swap transition'); this.state='signing'; }
  submitted(txHash){ if(this.state!=='signing'||!txHash) throw new Error('invalid swap transition'); this.state='submitted'; this.txHash=txHash; }
  confirmed(){ if(this.state!=='submitted') throw new Error('invalid swap transition'); this.state='confirmed'; }
  failed(error){ if(!SWAP_STATES.includes(this.state)) throw new Error('invalid swap state'); this.state='failed'; this.error=String(error??'swap failed'); }
}
