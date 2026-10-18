import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationalRecovery,verifyRecoveryProof} from '../src/operational-recovery.mjs';
const hash='a'.repeat(64),sha='b'.repeat(40),now=1000;
const proof={releaseSha:sha,imageDigest:hash,migrationDigest:hash,dataDigest:hash,auditDigest:hash,holdDigest:hash,recordCount:12,verifiedAt:900};
const handlers={dispatch_reconcile:async()=>{},availability_sweep:async()=>{},provider_recheck:async()=>{}};
function fixture({auditFails=false,pauseFails=false,rollbackFails=false,restoreFails=false,escalationFails=false}={}){
 const calls=[];const queue={claim:async()=>null,finish:async()=>{}};
 const recovery={pause:async x=>{calls.push('pause');return {paused:!pauseFails}},verifyRestore:async x=>({verified:!restoreFails,revision:x.expectedRevision}),rollback:async x=>{calls.push('rollback');return {rolledBack:!rollbackFails,revision:x.expectedRevision+1}}};
 const audit={append:async x=>{calls.push('audit:'+x.action);return auditFails?null:{receiptId:'receipt_1',digest:hash}}};
 const escalation={deliver:async()=>{calls.push('escalate');return escalationFails?null:{receiptId:'esc_1'}}};
 const roster={current:async()=>({primary:'primary',backup:'backup',supervisor:'supervisor',coverageStart:0,coverageEnd:2000})};
 return {calls,controller:createOperationalRecovery({queue,handlers,recovery,audit,escalation,roster,workerId:'worker_1',clock:()=>now})};
}
test('restore proof binds release, migrations, records, audit chain and legal holds',()=>{
 assert.equal(verifyRecoveryProof({source:proof,restored:{...proof},expectedSha:sha,now}).trafficEnabled,false);
 for(const changed of [{dataDigest:'c'.repeat(64)},{auditDigest:'c'.repeat(64)},{holdDigest:'c'.repeat(64)},{migrationDigest:'c'.repeat(64)},{recordCount:13}])
 assert.throws(()=>verifyRecoveryProof({source:proof,restored:{...proof,...changed},expectedSha:sha,now}),{code:'RECOVERY_INTEGRITY_MISMATCH'});
 assert.throws(()=>verifyRecoveryProof({source:proof,restored:{...proof,verifiedAt:1001},expectedSha:sha,now}),{code:'RECOVERY_PROOF_INVALID'});
});
test('recovery incident pauses, routes escalation and confirms audit before reporting',async()=>{
 const {controller,calls}=fixture();
 assert.deepEqual(await controller.pauseAndEscalate({commandId:'cmd_1',incidentId:'incident_1',createdAt:700}),{paused:true,escalated:true});
 assert.deepEqual(calls,['pause','escalate','audit:pause']);
 for(const patch of [{pauseFails:true},{escalationFails:true},{auditFails:true}])
 await assert.rejects(()=>fixture(patch).controller.pauseAndEscalate({commandId:'cmd_2',incidentId:'incident_1',createdAt:700}));
});
test('rollback enforces independent dual approval, revision and verified holds; traffic remains disabled',async()=>{
 const {controller,calls}=fixture();
 const args={commandId:'cmd_1',approvedBy:'operator_1',independentApprover:'reviewer_1',expectedRevision:3,source:proof,restored:proof,expectedSha:sha};
 const result=await controller.rollback(args);
 assert.deepEqual(result,{rolledBack:true,trafficEnabled:false,revision:4});
 assert.deepEqual(calls,['rollback','audit:rollback']);
 await assert.rejects(()=>fixture().controller.rollback({...args,independentApprover:'operator_1'}),{code:'RECOVERY_ROLLBACK_DENIED'});
 await assert.rejects(()=>fixture().controller.rollback({...args,restored:{...proof,holdDigest:'c'.repeat(64)}}),{code:'RECOVERY_INTEGRITY_MISMATCH'});
 await assert.rejects(()=>fixture({restoreFails:true}).controller.rollback(args),{code:'RECOVERY_RESTORE_UNCONFIRMED'});
 await assert.rejects(()=>fixture({rollbackFails:true}).controller.rollback(args),{code:'RECOVERY_ROLLBACK_UNCONFIRMED'});
 await assert.rejects(()=>fixture({auditFails:true}).controller.rollback(args),{code:'RECOVERY_AUDIT_UNCONFIRMED'});
});
test('job processing uses existing allowlisted durable worker and cannot expose arbitrary handlers',async()=>{
 const x=fixture();assert.equal(await x.controller.recoverJob(),null);
 assert.throws(()=>createOperationalRecovery({queue:{claim:()=>null,finish:()=>{}},handlers:{availability_sweep:()=>{}},recovery:{pause:()=>{},rollback:()=>{},verifyRestore:()=>{}},audit:{append:()=>{}},escalation:{deliver:()=>{}},roster:{current:()=>{}},workerId:'worker_1'}),{code:'RECOVERY_WORKER_CONFIGURATION_INVALID'});
});
