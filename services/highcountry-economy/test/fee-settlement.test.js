import {generateKeyPairSync,sign} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {EconFees,feeAllocation,REVIEW_WINDOW_MS,Signed420PriceOracle} from '../src/fee-settlement.js';
function setup(){
 const store=new MemoryTransactionFixture();let now=1000000,verified=true,settled=true;
 const authority={principal:async x=>x,guardState:()=>true};
 const pricing={verifyQuote:async (intent,e)=>verified?{authentic:true,quoteId:intent.quoteId,actor:intent.actor,usdCents:intent.usdCents,sourceId:'oracle_1',attestationId:'attest_'+intent.quoteId,observedAt:now,expiresAt:now+60000,units:e?.units??'1000'}:{authentic:false}};
 const payments={verifyFinalized:async intent=>settled?{verified:true,quoteId:intent.quoteId,paymentId:intent.paymentId,actor:intent.actor,units:intent.units,finalizedReceiptId:'receipt_'+intent.paymentId}:{verified:false}};
 const payouts={verifyFinalized:async intent=>settled?{verified:true,transferId:intent.transferId,finalizedReceiptId:'chain_'+intent.transferId,recipient:intent.recipient,units:intent.units}:{verified:false}};
 const fees=new EconFees({store,authority,pricing,payments,payouts,clock:()=>now});
 const assetIds=Array.from({length:24},(_,i)=>'art_'+i);
 const q=(kind='single',ids=['art_0'],units='1000')=>fees.quote('alice',{quoteId:'quote_'+kind,kind,assetIds:ids,priceEvidence:{units}});
 const pay=(kind='single')=>fees.confirm('alice',{quoteId:'quote_'+kind,paymentId:'pay_'+kind,evidence:{}});
 return {store,fees,q,pay,assetIds,at:n=>{now=n;},now:()=>now,disablePricing:()=>{verified=false;},disableSettlement:()=>{settled=false}};
}
function seedSignedCertification(f){
 const pair=generateKeyPairSync('ed25519'),sha256='a'.repeat(64),metadataHash='b'.repeat(64);
 const payload={version:'HC.ECON.CERT.V1',certificateId:'cert',assignmentId:'cert_assignment',reviewerId:'reviewer',assetId:'art_0',revision:1,sha256,metadataHash,description:'Verified original object artwork',issuedAt:1000000};
 f.store.state.econCreatorAssets=new Map([[JSON.stringify(['art_0',1]),{assetId:'art_0',revision:1,creatorId:'alice',sha256,metadataHash,publicationStatus:'unpublished'}]]);
 f.store.state.econReviewers.set('reviewer',{reviewerId:'reviewer',status:'active',expiresAt:Date.now()+86400000,keyVersion:1,publicKey:pair.publicKey.export({type:'spki',format:'pem'})});
 f.store.state.econAssignments.set('cert_assignment',{assignmentId:'cert_assignment',reviewerId:'reviewer',assetId:'art_0',revision:1,status:'completed'});
 f.store.state.econCertificates=new Map([['cert',{...payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),pair.privateKey).toString('base64'),keyVersion:1,automatedValidationId:'verified_automated_png',status:'approved',qaBy:'qa',disputed:false}]]);
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
 for(const leg of ['development','community','reviewer'])assert.equal(rows.reduce((n,r)=>n+BigInt(r.allocation[leg]),0n),BigInt(f.store.state.econFeePayments.get('pay_bundle24').allocation[leg]));
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
 seedSignedCertification(f);
 await f.fees.review('reviewer',{assetId:'art_0',decision:'approve',reason:'valid work',certificateId:'cert'});
 await f.fees.qaWork('qa',{assetId:'art_0',valid:true,reason:'independent acceptance'});
 await f.fees.distribute('operator',{assetId:'art_0',leg:'development',transferId:'dev_1',evidence:{}});
 await f.fees.distribute('operator',{assetId:'art_0',leg:'community',transferId:'community_1',evidence:{}});
 await assert.rejects(f.fees.distribute('operator',{assetId:'art_0',leg:'community',transferId:'community_2',evidence:{}}),/distribution-denied/);
 f.disableSettlement();await assert.rejects(f.fees.release('qa',{assetId:'art_0',transferId:'reviewer_pay',evidence:{}}),/payout-unverified/);
 assert.equal(f.store.state.econFeeTransfers?.size??0,2);
});

test('independently QA-validated rejection earns compensation without published artwork',async()=>{
 const f=setup();await f.q();await f.pay();
 f.store.state.econReviewers=new Map([['reviewer',{status:'active',expiresAt:f.now()+REVIEW_WINDOW_MS*8}]]);
 f.store.state.econAssignments=new Map([['first',{reviewerId:'reviewer',assetId:'art_0',revision:1,status:'assigned'}]]);
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'first'});
 await f.fees.review('reviewer',{assetId:'art_0',decision:'correction',reason:'wrong image'});
 f.store.state.econCreatorAssets=new Map([[JSON.stringify(['art_0',2]),{assetId:'art_0',revision:2}]]);
 await f.fees.correction('alice',{assetId:'art_0',revision:2});
 f.store.state.econAssignments.set('second',{reviewerId:'reviewer',assetId:'art_0',revision:2,status:'assigned'});
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'second'});
 await f.fees.review('reviewer',{assetId:'art_0',decision:'reject',reason:'still fraudulent'});
 await f.fees.adjudicate('developer',{assetId:'art_0',forfeit:true,reason:'documented second failure'});
 await assert.rejects(f.fees.release('developer',{assetId:'art_0',transferId:'review_pay',evidence:{}}),/release-denied/);
 await f.fees.qaWork('qa',{assetId:'art_0',valid:true,reason:'review accurately documented'});
 await f.fees.release('developer',{assetId:'art_0',transferId:'review_pay',evidence:{}});
 await assert.rejects(f.fees.release('developer',{assetId:'art_0',transferId:'review_pay_again',evidence:{}}),/release-denied/);
 assert.equal(f.store.state.econFeeTransfers.size,1);
});
test('PostgreSQL codec retains one confirmed receipt and allocations across restart',async()=>{
 const {PostgresBudsStore}=await import('../src/postgres-store.js');
 let persisted={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],issued:0,burned:0};
 const pool={connect:async()=>({query:async(sql,args)=>{
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(persisted)}]};
  if(sql.startsWith('UPDATE highcountry_buds_state')){persisted=JSON.parse(args[1]);return {rowCount:1};}
  return {rows:[]};
 },release(){}})};
 let now=1000000;
 const make=()=>new EconFees({
  store:new PostgresBudsStore(pool,'fee_game'),
  clock:()=>now,authority:{principal:async x=>x,guardState:()=>true},
  pricing:{verifyQuote:async x=>({authentic:true,quoteId:x.quoteId,actor:x.actor,usdCents:x.usdCents,sourceId:'oracle',attestationId:'attest',observedAt:now,expiresAt:now+10000,units:'1000'})},
  payments:{verifyFinalized:async x=>({verified:true,paymentId:x.paymentId,quoteId:x.quoteId,actor:x.actor,units:x.units,finalizedReceiptId:'chain_receipt'})},
  payouts:{verifyFinalized:async()=>({verified:false})}
 });
 await make().quote('alice',{quoteId:'q',kind:'single',assetIds:['art'],priceEvidence:{}});
 await make().confirm('alice',{quoteId:'q',paymentId:'p',evidence:{}});
 await assert.rejects(make().confirm('alice',{quoteId:'q',paymentId:'p2',evidence:{}}),/expired-quote/);
 assert.equal(persisted.econFeePayments[0][1].allocation.reviewer,'500');
 assert.equal(persisted.econFeeSubmissions[0][1].actor,'alice');
});

test('Ed25519 oracle: exact native 420 conversion, tampering and forged rate rejected',async()=>{
 const pair=generateKeyPairSync('ed25519'),oracle=new Signed420PriceOracle(pair.publicKey.export({format:'pem',type:'spki'}));
 const intent={quoteId:'quote_1',actor:'alice',usdCents:'42'};
 const attestation={version:'HC.ECON.ORACLE.PRICE.V1',quoteId:'quote_1',actor:'alice',usdCents:'42',sourceId:'oracle_main',attestationId:'observation_1',observedAt:1000,expiresAt:2000,usdMicrosPer420:'1000000'};
 const signed=att=>({attestation:att,signature:sign(null,Buffer.from(JSON.stringify(att)),pair.privateKey).toString('base64')});
 const v=await oracle.verifyQuote(intent,signed(attestation));
 assert.equal(v.authentic,true);assert.equal(v.units,'420000000000000000');
 assert.equal((await oracle.verifyQuote(intent,signed({...attestation,usdMicrosPer420:'2000000'}))).units,'210000000000000000');
 assert.equal((await oracle.verifyQuote(intent,{...signed(attestation),attestation:{...attestation,usdMicrosPer420:'1'}})).authentic,false);
 assert.equal((await oracle.verifyQuote({...intent,actor:'bob'},signed(attestation))).authentic,false);
 const forged=generateKeyPairSync('ed25519');
 assert.equal((await oracle.verifyQuote(intent,{attestation,signature:sign(null,Buffer.from(JSON.stringify(attestation)),forged.privateKey).toString('base64')})).authentic,false);
});

test('fraud bypasses free correction, requires independent developer review, and expiry refunds',async()=>{
 const f=setup();await f.q();await f.pay();
 f.store.state.econReviewers=new Map([['reviewer',{status:'active',expiresAt:f.now()+REVIEW_WINDOW_MS*3}]]);
 f.store.state.econAssignments=new Map([['assign',{reviewerId:'reviewer',assetId:'art_0',revision:1,status:'assigned'}]]);
 await f.fees.assign('operator',{assetId:'art_0',reviewerId:'reviewer',assignmentId:'assign'});
 await f.fees.review('reviewer',{assetId:'art_0',decision:'fraud',reason:'forged artwork claim'});
 assert.equal(f.store.state.econFeeSubmissions.get('art_0').corrections,0);
 await assert.rejects(f.fees.correction('alice',{assetId:'art_0',revision:2}),/correction-invalid/);
 f.at(f.now()+REVIEW_WINDOW_MS);
 await f.fees.refund('operator',{assetId:'art_0',transferId:'expiry_refund',evidence:{}});
 assert.equal(f.store.state.econFeeSubmissions.get('art_0').artworkOutcome,'rejected');
 assert.equal(f.store.state.econFeeSubmissions.get('art_0').status,'refunded');
 await assert.rejects(f.fees.adjudicate('developer',{assetId:'art_0',forfeit:true,reason:'too late'}),/developer-review-expired/);
});
