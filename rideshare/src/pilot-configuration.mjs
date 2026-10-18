import {createHash} from 'node:crypto';
import {VANCOUVER_SCOPE} from './eligibility.mjs';
import {validateDutyCoverage} from './operational-safety.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const canonical=x=>JSON.stringify(x,Object.keys(x??{}).sort());
export const PILOT_DEFAULTS=Object.freeze({
 enabled:false,productionAuthorized:false,passengerTrafficEnabled:false,
 scope:Object.freeze({...VANCOUVER_SCOPE,airport:false,crossBoundary:false}),
 maxActiveTrips:0,maxOnlineDrivers:0,maxOffersPerMinute:0,
 monitoring:Object.freeze({maxDispatchLatencyMs:0,maxProviderFailures:0,maxUnacknowledgedIncidents:0})
});
export function validatePilotConfiguration(config){
 if(!config||typeof config!=='object'||Array.isArray(config)||config.enabled!==false||
 config.productionAuthorized!==false||config.passengerTrafficEnabled!==false||
 !config.scope||Object.entries(VANCOUVER_SCOPE).some(([k,v])=>config.scope[k]!==v)||
 config.scope.airport!==false||config.scope.crossBoundary!==false||
 Object.keys(config.scope).sort().join(',')!==Object.keys(PILOT_DEFAULTS.scope).sort().join(',')||
 !int(config.maxActiveTrips)||config.maxActiveTrips>100||
 !int(config.maxOnlineDrivers)||config.maxOnlineDrivers>100||
 !int(config.maxOffersPerMinute)||config.maxOffersPerMinute>600||
 !config.monitoring||!int(config.monitoring.maxDispatchLatencyMs)||config.monitoring.maxDispatchLatencyMs>30000||
 !int(config.monitoring.maxProviderFailures)||config.monitoring.maxProviderFailures>100||
 !int(config.monitoring.maxUnacknowledgedIncidents)||config.monitoring.maxUnacknowledgedIncidents>10)
 fail('PILOT_CONFIGURATION_DENIED');
 if(config.maxActiveTrips>config.maxOnlineDrivers)fail('PILOT_CAPACITY_INVALID');
 return Object.freeze({...config,scope:Object.freeze({...config.scope}),monitoring:Object.freeze({...config.monitoring})});
}
/** Admission is dry-run only: no signature, fixture or PR can authorize a pilot. */
export function assessPilotAdmission({config,trip,driver,vehicle,metrics,stop,coverage,now}){
 const c=validatePilotConfiguration(config);
 if(!int(now)||!stop||stop.active!==true||!id(stop.commandId))fail('PILOT_STOP_REQUIRED');
 if(!trip||!id(trip.id)||!id(trip.driverId)||!id(trip.vehicleId)||
 !trip.scope||Object.entries(c.scope).some(([k,v])=>trip.scope[k]!==v)||
 trip.driverId!==driver?.driverId||trip.vehicleId!==vehicle?.vehicleId||
 driver.active!==true||driver.suspended!==false||vehicle.active!==true||vehicle.suspended!==false||
 vehicle.authorizedDriverId!==driver.driverId||!int(vehicle.capacity)||vehicle.capacity<trip.passengers||
 !int(trip.passengers)||trip.passengers<1||driver.eligibilityExpiresAt<=now||vehicle.eligibilityExpiresAt<=now)
 fail('PILOT_ELIGIBILITY_DENIED');
 if(!metrics||!int(metrics.activeTrips)||!int(metrics.onlineDrivers)||!int(metrics.offersPerMinute)||
 !int(metrics.dispatchLatencyMs)||!int(metrics.providerFailures)||!int(metrics.unacknowledgedIncidents)||
 metrics.activeTrips>=c.maxActiveTrips||metrics.onlineDrivers>c.maxOnlineDrivers||
 metrics.offersPerMinute>=c.maxOffersPerMinute||
 metrics.dispatchLatencyMs>c.monitoring.maxDispatchLatencyMs||
 metrics.providerFailures>c.monitoring.maxProviderFailures||
 metrics.unacknowledgedIncidents>c.monitoring.maxUnacknowledgedIncidents)
 fail('PILOT_CAPACITY_OR_MONITORING_DENIED');
 validateDutyCoverage(coverage,now);
 return Object.freeze({eligibleForIndependentReview:true,admitted:false,trafficEnabled:false});
}
export function evaluatePilotEmergencyStop({snapshot,metrics,operatorCommand,now}){
 if(!int(now)||!snapshot||snapshot.active!==true||!id(snapshot.commandId))fail('PILOT_STOP_REQUIRED');
 if(operatorCommand){
  if(!id(operatorCommand.actor)||!id(operatorCommand.commandId)||
   operatorCommand.action!=='stop'||operatorCommand.authorized!==true||
   !int(operatorCommand.expiresAt)||operatorCommand.expiresAt<=now||
   operatorCommand.expectedRevision!==snapshot.revision)fail('PILOT_STOP_AUTH_DENIED');
  return Object.freeze({active:true,revision:snapshot.revision+1,commandId:operatorCommand.commandId,reason:'OPERATOR_STOP'});
 }
 if(!metrics||metrics.providerUnavailable===true||metrics.securityAlert===true||
 metrics.capacityExceeded===true||metrics.monitoringUnavailable===true)
 return Object.freeze({active:true,revision:snapshot.revision+1,commandId:snapshot.commandId,reason:'FAIL_CLOSED'});
 return Object.freeze({...snapshot});
}
