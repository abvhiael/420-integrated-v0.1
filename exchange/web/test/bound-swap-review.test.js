import test from 'node:test';
import assert from 'node:assert/strict';
import {beginBoundSwapReview,confirmBoundSwapReview} from '../core/bound-swap-review.js';
import {authenticatedFixture,vector} from './authenticated-quote-fixture.js';

const trusted=await authenticatedFixture();
const runtime={
  deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:vector.chainId},
  contracts:{ExchangeAtomicRouter420:vector.router},
};
const wallet={account:vector.request.account,chainId:vector.chainId,generation:7};
const args={
  runtime,prepared:trusted.prepared,execution:trusted.execution,tokens:trusted.tokens,quoteId:trusted.quoteId,
  session:wallet,authenticationEvidence:trusted.authentication,
};
const begin=()=>beginBoundSwapReview(args);
const confirm=(bound,overrides={})=>confirmBoundSwapReview({...args,bound,displayed:structuredClone(bound.projection),confirmedFingerprint:bound.review.transactionFingerprint,nowSeconds:1001,...overrides});

test('authenticated swap display, exact calldata and wallet snapshot share the same canonical input',()=>{
 const bound=begin();
 assert.equal(bound.projection.amountIn,'1');
 assert.equal(bound.projection.minimumOutput,'4.1');
 assert.equal(bound.review.authentication.producerId,trusted.authentication.producerId);
 assert.equal(confirm(bound).transaction.kind,'SWAP');
 assert.equal(confirm(bound).reviewedIntent.transactionFingerprint,bound.review.transactionFingerprint);
});
test('caller-crafted trust evidence cannot authorize a bound review',()=>{
 assert.throws(()=>beginBoundSwapReview({...args,authenticationEvidence:{...trusted.authentication}}),e=>e.code==='SOURCE_UNVERIFIED');
 assert.throws(()=>beginBoundSwapReview({...args,authenticationEvidence:{verified:true,quoteId:trusted.quoteId,transactionFingerprint:trusted.prepared.transactionFingerprint}}),e=>e.code==='SOURCE_UNVERIFIED');
});
test('reconstructed calldata rejects changed amounts, route data, path, recipient and router',()=>{
 const bound=begin(),execution=trusted.execution;
 const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0'),address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
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
 const bound=begin(),id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
 assert.throws(()=>confirm(bound,{displayed:{...structuredClone(bound.projection),amountIn:'2'}}),e=>e.code==='REVIEW_CHANGED');
 assert.throws(()=>confirm(bound,{quoteId:id(100)}),e=>e.code==='QUOTE_CHANGED');
 assert.throws(()=>confirm(bound,{session:{...wallet,generation:8}}),e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>confirm(bound,{nowSeconds:trusted.prepared.context.expiresAt}),e=>e.code==='REVIEW_EXPIRED');
 assert.throws(()=>confirm(bound,{confirmedFingerprint:id(8)}),e=>e.code==='REVIEW_CHANGED');
});
