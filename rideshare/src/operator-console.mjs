// L02.10: operator read/triage facade; the trip, registry and safety owners retain execution authority.
import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=403)=>{throw new AuthError(code,status)};
const states=new Set(['REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED']);
export function redactedOperatorTrip(trip) {
 if(!trip||!id(trip.id)||!states.has(trip.state)||!Number.isSafeInteger(trip.revision))fail('INVALID_TRIP',503);
 return Object.freeze({tripId:trip.id,state:trip.state,revision:trip.revision,assigned:!!trip.driverId});
}
export function createOperatorConsoleService({authenticator,tripStore,dispatchMonitor,eligibilityMonitor,safetyService,audit,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof authenticator?.authorize!=='function'||typeof tripStore?.get!=='function'||
  typeof dispatchMonitor?.read!=='function'||typeof eligibilityMonitor?.read!=='function'||
  typeof safetyService?.read!=='function'||typeof safetyService?.resolve!=='function'||
  typeof audit?.append!=='function')fail('OPERATOR_UNAVAILABLE',503);
 function now(){const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n}
 async function authorize(token,tripId,action,previous) {
  if(!id(tripId))fail('INVALID_TRIP',400);
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!p||p.role!=='operator'||p.action!==action||p.resource!=='trip:'+tripId||
    !id(p.subject)||!id(p.accountId)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now())
    fail('OPERATOR_DENIED');
  if(previous&&(p.subject!==previous.subject||p.accountId!==previous.accountId||p.sessionId!==previous.sessionId||
   p.recoveryEpoch!==previous.recoveryEpoch||p.deviceId!==previous.deviceId))fail('OPERATOR_SESSION_CHANGED');
  return p;
 }
 async function scopedTrip(token,tripId,action,previous){
  const p=await authorize(token,tripId,action,previous);
  const trip=await tripStore.get(tripId);
  if(!trip||trip.id!==tripId)fail('TRIP_UNAVAILABLE',404);
  return {p,trip};
 }
 async function append(p,tripId,action,result,commandId){
  // Separate durable audit owner must guarantee atomic idempotency and immutable actor/action/history.
  await audit.append(Object.freeze({actorId:p.subject,accountId:p.accountId,tripId,action,result,commandId,at:now()}));
 }
 return Object.freeze({
  async snapshot(token,tripId) {
   const {p,trip}=await scopedTrip(token,tripId,'operator.monitor');
   const [dispatch,eligibility]=await Promise.all([dispatchMonitor.read(tripId),eligibilityMonitor.read(tripId)]);
   const fresh=await scopedTrip(token,tripId,'operator.monitor',p);
   if(fresh.trip.revision!==trip.revision||fresh.trip.state!==trip.state)fail('STALE_OPERATOR_VIEW',409);
   if(!dispatch||!['PENDING','ACCEPTED','ARRIVED','CLOSED','NONE'].includes(dispatch.status)||
      !eligibility||!['ELIGIBLE','REVOKED','EXPIRED','PENDING','UNKNOWN'].includes(eligibility.status))fail('INVALID_PROJECTION',503);
   await append(p,tripId,'monitor','READ',undefined);
   return Object.freeze({trip:redactedOperatorTrip(trip),dispatch:Object.freeze({status:dispatch.status}),
     eligibility:Object.freeze({status:eligibility.status}),liveService:false});
  },
  async incidents(token,tripId){
   const {p,trip}=await scopedTrip(token,tripId,'safety.read');
   const result=await safetyService.read(token,tripId);
   const fresh=await scopedTrip(token,tripId,'safety.read',p);
   if(fresh.trip.revision!==trip.revision)fail('STALE_OPERATOR_VIEW',409);
   if(!result||result.tripId!==tripId||!Array.isArray(result.incidents)||result.incidents.length>100)fail('INVALID_INCIDENT_PROJECTION',503);
   await append(p,tripId,'incident.read','READ',undefined);
   return Object.freeze({tripId,incidents:result.incidents.map(x=>Object.freeze({incidentId:x.incidentId,category:x.category,createdAt:x.createdAt})),resolution:result.resolution??null});
  },
  async resolve(token,tripId,command){
   record(command,['commandId','incidentId','expectedRevision','resolution']);
   if(!id(command.commandId)||!id(command.incidentId)||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0||
       !['safe_exit','interrupted'].includes(command.resolution))fail('INVALID_RECOVERY_REQUEST',400);
   const {p,trip}=await scopedTrip(token,tripId,'safety.resolve');
   if(trip.state!=='IN_PROGRESS'||trip.revision!==command.expectedRevision)fail('INVALID_RECOVERY_STATE',409);
   await authorize(token,tripId,'safety.resolve',p);
   // Canonical safety authority performs atomic incident existence, CAS, replay and financial/safety hooks.
   const result=await safetyService.resolve(token,tripId,command);
   if(!result||result.tripId!==tripId||result.incidentId!==command.incidentId||
      result.state!=='CANCELLED')fail('RECOVERY_UNCONFIRMED',503);
   await append(p,tripId,'incident.resolve',result.state,command.commandId);
   return Object.freeze({tripId,state:result.state,revision:result.revision});
  }
 });
}
