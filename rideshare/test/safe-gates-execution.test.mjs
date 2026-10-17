import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeGateCoordinator} from '../src/safe-gates-execution.mjs';
const state={audits:[],paused:0,drills:0};
const adapters={
 safety:{report:async()=>({incidentId:'inc_1'}),read:async()=>({})},
 support:{open:async()=>({caseId:'case_1'}),read:async()=>({})},
 identity:{verify:async({action,subjectId})=>({subject:'operator_1',action,subjectId,role:'emergency_operator',revoked:false,expiresAt:2000}),verifySecondApprover:async()=>({subject:'operator_2',revoked:false,expiresAt:1800})},
 escalation:{deliver:async()=>({receiptId:'receipt_1'}),receipt:async()=>({})},
 audit:{append:async entry=>{state.audits.push(entry)}},
 recovery:{pause:async()=>{state.paused++},drill:async()=>{state.drills++;return {ok:true}},verifyRestore:async()=>({dataIntact:true,holdsIntact:true,imageVerified:true})},
 roster:{current:async()=>({primary:'support_1',backup:'support_2',supervisor:'safety_3',coverageStart:900,coverageEnd:1800})},
 clock:()=>1000
};
const gate=()=>createSafeGateCoordinator(adapters);
test('SAFE-INCIDENT preserves scoped incident report and audit receipt',async()=>{
 assert.equal((await gate().incident({token:'jwt',tripId:'trip_1',category:'medical',commandId:'cmd_1'})).incidentId,'inc_1');
 assert.ok(state.audits.some(x=>x.gate==='SAFE-INCIDENT'));
 await assert.rejects(()=>gate().incident({token:'jwt',tripId:'trip_1',category:'invalid',commandId:'cmd_1'}),e=>e.code==='SAFE_INPUT_INVALID');
});
test('SAFE-SUPPORT prevents caller-selected owner/role and audits accepted case',async()=>{
 assert.equal((await gate().supportCase({token:'jwt',tripId:'trip_1',category:'lost_property',request:{commandId:'cmd_1'}})).caseId,'case_1');
 await assert.rejects(()=>gate().supportCase({token:'jwt',tripId:'trip_1',category:'fare',request:{owner:'operator_1'}}),e=>e.code==='SAFE_INPUT_INVALID');
});
test('SAFE-ESCALATION requires staffed roster and delivery receipt; no false acknowledgment',async()=>{
 assert.equal((await gate().routeEscalation({token:'jwt',caseId:'case_1',createdAt:700})).receiptId,'receipt_1');
 const bad=createSafeGateCoordinator({...adapters,escalation:{...adapters.escalation,deliver:async()=>({})}});
 await assert.rejects(()=>bad.routeEscalation({token:'jwt',caseId:'case_1',createdAt:700}),e=>e.code==='SAFE_DELIVERY_UNCONFIRMED');
});
test('SAFE-OPERATOR rejects same-person approval and limits emergency operations',async()=>{
 assert.equal((await gate().emergencyAction({token:'jwt',approvalToken:'other',incidentId:'inc_1',action:'pause'})).authorized,true);
 const bad=createSafeGateCoordinator({...adapters,identity:{...adapters.identity,verifySecondApprover:async()=>({subject:'operator_1',expiresAt:1800,revoked:false})}});
 await assert.rejects(()=>bad.emergencyAction({token:'jwt',approvalToken:'same',incidentId:'inc_1',action:'pause'}),e=>e.code==='SAFETY_EMERGENCY_DENIED');
 await assert.rejects(()=>gate().emergencyAction({token:'jwt',approvalToken:'other',incidentId:'inc_1',action:'dispatch_override'}),e=>e.code==='SAFETY_EMERGENCY_DENIED');
});
test('SAFE-DRILL isolated only, verifies restore, never resumes or grants passenger access',async()=>{
 const plan={environment:'isolated_testnet',livePassengers:false,emergencyServicesContact:false,releaseId:'release_1'};
 assert.deepEqual(await gate().runDrill({token:'jwt',approvalToken:'other',drillId:'exercise_1',plan}),{tested:true,remainsPaused:true});
 assert.ok(state.paused>=1&&state.drills>=1);
 await assert.rejects(()=>gate().runDrill({token:'jwt',approvalToken:'other',drillId:'exercise_1',plan:{...plan,livePassengers:true}}),e=>e.code==='SAFE_DRILL_UNAUTHORIZED');
 const failed=createSafeGateCoordinator({...adapters,recovery:{...adapters.recovery,verifyRestore:async()=>({dataIntact:false})}});
 await assert.rejects(()=>failed.runDrill({token:'jwt',approvalToken:'other',drillId:'exercise_1',plan}),e=>e.code==='SAFE_RECOVERY_UNVERIFIED');
});
