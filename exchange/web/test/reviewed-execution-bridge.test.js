import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExecutionReview,assertConfirmedExecution,canonicalEnvelopeFields,assertExactDisplayedFields} from '../core/reviewed-execution-bridge.js';
import {transactionFingerprint} from '../core/preflight.js';
const account='0x'+'11'.repeat(20),target='0x'+'22'.repeat(20);
const session=()=>({account,chainId:'0x420',generation:3});
const prepared=(kind='SWAP')=>{
 const transaction={kind,chainId:'0x420',request:{from:account,to:target,data:'0x12345678',value:'0x0'}};
 const context={account,chainId:'0x420',quoteId:'0x'+'33'.repeat(32),observedAt:90,expiresAt:120};
 return {kind,transaction,context,reviewedIntent:{kind:kind==='SWAP'?'EXACT_INPUT_PATH':kind==='BRIDGE'?'BRIDGE_WITHDRAWAL':kind},transactionFingerprint:transactionFingerprint(transaction)};
};
const review=p=>buildExecutionReview({prepared:p,session:session(),sourceAuthenticated:true,reviewedFields:canonicalEnvelopeFields(p)});
const confirm=(p,r,overrides={})=>assertConfirmedExecution({prepared:p,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:100,displayedFields:canonicalEnvelopeFields(p),...overrides});

test('swap, bridge and cancellation review bind exact executable envelope kinds',()=>{
 for(const kind of ['SWAP','BRIDGE','ORDER_CANCEL']){
  const p=prepared(kind),r=review(p),result=confirm(p,r);
  assert.equal(result.reviewedIntent.kind,kind);
  assert.equal(result.reviewedIntent.transactionFingerprint,transactionFingerprint(p.transaction));
  assert.deepEqual(r.reviewedFields,canonicalEnvelopeFields(p));
 }
});
test('unverified provenance and arbitrary nonempty review cannot authorize submission',()=>{
 const p=prepared();
 assert.throws(()=>buildExecutionReview({prepared:p,session:session(),reviewedFields:canonicalEnvelopeFields(p)}),e=>e.code==='SOURCE_UNVERIFIED');
 assert.throws(()=>buildExecutionReview({prepared:p,session:session(),sourceAuthenticated:true,reviewedFields:{amountRaw:'100'}}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>buildExecutionReview({prepared:p,session:session(),sourceAuthenticated:true,reviewedFields:{}}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>assertConfirmedExecution({prepared:p,review:review(p),session:session(),nowSeconds:100}),e=>e.code==='REVIEW_CHANGED');
 assert.throws(()=>confirm(p,review(p),{displayedFields:null}),e=>e.code==='REVIEW_FIELDS_REQUIRED');
});
test('all execution-critical fields must match what user reviewed',()=>{
 const p=prepared(),fields=canonicalEnvelopeFields(p);
 for(const [field,value] of Object.entries({kind:'BRIDGE',chainId:'0x421',from:target,to:account,data:'0x12345679',value:'0x1',transactionFingerprint:'0x'+'00'.repeat(32)})){
  assert.throws(()=>assertExactDisplayedFields(p,{...fields,[field]:value}),e=>e.code==='REVIEW_CHANGED',field);
  assert.throws(()=>confirm(p,review(p),{displayedFields:{...fields,[field]:value}}),e=>e.code==='REVIEW_CHANGED',field);
 }
 assert.throws(()=>assertExactDisplayedFields(p,{...fields,route:'unbound'}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>assertExactDisplayedFields(p,{...fields,to:undefined}),e=>e.code==='REVIEW_CHANGED');
});
test('wallet change, expiration and changed transaction invalidate confirmation',()=>{
 const p=prepared(),r=review(p);
 assert.throws(()=>confirm(p,r,{session:{...session(),generation:4}}),e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>confirm(p,r,{nowSeconds:120}),e=>e.code==='REVIEW_EXPIRED');
 const changed={...p,transaction:{...p.transaction,request:{...p.transaction.request,value:'0x1'}}};
 assert.throws(()=>confirm(changed,r),e=>e.code==='REVIEW_CHANGED');
});
