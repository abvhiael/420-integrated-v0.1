import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSwapReview,formatRawUnits,assertDisplayedSwapReview} from '../core/human-readable-review.js';
import {transactionFingerprint} from '../core/preflight.js';
const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),tokenIn=address(3),tokenOut=address(4);
const transaction={kind:'SWAP',chainId:'0x420',request:{from:account,to:address(100),data:'0x12345678',value:'0x0'}};
const prepared={kind:'SWAP',transaction,context:{account,chainId:'0x420',quoteId:id(99),observedAt:1000,expiresAt:1100},reviewedIntent:{kind:'EXACT_INPUT_PATH',recipient,routeCommitment:id(900),hops:[{marketId:id(10),outputToken:tokenOut}]},transactionFingerprint:transactionFingerprint(transaction)};
const execution={mode:'ERC20_TO_ERC20',tokenIn,recipient,amountInRaw:'1000000000000000000',minFinalAmountOutRaw:'4100000',expectedPathHash:id(900),hops:[{marketId:id(10),routeId:id(11),tokenOut,minAmountOutRaw:'4100000',routeData:'0x'}]};
const tokens={input:{address:tokenIn,decimals:18,symbol:'BOB',verified:true},output:{address:tokenOut,decimals:6,symbol:'ARRR',verified:true}};
const args={prepared,execution,tokens,quoteId:id(99)};
test('formats only canonical integer raw units exactly without floating point rounding',()=>{
 assert.equal(formatRawUnits('1000000000000000001',18),'1.000000000000000001');
 assert.equal(formatRawUnits('4100000',6),'4.1');
 assert.equal(formatRawUnits('0',0),'0');
 for(const amount of ['1.5','1e6','-2','01',1.5])assert.throws(()=>formatRawUnits(amount,18),e=>e.code==='INVALID_UNITS');
 assert.throws(()=>formatRawUnits('1',37),e=>e.code==='INVALID_UNITS');
});
test('projects swap display amounts and route IDs from exact canonical inputs',()=>{
 const review=canonicalSwapReview(args);
 assert.equal(review.amountIn,'1');assert.equal(review.minimumOutput,'4.1');
 assert.equal(review.input.address,tokenIn);assert.equal(review.output.address,tokenOut);
 assert.equal(review.hops[0].marketId,id(10));assert.equal(review.hops[0].routeId,id(11));
 assert.deepEqual(assertDisplayedSwapReview(review,structuredClone(review)),review);
});
test('rejects unverified token metadata, quote substitution and route mutation',()=>{
 assert.throws(()=>canonicalSwapReview({...args,tokens:{...tokens,input:{...tokens.input,verified:false}}}),e=>e.code==='TOKEN_METADATA_UNVERIFIED');
 assert.throws(()=>canonicalSwapReview({...args,tokens:{...tokens,output:{...tokens.output,decimals:37}}}),e=>e.code==='TOKEN_METADATA_UNVERIFIED');
 assert.throws(()=>canonicalSwapReview({...args,tokens:{...tokens,output:{...tokens.output,address:address(8)}}}),e=>e.code==='TOKEN_METADATA_UNVERIFIED');
 assert.throws(()=>canonicalSwapReview({...args,quoteId:id(100)}),e=>e.code==='QUOTE_CHANGED');
 assert.throws(()=>canonicalSwapReview({...args,execution:{...execution,hops:[{...execution.hops[0],marketId:id(12)}]}}),e=>e.code==='ROUTE_CHANGED');
 assert.throws(()=>canonicalSwapReview({...args,execution:{...execution,amountInRaw:'1.1'}}),e=>e.code==='REVIEW_CHANGED');
});
test('changed displayed amount, target, quote, route, or token decimals cannot match review',()=>{
 const review=canonicalSwapReview(args);
 for(const change of [{amountIn:'2'},{minimumOutput:'5'},{recipient:address(8)},{quoteId:id(88)},{input:{...review.input,decimals:6}},{hops:[{...review.hops[0],routeId:id(66)}]},{envelope:{...review.envelope,to:address(8)}}]){
  assert.throws(()=>assertDisplayedSwapReview(review,{...structuredClone(review),...change}),e=>e.code==='REVIEW_CHANGED');
 }
});
