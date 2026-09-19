import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExecutionReview,assertConfirmedExecution} from '../core/reviewed-execution-bridge.js';
import {transactionFingerprint} from '../core/preflight.js';
const account='0x'+'11'.repeat(20),target='0x'+'22'.repeat(20);
const session=()=>({account,chainId:'0x420',generation:3});
const prepared=(kind='SWAP')=>{
 const transaction={kind,chainId:'0x420',request:{from:account,to:target,data:'0x12345678',value:'0x0'}};
 const context={account,chainId:'0x420',quoteId:'0x'+'33'.repeat(32),observedAt:90,expiresAt:120};
 return {kind,transaction,context,reviewedIntent:{kind:kind==='SWAP'?'EXACT_INPUT_PATH':kind==='BRIDGE'?'BRIDGE_WITHDRAWAL':kind},transactionFingerprint:transactionFingerprint(transaction)};
};
const review=p=>buildExecutionReview({prepared:p,session:session(),sourceAuthenticated:true,reviewedFields:{amountRaw:'100',recipient:account,route:'0x'+'44'.repeat(32)}});
test('the prepared swap and bridge names map to exact canonical transaction kinds',()=>{
 for(const kind of ['SWAP','BRIDGE','ORDER_CANCEL']){
  const p=prepared(kind),r=review(p);
  const result=assertConfirmedExecution({prepared:p,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:100});
  assert.equal(result.reviewedIntent.kind,kind);
  assert.equal(result.reviewedIntent.transactionFingerprint,transactionFingerprint(p.transaction));
 }
});
test('unverified provenance and missing displayed review cannot authorize submission',()=>{
 const p=prepared();
 assert.throws(()=>buildExecutionReview({prepared:p,session:session(),reviewedFields:{amountRaw:'100'}}),e=>e.code==='SOURCE_UNVERIFIED');
 assert.throws(()=>buildExecutionReview({prepared:p,session:session(),sourceAuthenticated:true,reviewedFields:{}}),e=>e.code==='REVIEW_FIELDS_REQUIRED');
 assert.throws(()=>assertConfirmedExecution({prepared:p,review:review(p),session:session(),nowSeconds:100}),e=>e.code==='REVIEW_CHANGED');
});
test('wallet change, expiration and changed transaction fingerprint invalidate confirmation',()=>{
 const p=prepared(),r=review(p);
 assert.throws(()=>assertConfirmedExecution({prepared:p,review:r,session:{...session(),generation:4},confirmedFingerprint:r.transactionFingerprint,nowSeconds:100}),e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>assertConfirmedExecution({prepared:p,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:120}),e=>e.code==='REVIEW_EXPIRED');
 const changed={...p,transaction:{...p.transaction,request:{...p.transaction.request,value:'0x1'}}};
 assert.throws(()=>assertConfirmedExecution({prepared:changed,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:100}),e=>e.code==='REVIEW_CHANGED');
});
