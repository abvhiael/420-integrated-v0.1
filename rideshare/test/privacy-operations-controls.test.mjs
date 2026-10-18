import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonical} from '../src/canonical.mjs';
import {verifyErasureReceipts,verifyVaultCustody,assertRetentionPolicy,privacyOperationalEvent,assertPrivacyGovernance,createRetentionScheduler} from '../src/privacy-operations-controls.mjs';
const h='a'.repeat(64),now=1000;
test('erasure requires independently signed complete provider inventory and holds remain outstanding',()=>{
 const identities=['backup','replica','provider'].map(kind=>({...generateKeyPairSync('ed25519'),kind}));
 const requiredProviders=identities.map(x=>({kind:x.kind,providerId:x.kind}));
 const providerKeys=Object.fromEntries(identities.map(x=>[x.kind,x.publicKey]));
 const base={subjectRef:'user_1',requestRef:'request_1',digest:h,verifiedAt:900,disposition:'ERASED'};
 const signed=(obj,key)=>({...obj,signature:sign(null,Buffer.from(canonical(obj)),key).toString('base64')});
 const receipts=identities.map(x=>signed({...base,kind:x.kind,providerId:x.kind,receiptId:'receipt_'+x.kind},x.privateKey));
 const args={subjectRef:'user_1',requestRef:'request_1',receipts,requiredProviders,providerKeys,now};
 assert.equal(verifyErasureReceipts(args).allErased,true);
 assert.throws(()=>verifyErasureReceipts({...args,receipts:receipts.slice(1)}),{code:'ERASURE_COVERAGE_INCOMPLETE'});
 assert.throws(()=>verifyErasureReceipts({...args,receipts:[...receipts,receipts[0]]}),{code:'ERASURE_DUPLICATE'});
 assert.throws(()=>verifyErasureReceipts({...args,receipts:[{...receipts[0],digest:'b'.repeat(64)},...receipts.slice(1)]}),{code:'ERASURE_SIGNATURE_INVALID'});
 const hold=signed({...base,kind:'backup',providerId:'backup',receiptId:'receipt_backup',disposition:'HELD',holdRef:'legal_hold',reviewDueAt:1100},identities[0].privateKey);
 assert.equal(verifyErasureReceipts({...args,receipts:[hold,...receipts.slice(1)]}).allErased,false);
});
test('vault receipt requires independent cryptographic signer and exact custody binding',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const data={documentRef:'document_1',reviewerId:'reviewer_1',custodyRef:'custody_1',ownerId:'driver_1',contentDigest:h,auditDigest:h,expiresAt:1100,status:'APPROVED'};
 const receipt={...data,signature:sign(null,Buffer.from(canonical(data)),privateKey).toString('base64')};
 const args={receipt,publicKey,expected:{ownerId:'driver_1',documentRef:'document_1',reviewerId:'reviewer_1'},now};
 assert.equal(verifyVaultCustody(args).custodyRef,'custody_1');
 assert.throws(()=>verifyVaultCustody({...args,expected:{...args.expected,ownerId:'other'}}),{code:'VAULT_CUSTODY_DENIED'});
 assert.throws(()=>verifyVaultCustody({...args,receipt:{...receipt,auditDigest:'b'.repeat(64)}}),{code:'VAULT_SIGNATURE_INVALID'});
});
test('legal approval cannot be self-issued or assumed from a draft policy',()=>{
 const p={policyId:'policy_1',version:'v1',effectiveAt:'1970-01-01T00:00:00Z',digest:h,status:'PENDING_INDEPENDENT',holds:[{code:'incident',reviewerRole:'legal',minSeconds:1}]};
 assert.throws(()=>assertRetentionPolicy(p,now),{code:'RETENTION_APPROVAL_REQUIRED'});
 assert.throws(()=>assertRetentionPolicy({...p,status:'APPROVED',legalApprover:'self',privacyApprover:'self',legalApprovalRef:'a',privacyApprovalRef:'b'},now),{code:'RETENTION_APPROVAL_REQUIRED'});
 assert.equal(assertRetentionPolicy({...p,status:'APPROVED',legalApprover:'counsel',privacyApprover:'dpo',legalApprovalRef:'a',privacyApprovalRef:'b'},now).policyId,'policy_1');
});
test('telemetry rejects arbitrary identifiers and governance requires separately assigned officers and providers',()=>{
 assert.deepEqual(privacyOperationalEvent({kind:'sweep',status:'passed',count:2,durationMs:50}),{kind:'sweep',status:'passed',count:2,durationMs:50});
 assert.throws(()=>privacyOperationalEvent({kind:'sweep',status:'passed',count:2,durationMs:50,location:'private'}),{code:'TELEMETRY_REJECTED'});
 assert.throws(()=>assertPrivacyGovernance({controller:'owner'}),{code:'PRIVACY_GOVERNANCE_INCOMPLETE'});
 assert.equal(assertPrivacyGovernance({controller:'owner',privacyOfficer:'dpo',securityOfficer:'sec',providers:[{providerId:'vault',agreementRef:'contract',retentionPolicyRef:'retention',incidentEscalationRef:'escalation'}],incidentContacts:[{role:'privacy',contactRef:'oncall',ackWithinSeconds:300}]}).providerCount,1);
});
test('scheduler alerts on overdue and failure without leaking exception details, and prohibits concurrent runs',async()=>{
 let events=[],alerts=[];
 const good=createRetentionScheduler({sweep:async()=>({expiredLocations:2,overdueRequests:1}),emit:async x=>events.push(x),alert:async x=>alerts.push(x),clock:()=>1000});
 assert.equal((await good.run()).expiredLocations,2);assert.equal(alerts[0].code,'PRIVACY_REQUEST_OVERDUE');
 let release;const blocker=new Promise(resolve=>{release=resolve});
 const stalled=createRetentionScheduler({sweep:async()=>{await blocker;return {expiredLocations:0,overdueRequests:0}},emit:async()=>{},alert:async()=>{},clock:()=>1000});
 const first=stalled.run();assert.rejects(stalled.run(),{code:'SCHEDULER_CONCURRENT_RUN'});release();await first;
 const bad=createRetentionScheduler({sweep:async()=>{throw Error('secret location')},emit:async x=>events.push(x),alert:async x=>alerts.push(x),clock:()=>1000});
 await assert.rejects(()=>bad.run(),{code:'PRIVACY_SWEEP_FAILED'});assert.equal(alerts.at(-1).code,'PRIVACY_SWEEP_FAILURE');
 assert.equal(JSON.stringify(events).includes('secret location'),false);
});
