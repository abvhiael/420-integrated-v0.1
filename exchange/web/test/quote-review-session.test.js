import test from 'node:test';
import assert from 'node:assert/strict';
import {QuoteReviewSession} from '../core/quote-review-session.js';
const account='0x'+'11'.repeat(20),other='0x'+'22'.repeat(20);
const request={account,tokenIn:other,tokenOut:other,recipient:account,amountInRaw:'100'};
const controller=()=>({runtime:{network:{chainId:'0x420'}},generation:4,disposed:false,wallet:{session:{account,chainId:'0x420',generation:2}}});
const candidate=()=>({status:'REVIEW_CANDIDATE_ONLY',prepared:{context:{account,chainId:'0x420',observedAt:1000,expiresAt:1050}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('read-only quote candidate is available only while wallet and quote stay fresh',async()=>{
 const wallet=controller();let now=1010,calls=0;
 const review=new QuoteReviewSession({controller:wallet,fetchReview:async()=>{calls++;return candidate();},nowSeconds:()=>now});
 assert.equal((await review.request({request})).status,'REVIEW_CANDIDATE_ONLY');
 assert.equal(review.current().status,'REVIEW_CANDIDATE_ONLY');assert.equal(calls,1);
 now=1031;assert.throws(()=>review.current(),e=>e.code==='STALE_QUOTE');
 assert.throws(()=>review.current(),e=>e.code==='REVIEW_UNAVAILABLE');
 review.dispose();assert.throws(()=>review.current(),e=>e.code==='REVIEW_UNAVAILABLE');
});
test('wallet account, chain, generation or controller changes invalidate candidate',async()=>{
 for(const change of [w=>w.wallet.session.account=other,w=>w.wallet.session.chainId='0x421',w=>w.wallet.session.generation++,w=>w.generation++]){
  const wallet=controller(),review=new QuoteReviewSession({controller:wallet,fetchReview:async()=>candidate(),nowSeconds:()=>1010});
  await review.request({request});change(wallet);
  assert.throws(()=>review.current(),e=>e.code==='SESSION_CHANGED');
  assert.throws(()=>review.current(),e=>e.code==='REVIEW_UNAVAILABLE');
 }
});
test('late HTTP response after wallet mutation cannot become current review',async()=>{
 const wallet=controller(),work=deferred();
 const review=new QuoteReviewSession({controller:wallet,fetchReview:()=>work.promise,nowSeconds:()=>1010});
 const pending=review.request({request});wallet.wallet.session.account=other;work.resolve(candidate());
 await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
 assert.throws(()=>review.current(),e=>e.code==='REVIEW_UNAVAILABLE');
});
test('superseding a request aborts it and rejects late response even if fetch ignores abort',async()=>{
 const wallet=controller(),first=deferred(),second=deferred();let calls=0,signal;
 const review=new QuoteReviewSession({controller:wallet,fetchReview:({signal:abortSignal})=>{calls++;if(calls===1){signal=abortSignal;return first.promise;}return second.promise;},nowSeconds:()=>1010});
 const older=review.request({request});const newer=review.request({request});
 assert.equal(signal.aborted,true);first.resolve(candidate());second.resolve(candidate());
 await assert.rejects(older,e=>e.code==='STALE_QUOTE');
 assert.equal((await newer).status,'REVIEW_CANDIDATE_ONLY');
 assert.equal(review.current().status,'REVIEW_CANDIDATE_ONLY');
});
test('disposal invalidates pending response and request account must match wallet',async()=>{
 const wallet=controller(),work=deferred();
 const review=new QuoteReviewSession({controller:wallet,fetchReview:()=>work.promise,nowSeconds:()=>1010});
 await assert.rejects(review.request({request:{...request,account:other}}),e=>e.code==='ACCOUNT_MISMATCH');
 const pending=review.request({request});review.dispose();work.resolve(candidate());
 await assert.rejects(pending,e=>e.code==='STALE_QUOTE');
 await assert.rejects(review.request({request}),e=>e.code==='DISPOSED');
});
test('receipt-time freshness is checked even if transport returns an old candidate',async()=>{
 const wallet=controller(),review=new QuoteReviewSession({controller:wallet,fetchReview:async()=>candidate(),nowSeconds:()=>1050});
 await assert.rejects(review.request({request}),e=>e.code==='STALE_QUOTE');
 assert.throws(()=>review.current(),e=>e.code==='REVIEW_UNAVAILABLE');
});
