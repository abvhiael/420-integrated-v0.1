import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {EconFees,feeAllocation,REVIEW_WINDOW_MS} from '../src/fee-settlement.js';
function setup(){
 const store=new MemoryTransactionFixture();let now=1000000,verified=true,settled=true;
 const authority={principal:async x=>x,guardState:()=>true};
 const pricing={verifyQuote:async (intent,e)=>verified?{authentic:true,quoteId:intent.quoteId,actor:intent.actor,usdCents:intent.usdCents,sourceId:'oracle_1',attestationId:'attest_'+intent.quoteId,observedAt:now,expiresAt:now+60000,units:e?.units??'1000'}:{authentic:false}};
 const payments={verifyFinalized:async intent=>settled?{verified:true,quoteId:intent.quoteId,paymentId:intent.paymentId,actor:intent.actor,units:intent.units,finalizedReceiptId:'receipt_'+intent.paymentId}:{verified:false}};
 const payouts={verifyFinalized:async intent=>settled?{verified:true,transferId:intent.transferId,finalizedReceiptId:'chain_'+intent.transferId}:{verified:false}};
 const fees=new EconFees({store,authority,pricing,payments,payouts,clock:()=>now});
 const assetIds=Array.from({length:24},(_,i)=>'art_'+i);
 const q=(kind='single',ids=['art_0'],units='1000')=>fees.quote('alice',{quoteId:'quote_'+kind,kind,assetIds:ids,priceEvidence:{units}});
 const pay=(kind='single')=>fees.confirm('alice',{quoteId:'quote_'+kind,paymentId:'pay_'+kind,evidence:{}});
 return {store,fees,q,pay,assetIds,at:n=>{now=n;},now:()=>now,disablePricing:()=>{verified=false;},disableSettlement:()=>{settled=false}};
}
test('exact integer allocation conserves across rounding and 10/40/50 percentages',()=>{
 for(const n of ['1','2','3','10','11','1000','999999999999999999999999']){
  const a=feeAllocation(n),total=BigInt(n);
  assert.equal(BigInt(a.development)+BigInt(a.community)+BigInt(a.reviewer),total);
  assert.equal(BigInt(a.development),total/10n);assert.equal(BigInt(a.community),total*4n/10n);
 }
 assert.deepEqual(feeAllocation('1000'),{development:'100',community:'400',reviewer:'500'});
 assert.throws(()=>feeAllocation('1.2'),/amount/);
});
test('single quote payment is finalized and exactly once',async()=>{
 const f=setup();await f.q();const row=await f.pay();assert.equal(row.allocation.reviewer,'500');
 await assert.rejects(f.pay(),/expired-quote|payment-replay/);
 assert.equal(f.store.state.econFeeSubmissions.size,1);
 assert.equal(f.store.state.econFeePayments.size,1);
});
test('24 submissions distribute fee without undercount, independent correction allotments',async()=>{
 const f=setup();await f.q('bundle24',f.assetIds,'1001');await f.pay('bundle24');
 const rows=[...f.store.state.econFeeSubmissions.values()];
 assert.equal(rows.length,24);
 assert.equal(rows.reduce((n,r)=>n+BigInt(r.paidUnits),0n),1001n);
 assert.equal(new Set(rows.map(r=>r.assetId)).size,24);
});
test('stale quote and forged payment refuse financial state',async()=>{
 const f=setup();f.disablePricing();await assert.rejects(f.q(),/price-unverified/);
 const g=setup();await g.q();g.at(g.now()+REVIEW_WINDOW_MS);await assert.rejects(g.pay(),/expired-quote/);
 const h=setup();await h.q();h.disableSettlement();await assert.rejects(h.pay(),/payment-unverified/);
 assert.equal(h.store.state.econFeePayments?.size??0,0);
});
test('reviewer 72h timeout produces refund entitlement; confirmed refund is single use',async()=>{
 const f=setup();await f.q();await f.pay();
 f.store.state.econReviewers=new Map([['reviewer',{status:'active',expiresAt:f.now()+REVIEW_WINDOW_MS*3}]]);
 f.store.state.econAssignments=new Map([['assignment',{reviewerId:'reviewer',assetId:'art_0',revision:1,status:'assigned'}]]);
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'assignment'});
 f.at(f.now()+REVIEW_WINDOW_MS);
 assert.deepEqual(await f.fees.deadlines('operator'),['art_0']);
 await assert.rejects(f.fees.review('reviewer',{assetId:'art_0',decision:'reject',reason:'late'}),/review-closed/);
 await f.fees.refund('operator',{assetId:'art_0',transferId:'refund_1',evidence:{}});
 await assert.rejects(f.fees.refund('operator',{assetId:'art_0',transferId:'refund_2',evidence:{}}),/refund-denied/);
 assert.equal(f.store.state.econFeeTransfers.size,1);
});
test('one correction per paid submission and developer 72h review',async()=>{
 const f=setup();await f.q();await f.pay();
 f.store.state.econReviewers=new Map([['reviewer',{status:'active',expiresAt:f.now()+REVIEW_WINDOW_MS*8}]]);
 f.store.state.econAssignments=new Map([['first',{reviewerId:'reviewer',assetId:'art_0',revision:1,status:'assigned'}]]);
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'first'});
 await f.fees.review('reviewer',{assetId:'art_0',decision:'correction',reason:'fix alpha'});
 f.store.state.econCreatorAssets=new Map([[JSON.stringify(['art_0',2]),{assetId:'art_0',revision:2}]]);
 await f.fees.correction('alice',{assetId:'art_0',revision:2});
 await assert.rejects(f.fees.correction('alice',{assetId:'art_0',revision:3}),/correction-invalid/);
 f.store.state.econAssignments.set('second',{reviewerId:'reviewer',assetId:'art_0',revision:2,status:'assigned'});
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'second'});
 await f.fees.review('reviewer',{assetId:'art_0',decision:'reject',reason:'still invalid'});
 assert.equal(f.store.state.econFeeSubmissions.get('art_0').status,'developer-review');
 await assert.rejects(f.fees.adjudicate('reviewer',{assetId:'art_0',forfeit:true,reason:'self reward'}),/developer-review-expired/);
 f.at(f.now()+REVIEW_WINDOW_MS);
 assert.deepEqual(await f.fees.deadlines('operator'),['art_0']);
 assert.equal(s.econFeeSubmissions.get('art_0').status,'refund-due');
});
test('approved certified work can pay reviewer exactly once, forged transfer refused',async()=>{
 const f=setup();await f.q();await f.pay();
 f.store.state.econReviewers=new Map([['reviewer',{status:'active',expiresAt:f.now()+REVIEW_WINDOW_MS*3}]]);
 f.store.state.econAssignments=new Map([['assignment',{reviewerId:'reviewer',assetId:'art_0',revision:1,status:'assigned'}]]);
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'assignment'});
 f.store.state.econCertificates=new Map([['cert',{assetId:'art_0',revision:1,reviewerId:'reviewer',status:'approved',disputed:false}]]);
 await f.fees.review('reviewer',{assetId:'art_0',decision:'approve',reason:'valid work',certificateId:'cert'});
 f.disableSettlement();await assert.rejects(f.fees.release('qa',{assetId:'art_0',transferId:'reviewer_pay',evidence:{}}),/payout-unverified/);
 assert.equal(f.store.state.econFeeTransfers?.size??0,0);
});
