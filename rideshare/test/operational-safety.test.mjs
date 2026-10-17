import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {validateDutyCoverage,assessEscalation,authorizeEmergencyOperation,verifyIndependentSafetyDecisions,assertSafetyRelease,safetyGates} from '../src/operational-safety.mjs';
const now=1000,coverage={primary:'support_1',backup:'support_2',supervisor:'safety_3',coverageStart:900,coverageEnd:2000};
test('duty coverage rejects absent, expired and single point of failure',()=>{
 assert.equal(validateDutyCoverage(coverage,now).backup,'support_2');
 for(const c of [{...coverage,backup:'support_1'},{...coverage,coverageEnd:now},{...coverage,supervisor:''}])assert.throws(()=>validateDutyCoverage(c,now),e=>e.code==='SAFETY_DUTY_UNSTAFFED');
});
test('missed acknowledgment escalates to backup and supervisor without pretending a notification happened',()=>{
 const base={createdAt:900,acknowledgedAt:null,primary:'support_1',backup:'support_2',supervisor:'safety_3',ackLimitSeconds:50};
 assert.equal(assessEscalation(base,940).state,'AWAIT_PRIMARY');
 assert.equal(assessEscalation(base,950).route,'support_2');
 assert.equal(assessEscalation(base,1000).route,'safety_3');
 assert.throws(()=>assessEscalation({...base,acknowledgedAt:950,acknowledgedBy:'outsider'},1000),e=>e.code==='SAFETY_ACK_INVALID');
});
test('emergency controls prohibit self approval, excessive duration, unauthorized override and revoked grants',()=>{
 const base={actor:'operator_1',approver:'controller_2',role:'emergency_operator',action:'pause',expiresAt:1200,revoked:false,incidentId:'incident_1'};
 assert.equal(authorizeEmergencyOperation(base,now).action,'pause');
 for(const c of [{...base,approver:base.actor},{...base,action:'dispatch_override'},{...base,expiresAt:2000},{...base,revoked:true}])
 assert.throws(()=>authorizeEmergencyOperation(c,now),e=>e.code==='SAFETY_EMERGENCY_DENIED');
});
test('independently signed acceptance requires all five matching deployment gates and rejects forged and stale evidence',()=>{
 const keys=generateKeyPairSync('ed25519');
 const environment='isolated_test',imageDigest='a'.repeat(64),configDigest='b'.repeat(64),implementationSha='c'.repeat(40);
 const fields=['gate_id','environment','image_digest','implementation_sha','configuration_digest','disposition','reviewer_id','approver_id','reviewer_signed_at','approved_expiry','evidence_sha256'];
 const records=safetyGates.map(gate_id=>{
  const rec={gate_id,environment,image_digest:imageDigest,implementation_sha:implementationSha,configuration_digest:configDigest,disposition:'PASS',
  reviewer_id:'independent_1',approver_id:'authority_2',reviewer_independence:true,scenario_ids:['scenario_1'],redacted_evidence_uris:['https://evidence.example/a'],
  reviewer_signed_at:900,approved_expiry:1100,critical_open_findings:0,evidence_sha256:'d'.repeat(64)};
  const bytes=Buffer.from(JSON.stringify(fields.map(k=>rec[k])));
  rec.approval_signature=sign(null,bytes,keys.privateKey).toString('base64url');return rec;
 });
 const config={records,environment,imageDigest,implementationSha,configDigest,approvedReviewers:{independent_1:true},publicKeys:{authority_2:keys.publicKey},now};
 assert.equal(verifyIndependentSafetyDecisions(config).gates,5);
 assert.throws(()=>verifyIndependentSafetyDecisions({...config,records:records.slice(1)}),e=>e.code==='SAFETY_ACCEPTANCE_INCOMPLETE');
 assert.throws(()=>verifyIndependentSafetyDecisions({...config,records:records.map((x,i)=>i?x:{...x,implementation_sha:'f'.repeat(40)})}),e=>e.code==='SAFETY_ACCEPTANCE_INCOMPLETE');
 assert.throws(()=>verifyIndependentSafetyDecisions({...config,records:records.map((x,i)=>i?x:{...x,approval_signature:'invalid'})}),e=>e.code==='SAFETY_SIGNATURE_INVALID');
 assert.throws(()=>verifyIndependentSafetyDecisions({...config,now:1200}),e=>e.code==='SAFETY_ACCEPTANCE_INCOMPLETE');
 assert.throws(()=>assertSafetyRelease({accepted:{accepted:true},operationalCoverage:coverage,trafficEnabled:true},now),e=>e.code==='SAFETY_RELEASE_DENIED');
});
