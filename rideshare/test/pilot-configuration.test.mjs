import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_DEFAULTS,validatePilotConfiguration,assessPilotAdmission,evaluatePilotEmergencyStop} from '../src/pilot-configuration.mjs';
const config=()=>({...PILOT_DEFAULTS,maxActiveTrips:2,maxOnlineDrivers:3,maxOffersPerMinute:5,monitoring:{maxDispatchLatencyMs:1000,maxProviderFailures:0,maxUnacknowledgedIncidents:0}});
const trip=()=>({id:'trip_1',driverId:'driver_1',vehicleId:'vehicle_1',passengers:2,scope:{...PILOT_DEFAULTS.scope}});
const driver=()=>({driverId:'driver_1',active:true,suspended:false,eligibilityExpiresAt:200});
const vehicle=()=>({vehicleId:'vehicle_1',active:true,suspended:false,authorizedDriverId:'driver_1',capacity:4,eligibilityExpiresAt:200});
const metrics=()=>({activeTrips:0,onlineDrivers:2,offersPerMinute:0,dispatchLatencyMs:10,providerFailures:0,unacknowledgedIncidents:0});
const stop={active:true,commandId:'stop_default',revision:0};
const coverage={primary:'a',backup:'b',supervisor:'c',coverageStart:50,coverageEnd:200};
const args=()=>({config:config(),trip:trip(),driver:driver(),vehicle:vehicle(),metrics:metrics(),stop,coverage,now:100});
test('pilot must remain disabled by default even with plausible production flags',()=>{
 assert.equal(validatePilotConfiguration(config()).enabled,false);
 for(const patch of [{enabled:true},{productionAuthorized:true},{passengerTrafficEnabled:true},{scope:{...config().scope,municipality:'Richmond'}},{scope:{...config().scope,airport:true}},{scope:{...config().scope,crossBoundary:true}},{maxActiveTrips:4},{maxOffersPerMinute:-1},{monitoring:{...config().monitoring,maxProviderFailures:101}}])
 assert.throws(()=>validatePilotConfiguration({...config(),...patch}),{code:'PILOT_CONFIGURATION_DENIED'});
});
test('valid proof can only establish review readiness and never enable a real ride',()=>{
 assert.deepEqual(assessPilotAdmission(args()),{eligibleForIndependentReview:true,admitted:false,trafficEnabled:false});
});
test('driver, vehicle, route, capacity and expiry negatives fail closed',()=>{
 const a=args();
 for(const patch of [{driver:{...driver(),suspended:true}},{vehicle:{...vehicle(),authorizedDriverId:'other'}},{vehicle:{...vehicle(),capacity:1}},{trip:{...trip(),scope:{...trip().scope,crossBoundary:true}}},{driver:{...driver(),eligibilityExpiresAt:100}},{stop:{active:false,commandId:'stop_default'}},{coverage:{...coverage,backup:'a'}}])
 assert.rejects(async()=>assessPilotAdmission({...a,...patch}));
});
test('hard capacity and monitoring thresholds deny admission',()=>{
 const a=args();
 for(const m of [{activeTrips:2},{onlineDrivers:4},{offersPerMinute:5},{dispatchLatencyMs:1001},{providerFailures:1},{unacknowledgedIncidents:1}])
 assert.throws(()=>assessPilotAdmission({...a,metrics:{...metrics(),...m}}),{code:'PILOT_CAPACITY_OR_MONITORING_DENIED'});
});
test('emergency stop requires authorized operator and correct revision; lost monitoring stays stopped',()=>{
 assert.deepEqual(evaluatePilotEmergencyStop({snapshot:stop,metrics:{},now:100}),stop);
 const halt=evaluatePilotEmergencyStop({snapshot:stop,operatorCommand:{actor:'operator_1',commandId:'stop_2',action:'stop',authorized:true,expectedRevision:0,expiresAt:150},now:100});
 assert.equal(halt.active,true);assert.equal(halt.revision,1);
 assert.throws(()=>evaluatePilotEmergencyStop({snapshot:stop,operatorCommand:{actor:'operator_1',commandId:'stop_2',action:'stop',authorized:false,expectedRevision:0,expiresAt:150},now:100}),{code:'PILOT_STOP_AUTH_DENIED'});
 assert.equal(evaluatePilotEmergencyStop({snapshot:stop,metrics:{providerUnavailable:true},now:100}).reason,'FAIL_CLOSED');
});
