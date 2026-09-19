import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCanonicalSwap } from '../core/canonical-execution-inputs.js';
import { beginBoundSwapReview, confirmBoundSwapReview } from '../core/bound-swap-review.js';
const address = n => '0x'+BigInt(n).toString(16).padStart(40,'0');
const id = n => '0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1), recipient=address(2), input=address(3), output=address(4);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'},contracts:{ExchangeAtomicRouter420:address(100)}};
const provenance={kind:'QUALIFIED_EXECUTION',fixture:false,demo:false,quoteId:id(99),chainId:'0x420',account,observedAt:1000,expiresAt:1100};
const intent={kind:'EXACT_INPUT_PATH',recipient,routeCommitment:id(900),hops:[{marketId:id(10),outputToken:output}]};
const execution={mode:'ERC20_TO_ERC20',tokenIn:input,recipient,amountInRaw:'1000000000000000000',minFinalAmountOutRaw:'4100000',expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut:output,minAmountOutRaw:'4100000',routeData:'0x'}]};
const tokens={input:{address:input,decimals:18,symbol:'BOB',verified:true},output:{address:output,decimals:6,symbol:'ARRR',verified:true}};
const wallet={account,chainId:'0x420',generation:7};
const prepared=prepareCanonicalSwap({runtime,marketSource:'api',account,provenance,nowSeconds:1010,reviewedIntent:intent,execution});
const args={runtime,prepared,execution,tokens,quoteId:id(99),session:wallet,sourceAuthenticated:true};
const begin=()=>beginBoundSwapReview(args);
const confirm=(bound,overrides={})=>confirmBoundSwapReview({...args,bound,displayed:structuredClone(bound.projection),confirmedFingerprint:bound.review.transactionFingerprint,nowSeconds:1011,...overrides});
test('reviewed swap display, exact calldata and wallet snapshot share the same canonical input',()=>{
 const bound=begin();
 assert.equal(bound.projection.amountIn,'1');
 assert.equal(bound.projection.minimumOutput,'4.1');
 assert.equal(confirm(bound).transaction.kind,'SWAP');
 assert.equal(confirm(bound).reviewedIntent.transactionFingerprint,bound.review.transactionFingerprint);
});
test('a caller cannot assert provenance by omitting the required integration gate',()=>{
 assert.throws(()=>beginBoundSwapReview({...args,sourceAuthenticated:false}),e=>e.code==='SOURCE_UNVERIFIED');
});
test('reconstructed calldata rejects changed amounts, route data, path, recipient and router',()=>{
 const bound=begin();
 for(const changed of [
  {...execution,amountInRaw:'2000000000000000000'},
  {...execution,minFinalAmountOutRaw:'4200000'},
  {...execution,hops:[{...execution.hops[0],routeId:id(12)}]},
  {...execution,hops:[{...execution.hops[0],routeData:'0x1234'}]},
  {...execution,recipient:address(7)},
  {...execution,expectedPathHash:id(901)},
 ]) assert.throws(()=>confirm(bound,{execution:changed}),e=>['EXECUTION_CHANGED','REBUILD_FAILED','REVIEW_CHANGED','ROUTE_CHANGED'].includes(e.code));
 assert.throws(()=>confirm(bound,{runtime:{...runtime,contracts:{ExchangeAtomicRouter420:address(101)}}}),e=>e.code==='EXECUTION_CHANGED');
});
test('confirmation rejects changed displayed amount, quote, wallet or expired review',()=>{
 const bound=begin();
 assert.throws(()=>confirm(bound,{displayed:{...structuredClone(bound.projection),amountIn:'2'}}),e=>e.code==='REVIEW_CHANGED');
 assert.throws(()=>confirm(bound,{quoteId:id(100)}),e=>e.code==='QUOTE_CHANGED');
 assert.throws(()=>confirm(bound,{session:{...wallet,generation:8}}),e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>confirm(bound,{nowSeconds:1100}),e=>e.code==='REVIEW_EXPIRED');
 assert.throws(()=>confirm(bound,{confirmedFingerprint:id(8)}),e=>e.code==='REVIEW_CHANGED');
});
