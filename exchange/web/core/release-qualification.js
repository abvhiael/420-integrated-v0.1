import { normalizeMarket } from './markets.js';
import { normalizeRouteQuote, buildSwapIntent, canSubmitSwap } from './swap.js';
import { buildLimitOrderDraft, canCancelOrder } from './limit-orders.js';
import { normalizeBridgeRoute, buildBridgeIntent, canSubmitBridge } from './bridge.js';
import { WalletSession, signingGate } from './wallet-session.js';
import { classifyApiFailure } from './reliability.js';
import { freezeReviewedIntent, reviewedIntentDigest, assertReviewedIntentUnchanged } from './security.js';

export const GENESIS_RELEASE_DRILLS=Object.freeze([
  'MARKET_BROWSE',
  'SWAP_REVIEW',
  'LIMIT_ORDER_REVIEW',
  'BRIDGE_REVIEW',
  'WALLET_NETWORK_CHANGE',
  'STALE_API',
  'REORG_REPLACEMENT',
  'MOBILE_BROWSER',
  'PRODUCTION_ARTIFACT',
]);

export const PERFORMANCE_BUDGETS=Object.freeze({
  maxHtmlBytes:100_000,
  maxJsBytes:300_000,
  maxCssBytes:200_000,
  maxTotalStaticBytes:1_000_000,
});

export const BROWSER_MATRIX=Object.freeze([
  'Chrome current-2',
  'Edge current-2',
  'Firefox current-2',
  'Safari current-2',
  'iOS Safari current-2',
  'Android Chrome current-2',
]);

export function releaseGate({market,quote,order,bridgeRoute,walletSession,expectedChainId,nowSeconds}){
  const m=normalizeMarket(market);
  const q=normalizeRouteQuote(quote);
  const swapIntent=freezeReviewedIntent(buildSwapIntent(q,{recipient:walletSession.account,slippageBps:100}));
  const swapDigest=reviewedIntentDigest(swapIntent);
  assertReviewedIntentUnchanged(swapIntent,swapDigest);
  const walletGate=signingGate({
    session:walletSession,
    expectedChainId,
    intent:swapIntent,
    intentGeneration:walletSession.generation,
  });
  const swapGate=canSubmitSwap({quote:q,intent:swapIntent,nowSeconds,walletReady:walletGate.ok});

  const orderDraft=freezeReviewedIntent(buildLimitOrderDraft(order));
  const orderDigest=reviewedIntentDigest(orderDraft);
  assertReviewedIntentUnchanged(orderDraft,orderDigest);

  const route=normalizeBridgeRoute(bridgeRoute);
  const bridgeIntent=freezeReviewedIntent(buildBridgeIntent(route,{amount:1,recipient:walletSession.account}));
  const bridgeDigest=reviewedIntentDigest(bridgeIntent);
  assertReviewedIntentUnchanged(bridgeIntent,bridgeDigest);
  const bridgeGate=canSubmitBridge({route,intent:bridgeIntent,walletReady:walletGate.ok});

  return Object.freeze({
    marketId:m.marketSubjectId,
    marketCanonical:m.canonicality==='canonical'||m.canonicality==='finalized',
    wallet:walletGate,
    swap:swapGate,
    bridge:bridgeGate,
    orderReviewDigest:orderDigest,
    swapReviewDigest:swapDigest,
    bridgeReviewDigest:bridgeDigest,
  });
}

export function staleApiDrill(error){
  return classifyApiFailure(error);
}

export function walletInvalidationDrill(session,nextAccount){
  const generation=session.generation;
  session.accountChanged(nextAccount);
  return session.generation>generation;
}

export function assetBudget(files){
  const html=Number(files.html??0), js=Number(files.js??0), css=Number(files.css??0);
  const total=html+js+css+Number(files.other??0);
  return {
    html,js,css,total,
    ok:html<=PERFORMANCE_BUDGETS.maxHtmlBytes
      && js<=PERFORMANCE_BUDGETS.maxJsBytes
      && css<=PERFORMANCE_BUDGETS.maxCssBytes
      && total<=PERFORMANCE_BUDGETS.maxTotalStaticBytes,
  };
}

export function qualifiedReleaseState({ciGreen,artifactQualified,operationalGates=[]}){
  const pending=operationalGates.filter((gate)=>gate.status!=='complete');
  return Object.freeze({
    repositoryQualified:Boolean(ciGreen&&artifactQualified),
    productionLive:Boolean(ciGreen&&artifactQualified&&pending.length===0),
    pendingOperationalGates:pending.map((gate)=>gate.id),
  });
}
