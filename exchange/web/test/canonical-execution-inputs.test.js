import test from 'node:test';
import assert from 'node:assert/strict';
import {requireCanonicalContext,prepareCanonicalSwap,prepareCanonicalBridge,prepareCanonicalOrder,prepareCanonicalCancellation} from '../core/canonical-execution-inputs.js';
const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},contracts:{ExchangeAtomicRouter420:address(100),ExchangeLimitOrderSettlement420:address(101),GatewayRouter420:address(102)}};
const account=address(1);
const provenance={kind:'QUALIFIED_EXECUTION',fixture:false,demo:false,quoteId:id(99),chainId:'0x420',account,observedAt:1000,expiresAt:1100};
const base={runtime,marketSource:'api',account,provenance,nowSeconds:1010};
const reviewedIntent={kind:'EXACT_INPUT_PATH',recipient:address(2),routeCommitment:id(900),hops:[{marketId:id(10),outputToken:address(4)}]};
const execution={mode:'ERC20_TO_ERC20',tokenIn:address(3),recipient:address(2),amountInRaw:'100',minFinalAmountOutRaw:'90',expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut:address(4),minAmountOutRaw:'90',routeData:'0x'}]};
const swap=overrides=>prepareCanonicalSwap({...base,reviewedIntent,execution,...overrides});
test('canonical swap preparation derives calldata and fingerprint from reviewed raw-unit inputs',()=>{
 const result=swap();assert.equal(result.kind,'SWAP');assert.equal(result.transaction.kind,'SWAP');assert.equal(result.transaction.request.from,account);assert.match(result.transactionFingerprint,/^0x[0-9a-f]{64}$/);assert.deepEqual(result.freshness,{observedAt:1000,expiresAt:1100});
});
test('no fixture, demo, unresolved deployment, unsigned provenance or unconfigured chain qualifies',()=>{
 for(const change of [{marketSource:'demo'},{runtime:{...runtime,deployment:{status:'UNRESOLVED',environment:'testnet'}}},{runtime:{...runtime,deployment:{status:'RESOLVED',environment:'production'}}},{provenance:{...provenance,fixture:true}},{provenance:{...provenance,kind:'DISPLAY_ONLY'}},{provenance:{...provenance,chainId:'0x1'}},{provenance:{...provenance,account:address(2)}}])assert.throws(()=>swap(change),error=>error.name==='CanonicalInputError');
 assert.throws(()=>requireCanonicalContext({...base,provenance:{...provenance,quoteId:'not-a-quote'}}),error=>error.code==='INVALID_PROVENANCE');
});
test('quote expiration, future observations and staleness fail before wallet access',()=>{
 for(const change of [{nowSeconds:1100},{nowSeconds:999},{nowSeconds:1031},{nowSeconds:NaN}])assert.throws(()=>swap(change),error=>error.name==='CanonicalInputError');
});
test('floating display amounts and post-review path/recipient changes cannot become transactions',()=>{
 assert.throws(()=>swap({execution:{...execution,amountInRaw:'1.5'}}),error=>error.code==='INVALID_RAW_AMOUNT');
 assert.throws(()=>swap({execution:{...execution,expectedPathHash:id(901)}}),error=>error.code==='ROUTE_CHANGED');
 assert.throws(()=>swap({execution:{...execution,recipient:address(5)}}),/recipient changed after review/);
 assert.throws(()=>swap({execution:{...execution,hops:[{...execution.hops[0],routeId:'demo-route'}]}}),error=>error.code==='INVALID_ROUTE');
});
test('qualified bridge builds only exact reviewed raw-unit routes',()=>{
 const reviewed={kind:'BRIDGE_WITHDRAWAL',adapterId:id(1),routeId:id(2),exchangeAssetId:id(3)};
 const outbound={adapterId:id(1),routeId:id(2),assetId:id(3),recipientBytes:'0x1234',amountRaw:'400',feeValueWei:'0'};
 const result=prepareCanonicalBridge({...base,reviewedIntent:reviewed,execution:outbound});assert.equal(result.transaction.kind,'BRIDGE');
 assert.throws(()=>prepareCanonicalBridge({...base,reviewedIntent:reviewed,execution:{...outbound,routeId:id(4)}}),/route changed after review/);
 assert.throws(()=>prepareCanonicalBridge({...base,reviewedIntent:reviewed,execution:{...outbound,amountRaw:0.5}}),error=>error.code==='INVALID_BRIDGE');
});
test('limit-order signing requires exact maker, raw units and an unexpired canonical order',()=>{
 const reviewed={maker:account,recipient:account,primaryMarket:id(1),nonce:2,expiry:2000,allowPartial:true};
 const order={maker:account,sellToken:address(5),buyToken:address(6),sellAmountRaw:'100',minBuyAmountRaw:'90',recipient:account,marketId:id(1),nonce:'2',expiry:'2000',allowPartial:true};
 const result=prepareCanonicalOrder({...base,reviewedOrder:reviewed,execution:order});assert.equal(result.signingRequest.method,'eth_signTypedData_v4');
 assert.throws(()=>prepareCanonicalOrder({...base,reviewedOrder:reviewed,execution:{...order,maker:address(9)}}),error=>error.code==='REVIEW_REQUIRED');
 assert.throws(()=>prepareCanonicalOrder({...base,reviewedOrder:reviewed,execution:{...order,sellAmountRaw:'1.2'}}),error=>error.code==='INVALID_RAW_AMOUNT');
 assert.throws(()=>prepareCanonicalOrder({...base,nowSeconds:2010,provenance:{...provenance,observedAt:2000,expiresAt:2100},reviewedOrder:reviewed,execution:order}),error=>error.code==='STALE_ORDER');
});
test('cancellation rejects another maker and constructs maker-only calldata',()=>{
 const signedOrder={maker:account,sellToken:address(5),buyToken:address(6),sellAmountRaw:'100',minBuyAmountRaw:'90',recipient:account,marketId:id(1),nonce:'2',expiry:'2000',allowPartial:true};
 assert.equal(prepareCanonicalCancellation({...base,signedOrder}).transaction.kind,'ORDER_CANCEL');
 assert.throws(()=>prepareCanonicalCancellation({...base,signedOrder:{...signedOrder,maker:address(9)}}),error=>error.code==='MAKER_MISMATCH');
});
