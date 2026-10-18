import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityConsentGuard} from '../src/identity-consent-guard.mjs';
import {PILOT_DEFAULTS,validatePilotConfiguration,assessPilotAdmission,evaluatePilotEmergencyStop} from '../src/pilot-configuration.mjs';
import {verifyRecoveryProof} from '../src/operational-recovery.mjs';
import {verifyErasureReceipts} from '../src/privacy-operations-controls.mjs';
const h='a'.repeat(64);
test('account takeover: swapped privilege/resource after async consent read fails',async()=>{
 const p={role:'rider',subject:'rider_1',accountId:'acct_1',action:'account.preferences',resource:'account:acct_1',sessionId:'sess_1',deviceId:'dev_1',recoveryEpoch:1,expiresAt:200};
 for(const change of [{action:'fraud.clear'},{resource:'account:attacker'},{deviceId:'attacker'},{recoveryEpoch:2}]){
  let calls=0;
  const guard=createIdentityConsentGuard({clock:()=>100,authenticator:{authorize:async()=>++calls===1?p:{...p,...change}},preferences:{read:async()=>({revision:1,preferences:{tripNotifications:true}})}});
  await assert.rejects(()=>guard.require({token:'token',accountId:'acct_1',purpose:'trip_notifications'}),{code:'CONSENT_SESSION_CHANGED'});
 }
});
test('authority spoofing and forged driver/vehicle pilot projections never activate public ride',()=>{
 assert.throws(()=>validatePilotConfiguration({...PILOT_DEFAULTS,enabled:true}),{code:'PILOT_CONFIGURATION_DENIED'});
 const args={config:{...PILOT_DEFAULTS,maxActiveTrips:1,maxOnlineDrivers:1,maxOffersPerMinute:1},trip:{id:'trip1',driverId:'driver_1',vehicleId:'vehicle_1',passengers:1,scope:{...PILOT_DEFAULTS.scope}},driver:{driverId:'driver_1',active:true,suspended:false,eligibilityExpiresAt:200},vehicle:{vehicleId:'vehicle_1',authorizedDriverId:'attacker',capacity:4,active:true,suspended:false,eligibilityExpiresAt:200},metrics:{activeTrips:0,onlineDrivers:1,offersPerMinute:0,dispatchLatencyMs:0,providerFailures:0,unacknowledgedIncidents:0},stop:{active:true,commandId:'stop'},coverage:{primary:'a',backup:'b',supervisor:'c',coverageStart:0,coverageEnd:200},now:100};
 assert.throws(()=>assessPilotAdmission(args),{code:'PILOT_ELIGIBILITY_DENIED'});
 assert.throws(()=>assessPilotAdmission({...args,trip:{...args.trip,scope:{...args.trip.scope,crossBoundary:true}}}),{code:'PILOT_ELIGIBILITY_DENIED'});
});
test('escalation abuse and stale emergency stop command are rejected',()=>{
 const snapshot={active:true,revision:5,commandId:'stop_1'};
 assert.throws(()=>evaluatePilotEmergencyStop({snapshot,operatorCommand:{actor:'evil',commandId:'stop_2',action:'stop',authorized:true,expectedRevision:4,expiresAt:200},now:100}),{code:'PILOT_STOP_AUTH_DENIED'});
 assert.equal(evaluatePilotEmergencyStop({snapshot,metrics:{securityAlert:true},now:100}).active,true);
});
test('stale or modified recovery evidence cannot erase incident or audit lineage',()=>{
 const source={imageDigest:h,migrationDigest:h,dataDigest:h,auditDigest:h,holdDigest:h,recordCount:10,verifiedAt:50,releaseSha:'b'.repeat(40)};
 for(const change of [{holdDigest:'c'.repeat(64)},{auditDigest:'c'.repeat(64)},{recordCount:11}])
 assert.throws(()=>verifyRecoveryProof({source,restored:{...source,...change},expectedSha:source.releaseSha,now:100}),{code:'RECOVERY_INTEGRITY_MISMATCH'});
});
test('compromised erasure provider cannot satisfy missing inventory with forged receipts',()=>{
 assert.throws(()=>verifyErasureReceipts({subjectRef:'subject_1',requestRef:'request_1',receipts:[],requiredProviders:[{kind:'backup',providerId:'backup_1'}],providerKeys:{backup_1:'bad-key'},now:100}),{code:'ERASURE_COVERAGE_INCOMPLETE'});
});
