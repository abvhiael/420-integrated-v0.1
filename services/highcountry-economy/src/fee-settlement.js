// HC-ECON-06: authoritative quote, paid submission and reviewer escrow ledger.
// $420 smallest units are BigInt throughout. Never treat BUDS as $420.
// A trusted deployment adapter must independently authenticate price, finality and payouts.
export const FEE_VERSION='HC.ECON.FEES.V1';
export const REVIEW_WINDOW_MS=72*60*60*1000;
const err=m=>{throw new Error('hc-econ-06:'+m);};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(x);
const cents={single:42n,bundle24:420n};
const state=s=>{for(const k of ['econFeeQuotes','econFeePayments','econFeeSubmissions','econFeeTransfers','econFeeAudit'])s[k]??=new Map();};
const big=x=>{if(typeof x!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(x))err('amount');return BigInt(x);};
const copy=x=>structuredClone(x);
const audit=(s,type,target,at,details={})=>s.econFeeAudit.set(String(s.econFeeAudit.size+1),{type,target,at,...copy(details)});
function portions(units){const dev=units/10n,community=units*4n/10n;return {development:dev.toString(),community:community.toString(),reviewer:(units-dev-community).toString()};}
export function feeAllocation(amount){
 const total=big(amount);if(total<1n)err('zero-fee');return portions(total);
}
function due(s,paymentId){const p=s.econFeePayments.get(paymentId);if(!p||p.status!=='confirmed')err('payment-not-confirmed');return p;}
const requireAdapter=(name,value)=>{if(typeof value!=='function')err('missing-'+name);};
export class EconFees {
 constructor({store,authority,pricing,payments,payouts,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof authority?.principal!=='function'||typeof authority?.guardState!=='function')err('authority');
  for(const [key,obj,method] of [['pricing',pricing,'verifyQuote'],['payments',payments,'verifyFinalized'],['payouts',payouts,'verifyFinalized']])requireAdapter(key,obj?.[method]);
  Object.assign(this,{store,authority,pricing,payments,payouts,clock});
 }
 async actor(session){const a=await this.authority.principal(session);if(!id(a))err('principal');return a;}
 guard(s,session,scope,actor){if(this.authority.guardState(s,session,scope,actor)!==true)err('access-revoked');}
 async quote(session,{quoteId,kind,assetIds,priceEvidence}){
  const actor=await this.actor(session),now=this.clock();
  if(!id(quoteId)||!Object.hasOwn(cents,kind)||!Array.isArray(assetIds)||assetIds.length!==(kind==='single'?1:24)||!assetIds.every(id)||new Set(assetIds).size!==assetIds.length)err('quote-request');
  const verified=await this.pricing.verifyQuote({kind,usdCents:cents[kind].toString(),actor,quoteId},priceEvidence);
  if(!verified||verified.authentic!==true||verified.quoteId!==quoteId||verified.actor!==actor||verified.usdCents!==cents[kind].toString()||
    !id(verified.sourceId)||!id(verified.attestationId)||!Number.isSafeInteger(verified.observedAt)||verified.observedAt>now||
    !Number.isSafeInteger(verified.expiresAt)||verified.expiresAt<=now||verified.expiresAt<=verified.observedAt||
    now-verified.observedAt>300000||typeof verified.units!=='string'||big(verified.units)<1n)err('price-unverified');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-quote',actor);if(s.econFeeQuotes.has(quoteId)||[...s.econFeeQuotes.values()].some(q=>q.attestationId===verified.attestationId))err('quote-replay');
   const row={version:FEE_VERSION,quoteId,actor,kind,assetIds:copy(assetIds),usdCents:cents[kind].toString(),units:verified.units,sourceId:verified.sourceId,attestationId:verified.attestationId,observedAt:verified.observedAt,expiresAt:verified.expiresAt,status:'quoted'};
   s.econFeeQuotes.set(quoteId,row);audit(s,'quoted',quoteId,now);return copy(row);
  });
 }
 async confirm(session,{quoteId,paymentId,evidence}){
  const actor=await this.actor(session),now=this.clock();if(!id(quoteId)||!id(paymentId))err('confirm-request');
  const q=await this.store.transact(s=>{state(s);this.guard(s,session,'fee-confirm',actor);const q=s.econFeeQuotes.get(quoteId);if(!q||q.actor!==actor||q.status!=='quoted'||now>=q.expiresAt)err('expired-quote');return copy(q);});
  const receipt=await this.payments.verifyFinalized({paymentId,quoteId,actor,units:q.units,assetIds:q.assetIds},evidence);
  if(receipt?.verified!==true||receipt.paymentId!==paymentId||receipt.quoteId!==quoteId||receipt.actor!==actor||receipt.units!==q.units||!id(receipt.finalizedReceiptId))err('payment-unverified');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-confirm',actor);const current=s.econFeeQuotes.get(quoteId);
   if(!current||current.status!=='quoted'||now>=current.expiresAt||s.econFeePayments.has(paymentId)||[...s.econFeePayments.values()].some(x=>x.finalizedReceiptId===receipt.finalizedReceiptId))err('payment-replay-or-expired');
   const allocation=feeAllocation(current.units);
   const record={version:FEE_VERSION,paymentId,quoteId,actor,kind:q.kind,amount:q.units,allocation,finalizedReceiptId:receipt.finalizedReceiptId,status:'confirmed',at:now};
   current.status='paid';s.econFeePayments.set(paymentId,record);
   // One fee per submitted design; bundle is apportioned without rounding loss.
   const amount=big(q.units),count=BigInt(q.assetIds.length),base=amount/count,extra=amount%count;
   for(let i=0;i<q.assetIds.length;i++){
    const assetId=q.assetIds[i];if(s.econFeeSubmissions.has(assetId))err('already-paid-asset');
    const share=base+(BigInt(i)<extra?1n:0n);
    s.econFeeSubmissions.set(assetId,{assetId,paymentId,actor,paidUnits:share.toString(),revision:1,corrections:0,status:'awaiting-assignment',deadline:null,reviewerId:null,certificateId:null,updatedAt:now});
   }
   audit(s,'paid',paymentId,now,{allocation});return copy(record);
  });
 }
 async assign(session,{assetId,reviewerId,assignmentId}){
  const actor=await this.actor(session),now=this.clock();
  if(![assetId,reviewerId,assignmentId].every(id))err('assignment');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-assign',actor);const row=s.econFeeSubmissions.get(assetId);
   const assignment=s.econAssignments?.get(assignmentId),reviewer=s.econReviewers?.get(reviewerId);
   if(!row||!['awaiting-assignment','awaiting-correction-review'].includes(row.status)||!assignment||assignment.reviewerId!==reviewerId||assignment.assetId!==assetId||assignment.revision!==row.revision||assignment.status!=='assigned'||!reviewer||reviewer.status!=='active'||reviewer.expiresAt<=now)err('assignment-invalid');
   row.reviewerId=reviewerId;row.assignmentId=assignmentId;row.status='under-review';row.deadline=now+REVIEW_WINDOW_MS;row.updatedAt=now;
   audit(s,'review-assigned',assetId,now,{assignmentId,deadline:row.deadline});return copy(row);
  });
 }
 async review(session,{assetId,decision,reason,certificateId=null}){
  const actor=await this.actor(session),now=this.clock();
  if(!id(assetId)||!['approve','correction','reject'].includes(decision)||typeof reason!=='string'||reason.trim().length<3)err('review-request');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-review',actor);const row=s.econFeeSubmissions.get(assetId);
   if(!row||row.status!=='under-review'||row.reviewerId!==actor||now>=row.deadline)err('review-closed');
   if(decision==='correction'&&row.corrections!==0)err('correction-used');
   if(decision==='approve'){
    const cert=s.econCertificates?.get(certificateId);
    if(!id(certificateId)||!cert||cert.assetId!==assetId||cert.revision!==row.revision||cert.reviewerId!==actor||cert.status!=='approved'||cert.disputed)err('unapproved-certificate');
    row.certificateId=certificateId;row.status='accepted';
   }else if(decision==='correction')row.status='correction-requested';
   else if(row.corrections===0)row.status='correction-requested';
   else {row.status='developer-review';row.developerDeadline=now+REVIEW_WINDOW_MS;}
   row.updatedAt=now;audit(s,'review-'+decision,assetId,now,{reason});return copy(row);
  });
 }
 async correction(session,{assetId,revision}){
  const actor=await this.actor(session),now=this.clock();
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-correct',actor);const row=s.econFeeSubmissions.get(assetId);
   if(!row||row.actor!==actor||row.status!=='correction-requested'||row.corrections!==0||revision!==row.revision+1||
     !s.econCreatorAssets?.has(JSON.stringify([assetId,revision])))err('correction-invalid');
   row.revision=revision;row.corrections=1;row.reviewerId=null;row.assignmentId=null;row.deadline=null;row.status='awaiting-correction-review';row.updatedAt=now;
   audit(s,'corrected',assetId,now,{revision});return copy(row);
  });
 }
 async adjudicate(session,{assetId,forfeit,reason}){
  const actor=await this.actor(session),now=this.clock();
  if(!id(assetId)||typeof forfeit!=='boolean'||typeof reason!=='string'||reason.trim().length<3)err('adjudication');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-developer-decision',actor);const row=s.econFeeSubmissions.get(assetId);
   if(!row||row.status!=='developer-review'||actor===row.reviewerId||now>=row.developerDeadline)err('developer-review-expired');
   row.status=forfeit?'forfeited':'refund-due';row.updatedAt=now;audit(s,forfeit?'forfeiture-upheld':'refund-authorized',assetId,now,{reason});return copy(row);
  });
 }
 async deadlines(session){
  const actor=await this.actor(session),now=this.clock();
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-deadline',actor);const changed=[];
   for(const row of s.econFeeSubmissions.values()){
    if(row.status==='under-review'&&now>=row.deadline||row.status==='developer-review'&&now>=row.developerDeadline){
      row.status='refund-due';row.updatedAt=now;changed.push(row.assetId);audit(s,'deadline-refund',row.assetId,now);
    }
   }return changed;
  });
 }
 async release(session,{assetId,transferId,evidence}){
  const actor=await this.actor(session),now=this.clock();if(!id(assetId)||!id(transferId))err('release');
  const row=await this.store.transact(s=>{state(s);this.guard(s,session,'fee-release',actor);const row=s.econFeeSubmissions.get(assetId),cert=s.econCertificates?.get(row?.certificateId);
   if(!row||row.status!=='accepted'||!cert||cert.status!=='approved'||cert.disputed||cert.reviewerId!==row.reviewerId||s.econFeeTransfers.has(transferId))err('release-denied');
   return copy(row);
  });
  // A payout is only acknowledged after independent finalized transfer verification.
  const p=dueFromRecord(row);const receipt=await this.payouts.verifyFinalized({transferId,assetId,recipient:row.reviewerId,units:p.reviewer},evidence);
  if(receipt?.verified!==true||receipt.transferId!==transferId||!id(receipt.finalizedReceiptId))err('payout-unverified');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-release',actor);const current=s.econFeeSubmissions.get(assetId),cert=s.econCertificates?.get(current?.certificateId);
   if(!current||current.status!=='accepted'||!cert||cert.status!=='approved'||cert.disputed||s.econFeeTransfers.has(transferId)||[...s.econFeeTransfers.values()].some(x=>x.finalizedReceiptId===receipt.finalizedReceiptId))err('release-race');
   current.status='reviewer-paid';s.econFeeTransfers.set(transferId,{type:'reviewer',assetId,units:p.reviewer,finalizedReceiptId:receipt.finalizedReceiptId,at:now});
   audit(s,'reviewer-paid',assetId,now);return copy(current);
  });
 }
 async refund(session,{assetId,transferId,evidence}){
  const actor=await this.actor(session),now=this.clock();if(!id(assetId)||!id(transferId))err('refund');
  const row=await this.store.transact(s=>{state(s);this.guard(s,session,'fee-refund',actor);const row=s.econFeeSubmissions.get(assetId);
   if(!row||row.status!=='refund-due'||s.econFeeTransfers.has(transferId))err('refund-denied');return copy(row);
  });
  const receipt=await this.payouts.verifyFinalized({transferId,assetId,recipient:row.actor,units:row.paidUnits},evidence);
  if(receipt?.verified!==true||receipt.transferId!==transferId||!id(receipt.finalizedReceiptId))err('refund-unverified');
  return this.store.transact(s=>{state(s);this.guard(s,session,'fee-refund',actor);const current=s.econFeeSubmissions.get(assetId);
   if(!current||current.status!=='refund-due'||s.econFeeTransfers.has(transferId)||[...s.econFeeTransfers.values()].some(x=>x.finalizedReceiptId===receipt.finalizedReceiptId))err('refund-race');
   current.status='refunded';s.econFeeTransfers.set(transferId,{type:'refund',assetId,units:row.paidUnits,finalizedReceiptId:receipt.finalizedReceiptId,at:now});
   audit(s,'refunded',assetId,now);return copy(current);
  });
 }
}
function dueFromRecord(row){return portions(big(row.paidUnits));}
