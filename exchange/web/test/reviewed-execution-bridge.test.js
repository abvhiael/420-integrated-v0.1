import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExecutionReview,assertConfirmedExecution,canonicalEnvelopeFields,assertExactDisplayedFields} from '../core/reviewed-execution-bridge.js';
import {transactionFingerprint} from '../core/preflight.js';
import {authenticatedFixture,vector} from './authenticated-quote-fixture.js';

const trusted=await authenticatedFixture();
const account=vector.request.account,target=vector.router;
const session=()=>({account,chainId:vector.chainId,generation:3});
const prepared=trusted.prepared;
const review=()=>buildExecutionReview({
  prepared,session:session(),authenticationEvidence:trusted.authentication,reviewedFields:canonicalEnvelopeFields(prepared),
});
const confirm=(r,overrides={})=>assertConfirmedExecution({
  prepared,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:1001,
  displayedFields:canonicalEnvelopeFields(prepared),...overrides,
});

test('authenticated swap review binds the exact executable envelope',()=>{
 const r=review(),result=confirm(r);
 assert.equal(result.reviewedIntent.kind,'SWAP');
 assert.equal(result.reviewedIntent.transactionFingerprint,transactionFingerprint(prepared.transaction));
 assert.deepEqual(r.reviewedFields,canonicalEnvelopeFields(prepared));
 assert.equal(r.authentication.quoteId,trusted.quoteId);
});
test('forged evidence and arbitrary nonempty review cannot authorize execution review',()=>{
 assert.throws(()=>buildExecutionReview({prepared,session:session(),reviewedFields:canonicalEnvelopeFields(prepared)}),e=>e.code==='SOURCE_UNVERIFIED');
 assert.throws(()=>buildExecutionReview({prepared,session:session(),authenticationEvidence:{...trusted.authentication},reviewedFields:canonicalEnvelopeFields(prepared)}),e=>e.code==='SOURCE_UNVERIFIED');
 assert.throws(()=>buildExecutionReview({prepared,session:session(),authenticationEvidence:trusted.authentication,reviewedFields:{amountRaw:'100'}}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>buildExecutionReview({prepared,session:session(),authenticationEvidence:trusted.authentication,reviewedFields:{}}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>assertConfirmedExecution({prepared,review:review(),session:session(),nowSeconds:1001}),e=>e.code==='REVIEW_CHANGED');
 assert.throws(()=>confirm(review(),{displayedFields:null}),e=>e.code==='REVIEW_FIELDS_REQUIRED');
});
test('all execution-critical fields must match what user reviewed',()=>{
 const fields=canonicalEnvelopeFields(prepared);
 const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0'),id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
 for(const [field,value] of Object.entries({kind:'BRIDGE',chainId:'0x421',from:target,to:address(1),data:'0x12345678',value:'0x1',transactionFingerprint:id(0)})){
  assert.throws(()=>assertExactDisplayedFields(prepared,{...fields,[field]:value}),e=>e.code==='REVIEW_CHANGED',field);
  assert.throws(()=>confirm(review(),{displayedFields:{...fields,[field]:value}}),e=>e.code==='REVIEW_CHANGED',field);
 }
 assert.throws(()=>assertExactDisplayedFields(prepared,{...fields,route:'unbound'}),e=>e.code==='INCOMPLETE_REVIEW');
 assert.throws(()=>assertExactDisplayedFields(prepared,{...fields,to:undefined}),e=>e.code==='REVIEW_CHANGED');
});
test('wallet change, expiration and changed transaction invalidate confirmation',()=>{
 const r=review();
 assert.throws(()=>confirm(r,{session:{...session(),generation:4}}),e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>confirm(r,{nowSeconds:prepared.context.expiresAt}),e=>e.code==='REVIEW_EXPIRED');
 const changed={...prepared,transaction:{...prepared.transaction,request:{...prepared.transaction.request,value:'0x1'}}};
 assert.throws(()=>assertConfirmedExecution({prepared:changed,review:r,session:session(),confirmedFingerprint:r.transactionFingerprint,nowSeconds:1001,displayedFields:canonicalEnvelopeFields(changed)}),e=>e.code==='REVIEW_CHANGED');
});
