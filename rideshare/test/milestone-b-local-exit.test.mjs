import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_DEFAULTS,validatePilotConfiguration,assessPilotAdmission} from '../src/pilot-configuration.mjs';
import {validateDeploymentConfig} from '../src/deployment-security.mjs';
import {verifyRecoveryProof,createOperationalRecovery} from '../src/operational-recovery.mjs';
import {validateDutyCoverage} from '../src/operational-safety.mjs';
const h='a'.repeat(64),sha='b'.repeat(40);
const deployed=()=>({environment:'testnet',publicOrigin:'https://pilot.example.org/',databaseUrl:'postgres://liftd_qualification:pass@db.example.org/db?sslmode=verify-full',databaseRole:'liftd_qualification',tlsMode:'trusted-terminator',secretProvider:'managed',identityKeyDigest:h,sessionKeyDigest:'c'.repeat(64),locationKeyDigest:'d'.repeat(64),releaseSha:sha,enableDispatch:false,enablePayments:false,enablePassengerTraffic:false,limits:{requestBytes:4096,timeoutMs:5000}});
test('Milestone B: deployed and pilot default authorizations are both locked off',()=>{
 const d=validateDeploymentConfig(deployed());
 assert.equal(d.trafficEnabled,false);
 assert.equal(validatePilotConfiguration(PILOT_DEFAULTS).enabled,false);
 for(const k of ['enableDispatch','enablePayments','enablePassengerTraffic'])
 assert.throws(()=>validateDeploymentConfig({...deployed(),[k]:true}),{code:'DEPLOY_EXTERNAL_AUTHORITY_REQUIRED'});
 for(const k of ['enabled','productionAuthorized','passengerTrafficEnabled'])
 assert.throws(()=>validatePilotConfiguration({...PILOT_DEFAULTS,[k]:true}),{code:'PILOT_CONFIGURATION_DENIED'});
});
test('Milestone B: zero-capacity pilot cannot accept even apparently eligible ride',()=>{
 const d={driverId:'driver_1',active:true,suspended:false,eligibilityExpiresAt:200};
 const v={vehicleId:'vehicle_1',active:true,suspended:false,authorizedDriverId:'driver_1',capacity:4,eligibilityExpiresAt:200};
 assert.throws(()=>assessPilotAdmission({config:PILOT_DEFAULTS,trip:{id:'t1',driverId:'driver_1',vehicleId:'vehicle_1',scope:{...PILOT_DEFAULTS.scope},passengers:1},driver:d,vehicle:v,metrics:{activeTrips:0,onlineDrivers:1,offersPerMinute:0,dispatchLatencyMs:0,providerFailures:0,unacknowledgedIncidents:0},stop:{active:true,commandId:'stop_1'},coverage:{primary:'a',backup:'b',supervisor:'c',coverageStart:0,coverageEnd:200},now:100}),{code:'PILOT_CAPACITY_OR_MONITORING_DENIED'});
});
test('Milestone B: restored audit and legal holds must match and cannot reenable traffic',()=>{
 const x={releaseSha:sha,imageDigest:h,migrationDigest:h,dataDigest:h,auditDigest:h,holdDigest:h,recordCount:2,verifiedAt:90};
 assert.equal(verifyRecoveryProof({source:x,restored:x,expectedSha:sha,now:100}).trafficEnabled,false);
 for(const k of ['auditDigest','holdDigest','migrationDigest','dataDigest'])
 assert.throws(()=>verifyRecoveryProof({source:x,restored:{...x,[k]:'f'.repeat(64)},expectedSha:sha,now:100}),{code:'RECOVERY_INTEGRITY_MISMATCH'});
});
test('Milestone B: independently staffed recovery still cannot admit public traffic',async()=>{
 const queue={claim:async()=>null,finish:async()=>{}};
 const handlers={dispatch_reconcile:async()=>{},availability_sweep:async()=>{},provider_recheck:async()=>{}};
 const recovery={pause:async()=>({paused:true}),verifyRestore:async({expectedRevision})=>({verified:true,revision:expectedRevision}),rollback:async({expectedRevision})=>({rolledBack:true,revision:expectedRevision+1})};
 const audit={append:async()=>({receiptId:'audit_receipt',digest:h})};
 const escalation={deliver:async()=>({receiptId:'escalation_receipt'})};
 const roster={current:async()=>({primary:'a',backup:'b',supervisor:'c',coverageStart:0,coverageEnd:200})};
 const c=createOperationalRecovery({queue,handlers,recovery,audit,escalation,roster,clock:()=>100,workerId:'worker_1'});
 await c.pauseAndEscalate({commandId:'cmd',incidentId:'incident',createdAt:90});
 const x={releaseSha:sha,imageDigest:h,migrationDigest:h,dataDigest:h,auditDigest:h,holdDigest:h,recordCount:2,verifiedAt:90};
 const result=await c.rollback({commandId:'rollback_cmd',approvedBy:'a',independentApprover:'b',expectedRevision:1,source:x,restored:x,expectedSha:sha});
 assert.equal(result.trafficEnabled,false);
});
