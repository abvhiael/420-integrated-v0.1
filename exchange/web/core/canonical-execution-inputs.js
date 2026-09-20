import { normalizeAccount, normalizeChainId } from './wallet-session.js';
import { buildSwapTransaction, buildLimitOrderTypedData, buildLimitOrderCancelTransaction, buildBridgeOutboundTransaction } from './execution.js';
import { transactionFingerprint } from './preflight.js';

export class CanonicalInputError extends Error {
  constructor(code, message) { super(message); this.name='CanonicalInputError'; this.code=code; }
}

const id32=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value);
const positiveRaw=value=>typeof value==='string'&&/^[0-9]+$/.test(value)&&BigInt(value)>0n&&BigInt(value)<(1n<<256n);
const fail=(code,message)=>{throw new CanonicalInputError(code,message);};

// This validates the adapter boundary; provenance fields are NOT a signature or proof of
// chain state. A trusted authenticated quote endpoint and live on-chain preflight are
// still required before any resulting envelope can be sent by the wallet controller.
export function requireCanonicalContext({runtime,marketSource,account,provenance,nowSeconds}={}) {
  if(runtime?.deployment?.status!=='RESOLVED'||runtime?.deployment?.environment!=='testnet')fail('DEPLOYMENT_UNRESOLVED','verified testnet deployment required');
  if(marketSource!=='api')fail('FIXTURE_SOURCE','demo and display-only data cannot authorize execution');
  if(!provenance||provenance.kind!=='QUALIFIED_EXECUTION'||provenance.fixture===true||provenance.demo===true)fail('UNQUALIFIED_SOURCE','qualified execution provenance required');
  if(!id32(provenance.quoteId)||!Number.isSafeInteger(provenance.observedAt)||!Number.isSafeInteger(provenance.expiresAt))fail('INVALID_PROVENANCE','canonical quote identity and timestamps required');
  if(!Number.isSafeInteger(nowSeconds)||provenance.observedAt>nowSeconds||provenance.expiresAt<=nowSeconds||nowSeconds-provenance.observedAt>30)fail('STALE_QUOTE','execution quote is future-dated, expired or stale');
  if(!address(account))fail('INVALID_ACCOUNT','connected wallet account required');
  let chain;
  try{chain=normalizeChainId(runtime.network?.chainId);}catch{fail('CHAIN_UNCONFIGURED','canonical network chain ID required');}
  try{if(normalizeChainId(provenance.chainId)!==chain)fail('CHAIN_MISMATCH','quote chain differs from testnet runtime');}catch(error){if(error instanceof CanonicalInputError)throw error;fail('CHAIN_MISMATCH','invalid quote chain');}
  if(!address(provenance.account)||normalizeAccount(provenance.account)!==normalizeAccount(account))fail('ACCOUNT_MISMATCH','quote wallet account changed');
  return Object.freeze({account:normalizeAccount(account),chainId:chain,quoteId:provenance.quoteId.toLowerCase(),observedAt:provenance.observedAt,expiresAt:provenance.expiresAt});
}

function requireRaw(fields){for(const [label,value] of Object.entries(fields))if(!positiveRaw(value))fail('INVALID_RAW_AMOUNT',`${label} must be a positive decimal raw-unit string`);}
function freezePrepared(kind,context,transaction,reviewedIntent){return Object.freeze({kind,context,transaction,reviewedIntent,transactionFingerprint:transactionFingerprint(transaction),freshness:Object.freeze({observedAt:context.observedAt,expiresAt:context.expiresAt})});}

export function prepareCanonicalSwap({runtime,marketSource,account,provenance,nowSeconds,reviewedIntent,execution}={}) {
  const context=requireCanonicalContext({runtime,marketSource,account,provenance,nowSeconds});
  if(!reviewedIntent||reviewedIntent.kind!=='EXACT_INPUT_PATH'||!id32(reviewedIntent.routeCommitment))fail('REVIEW_REQUIRED','reviewed canonical swap path and commitment required');
  if(!execution||!Array.isArray(execution.hops)||execution.hops.length<1||execution.hops.some(h=>!id32(h.marketId)||!id32(h.routeId)||!positiveRaw(h.minAmountOutRaw)))fail('INVALID_ROUTE','canonical raw-unit hop data required');
  requireRaw({amountInRaw:execution.amountInRaw,minFinalAmountOutRaw:execution.minFinalAmountOutRaw});
  if(!id32(execution.expectedPathHash)||execution.expectedPathHash.toLowerCase()!==reviewedIntent.routeCommitment.toLowerCase())fail('ROUTE_CHANGED','route commitment differs from reviewed quote');
  const transaction=buildSwapTransaction({runtime,account:context.account,reviewedIntent,execution});
  return freezePrepared('SWAP',context,transaction,reviewedIntent);
}

export function prepareCanonicalBridge({runtime,marketSource,account,provenance,nowSeconds,reviewedIntent,execution}={}) {
  const context=requireCanonicalContext({runtime,marketSource,account,provenance,nowSeconds});
  if(!reviewedIntent||reviewedIntent.kind!=='BRIDGE_WITHDRAWAL'||!id32(reviewedIntent.routeId)||!id32(reviewedIntent.adapterId)||!id32(reviewedIntent.exchangeAssetId))fail('REVIEW_REQUIRED','reviewed qualified bridge IDs required');
  if(!execution||!id32(execution.routeId)||!id32(execution.adapterId)||!id32(execution.assetId)||!positiveRaw(execution.amountRaw))fail('INVALID_BRIDGE','canonical bridge IDs and raw-unit amount required');
  const transaction=buildBridgeOutboundTransaction({runtime,account:context.account,reviewedIntent,execution});
  return freezePrepared('BRIDGE',context,transaction,reviewedIntent);
}

export function prepareCanonicalOrder({runtime,marketSource,account,provenance,nowSeconds,reviewedOrder,execution}={}) {
  const context=requireCanonicalContext({runtime,marketSource,account,provenance,nowSeconds});
  if(!reviewedOrder||!execution||!address(execution.maker)||normalizeAccount(execution.maker)!==context.account)fail('REVIEW_REQUIRED','maker-owned reviewed order required');
  requireRaw({sellAmountRaw:execution.sellAmountRaw,minBuyAmountRaw:execution.minBuyAmountRaw});
  const signingRequest=buildLimitOrderTypedData({runtime,reviewedOrder,execution});
  if(BigInt(signingRequest.order.expiry)<=BigInt(nowSeconds))fail('STALE_ORDER','limit order has expired');
  return Object.freeze({kind:'LIMIT_ORDER',context,signingRequest,reviewedOrder});
}

export function prepareCanonicalCancellation({runtime,marketSource,account,provenance,nowSeconds,signedOrder}={}) {
  const context=requireCanonicalContext({runtime,marketSource,account,provenance,nowSeconds});
  if(!signedOrder||!address(signedOrder.maker)||normalizeAccount(signedOrder.maker)!==context.account)fail('MAKER_MISMATCH','only the connected order maker may cancel');
  const transaction=buildLimitOrderCancelTransaction({runtime,account:context.account,signedOrder});
  return freezePrepared('ORDER_CANCEL',context,transaction,signedOrder);
}
