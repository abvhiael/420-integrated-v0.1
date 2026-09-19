import test from 'node:test';
import assert from 'node:assert/strict';
import { SwapLifecycle, buildSwapIntent, canSubmitSwap, normalizeRouteQuote, quoteState } from '../core/swap.js';

const quote=()=>({
  quoteId:'q1',marketSubjectId:'m1',inputToken:'420',outputToken:'USD',amountIn:10,
  grossAmountOut:42,feeAmount:0.42,finalMinAmountOut:41,
  observedAt:100,expiresAt:130,routeHealthy:true,settlementHealthy:true,routeCommitment:'0xroute',
  hops:[{marketId:'m1',adapter:'a1',inputToken:'420',outputToken:'USD',amountIn:10,quotedAmountOut:42,minAmountOut:41.5}],
});

test('quote enforces 1..4 bounded hops and nonzero minima',()=>{
  assert.equal(normalizeRouteQuote(quote()).hops.length,1);
  assert.throws(()=>normalizeRouteQuote({...quote(),hops:[]}));
  assert.throws(()=>normalizeRouteQuote({...quote(),hops:[...Array(5)].map((_,i)=>({...quote().hops[0],marketId:'m'+i}))}));
  assert.throws(()=>normalizeRouteQuote({...quote(),hops:[{...quote().hops[0],minAmountOut:0}]}));
});

test('fee is charged once and final minimum is net-after-fee floor',()=>{
  const q=normalizeRouteQuote(quote());
  assert.equal(q.netAmountOut,41.58);
  assert.throws(()=>normalizeRouteQuote({...quote(),finalMinAmountOut:41.59}));
});

test('intent preserves V6/V9 exact-input path parameters',()=>{
  const intent=buildSwapIntent(quote(),{recipient:'0xrecipient',slippageBps:100});
  assert.equal(intent.kind,'EXACT_INPUT_PATH');
  assert.equal(intent.hops[0].minAmountOut,41.5);
  assert.equal(intent.finalMinAmountOut,41);
  assert.equal(intent.routeCommitment,'0xroute');
});

test('stale or unhealthy quotes fail submission gate',()=>{
  const q=normalizeRouteQuote(quote());
  const intent=buildSwapIntent(q,{recipient:'0xrecipient',slippageBps:100});
  assert.equal(quoteState(q,131),'stale');
  assert.deepEqual(canSubmitSwap({quote:q,intent,nowSeconds:131,walletReady:true}),{ok:false,reason:'stale-quote'});
  assert.equal(canSubmitSwap({quote:{...q,routeHealthy:false},intent,nowSeconds:110,walletReady:true}).reason,'route-unhealthy');
});

test('wallet unavailable keeps execution fail closed',()=>{
  const q=normalizeRouteQuote(quote());
  const intent=buildSwapIntent(q,{recipient:'0xrecipient',slippageBps:100});
  assert.equal(canSubmitSwap({quote:q,intent,nowSeconds:110,walletReady:false}).reason,'wallet-unavailable');
});

test('lifecycle cannot report confirmed before submission',()=>{
  const life=new SwapLifecycle();
  assert.throws(()=>life.confirmed());
  life.quoted(); life.review(); life.signing(); life.submitted('0xtx'); life.confirmed();
  assert.equal(life.state,'confirmed');
});
