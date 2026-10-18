import {createHash,verify,createPublicKey} from 'node:crypto';
import {canonical} from './canonical.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const iso=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x));
const required=['backup','replica','provider'];
const publicKey=x=>x?.type==='public'&&x?.asymmetricKeyType?x:createPublicKey(x);
const scrub=x=>{
 if(x===null||['string','number','boolean'].includes(typeof x))return typeof x==='string'?'<REDACTED>':x;
 if(Array.isArray(x))return x.map(scrub);
 if(!x||typeof x!=='object')fail('TELEMETRY_REJECTED');
 return Object.fromEntries(Object.keys(x).sort().map(k=>[k,'<REDACTED>']));
};
/** Allowlisted operational counters only; arbitrary strings and objects can never enter logs. */
export function privacyOperationalEvent(x){
 if(!x||!['sweep','erasure','vault','incident'].includes(x.kind)||!['started','passed','failed','blocked'].includes(x.status)||
 !Number.isSafeInteger(x.count)||x.count<0||x.count>1e6||
 !Number.isSafeInteger(x.durationMs)||x.durationMs<0||x.durationMs>3600000||
 Object.keys(x).sort().join(',')!=='count,durationMs,kind,status')fail('TELEMETRY_REJECTED');
 return Object.freeze({...x});
}
export function redactedFailure(){return Object.freeze({status:'failed',reason:'REDACTED'});}
/** Reject unsigned/provider-forged receipts and incomplete declared processor inventory. */
export function verifyErasureReceipts({subjectRef,requestRef,receipts,requiredProviders,providerKeys,now}){
 if(!id(subjectRef)||!id(requestRef)||!Number.isSafeInteger(now)||now<0||
 !Array.isArray(receipts)||!Array.isArray(requiredProviders)||!requiredProviders.length||
 !providerKeys||typeof providerKeys!=='object')fail('ERASURE_INVALID');
 const expected=new Set();
 for(const p of requiredProviders){
  if(!p||!required.includes(p.kind)||!id(p.providerId)||!providerKeys[p.providerId])fail('ERASURE_INVENTORY_INVALID');
  const key=p.kind+':'+p.providerId;if(expected.has(key))fail('ERASURE_INVENTORY_INVALID');
  expected.add(key);
 }
 if(required.some(kind=>!requiredProviders.some(p=>p.kind===kind)))fail('ERASURE_COVERAGE_INCOMPLETE');
 const covered=new Set(),results=[];
 for(const x of receipts){
  if(!x||!required.includes(x.kind)||!id(x.providerId)||!id(x.receiptId)||!sha(x.digest)||
   x.subjectRef!==subjectRef||x.requestRef!==requestRef||!Number.isSafeInteger(x.verifiedAt)||x.verifiedAt>now||
   x.verifiedAt<0||!['ERASED','HELD'].includes(x.disposition)||
   x.disposition==='HELD'&&(!id(x.holdRef)||!Number.isSafeInteger(x.reviewDueAt)||x.reviewDueAt<=now)||
   typeof x.signature!=='string'||!x.signature)fail('ERASURE_RECEIPT_INVALID');
  const key=x.kind+':'+x.providerId;
  if(!expected.has(key))fail('ERASURE_UNKNOWN_PROVIDER');
  if(covered.has(key))fail('ERASURE_DUPLICATE');covered.add(key);
  let good=false;
  try{
   const {signature,...payload}=x;
   good=verify(null,Buffer.from(canonical(payload)),publicKey(providerKeys[x.providerId]),Buffer.from(signature,'base64'));
  }catch{}
  if(!good)fail('ERASURE_SIGNATURE_INVALID');
  results.push(Object.freeze({kind:x.kind,providerId:x.providerId,receiptId:x.receiptId,disposition:x.disposition,digest:x.digest}));
 }
 if(covered.size!==expected.size)fail('ERASURE_COVERAGE_INCOMPLETE');
 return Object.freeze({subjectRef,requestRef,allErased:results.every(x=>x.disposition==='ERASED'),receipts:Object.freeze(results)});
}
/** Signature is verified against an independently provisioned vault reviewer key, never a local self-attestation. */
export function verifyVaultCustody({receipt,publicKey,expected,now}){
 if(!receipt||!expected||!id(receipt.documentRef)||!id(receipt.reviewerId)||!id(receipt.custodyRef)||
 !id(receipt.ownerId)||!sha(receipt.contentDigest)||!sha(receipt.auditDigest)||
 !Number.isSafeInteger(receipt.expiresAt)||receipt.expiresAt<=now||
 receipt.ownerId!==expected.ownerId||receipt.documentRef!==expected.documentRef||
 receipt.status!=='APPROVED'||!id(expected.reviewerId)||receipt.reviewerId!==expected.reviewerId||
 typeof receipt.signature!=='string'||!publicKey)fail('VAULT_CUSTODY_DENIED');
 let good=false;
 try{const {signature,...payload}=receipt;good=verify(null,Buffer.from(canonical(payload)),(publicKey?.type==='public'&&publicKey?.asymmetricKeyType?publicKey:createPublicKey(publicKey)),Buffer.from(signature,'base64'));}catch{}
 if(!good)fail('VAULT_SIGNATURE_INVALID');
 return Object.freeze({documentRef:receipt.documentRef,custodyRef:receipt.custodyRef,auditDigest:receipt.auditDigest});
}
export function assertRetentionPolicy(policy,now){
 if(!policy||!id(policy.policyId)||!id(policy.version)||!iso(policy.effectiveAt)||!sha(policy.digest)||
 !Number.isSafeInteger(now)||now<Date.parse(policy.effectiveAt)/1000||
 !['PENDING_INDEPENDENT','APPROVED'].includes(policy.status)||
 !Array.isArray(policy.holds)||policy.holds.some(x=>!id(x.code)||!id(x.reviewerRole)||!Number.isSafeInteger(x.minSeconds)||x.minSeconds<0))fail('RETENTION_POLICY_INVALID');
 if(policy.status!=='APPROVED'||!id(policy.legalApprover)||!id(policy.privacyApprover)||
 !policy.legalApprovalRef||!policy.privacyApprovalRef||
 policy.legalApprover===policy.privacyApprover)fail('RETENTION_APPROVAL_REQUIRED');
 return Object.freeze({policyId:policy.policyId,version:policy.version,digest:policy.digest});
}
export function assertPrivacyGovernance(config){
 if(!config||!id(config.controller)||!id(config.privacyOfficer)||!id(config.securityOfficer)||
 config.privacyOfficer===config.securityOfficer||!Array.isArray(config.providers)||!config.providers.length||
 !Array.isArray(config.incidentContacts)||!config.incidentContacts.length||
 config.providers.some(p=>!id(p.providerId)||!id(p.agreementRef)||!id(p.retentionPolicyRef)||!id(p.incidentEscalationRef))||
 config.incidentContacts.some(c=>!id(c.role)||!id(c.contactRef)||!Number.isSafeInteger(c.ackWithinSeconds)||c.ackWithinSeconds<1))fail('PRIVACY_GOVERNANCE_INCOMPLETE');
 return Object.freeze({controller:config.controller,providerCount:config.providers.length,incidentRoles:config.incidentContacts.map(c=>c.role)});
}
export function createRetentionScheduler({sweep,emit,alert,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof sweep!=='function'||typeof emit!=='function'||typeof alert!=='function')fail('SCHEDULER_CONFIG_INVALID');
 let active=false;
 return Object.freeze({async run(){
  if(active)fail('SCHEDULER_CONCURRENT_RUN');
  active=true;const start=clock();
  try{
   if(!Number.isSafeInteger(start)||start<0)fail('SCHEDULER_CLOCK_INVALID');
   const result=await sweep();
   if(!Number.isSafeInteger(result?.expiredLocations)||result.expiredLocations<0||
   !Number.isSafeInteger(result?.overdueRequests)||result.overdueRequests<0)fail('SCHEDULER_SWEEP_INVALID');
   if(result.overdueRequests>0)await alert(Object.freeze({code:'PRIVACY_REQUEST_OVERDUE',count:result.overdueRequests}));
   await emit(privacyOperationalEvent({kind:'sweep',status:result.overdueRequests?'blocked':'passed',count:result.expiredLocations,durationMs:Math.min(3600000,Math.max(0,(clock()-start)*1000))}));
   return Object.freeze({...result});
  }catch(e){
   try{await alert(Object.freeze({code:'PRIVACY_SWEEP_FAILURE',count:1}));}catch{}
   try{await emit(privacyOperationalEvent({kind:'sweep',status:'failed',count:1,durationMs:0}));}catch{}
   fail('PRIVACY_SWEEP_FAILED');
  }finally{active=false}
 }});
}
