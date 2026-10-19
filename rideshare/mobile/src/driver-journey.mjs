// MBL-4 mobile orchestration, reusing the qualified L02 canonical driver policies.
// No local eligibility inference: backend confirms every sensitive state.
import {availability,offer,capacity} from '../../web/driver-availability-policy.mjs';
import {verifiedDriverTrip,driverTripPresentation,validateNavigationHandoff,validId} from '../../web/driver-trip-policy.mjs';
const fail=x=>{throw Error(x);};
export function createDriverJourney({session,api,clock=()=>Math.floor(Date.now()/1000),commandId}){
 if(typeof session?.withFreshRole!=='function'||!api||typeof commandId!=='function'||typeof clock!=='function')fail('INVALID_CONFIGURATION');
 let generation=0,busy=false,review=null,available=null,offers=[],trip=null;
 const command=()=>{const v=commandId();if(!validId(v))fail('INVALID_COMMAND_ID');return v;};
 const fresh=async fn=>{if(busy)fail('ACTION_IN_PROGRESS');busy=true;const op=++generation;
  try{return await session.withFreshRole('driver',async s=>{
   if(!validId(s?.subject)||!validId(s?.accountId)||!validId(s?.sessionId))fail('INVALID_DRIVER_SESSION');
   const who={status:'authenticated',subject:s.subject,roles:['driver'],accountId:s.accountId};
   const result=await fn(who);
   if(op!==generation)fail('STALE_OPERATION');return result;
  });}catch(e){review=null;available=null;offers=[];trip=null;throw e;}finally{busy=false;}
 };
 const verifyReview=(value,s)=>{
  if(!value||typeof value!=='object'||value.driverId!==s.subject||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.status!=='string'||!Array.isArray(value.remediation))fail('INVALID_REVIEW');
  return Object.freeze({...value});
 };
 return Object.freeze({
  state:()=>Object.freeze({review,availability:available,offers:[...offers],trip,busy}),
  async readOnboarding(){return fresh(async s=>{review=verifyReview(await api.readOnboarding(s),s);return review;});},
  async submitDocuments({vehicleId,kind,privateRef,expiresAt}){
   if(!validId(vehicleId)||!validId(privateRef)||!['licence','insurance','registration','inspection','background_check'].includes(kind)||!Number.isSafeInteger(expiresAt)||expiresAt<=clock())fail('INVALID_DOCUMENT_METADATA');
   if(!review)fail('ONBOARDING_STATUS_REQUIRED');
   return fresh(async s=>{const req={driverId:s.subject,vehicleId,documents:[{kind,privateRef,expiresAt}],expectedRevision:review.revision,commandId:command()};
    const response=await api.submitOnboarding(s,req);review=null;return response;});
  },
  async readAvailability(){return fresh(async s=>{available=availability(await api.readAvailability(s),s,clock());return available;});},
  async setAvailability({online,vehicleId,seats}){
   if(!available||typeof online!=='boolean'||!validId(vehicleId)||online&&seats===undefined)fail('AVAILABILITY_STATUS_REQUIRED');
   if(online)capacity(seats);
   return fresh(async s=>{
    const request={driverId:s.subject,vehicleId,online,capacity:online?seats:0,expectedRevision:available.revision,commandId:command()};
    available=availability(await api.setAvailability(s,request),s,clock());return available;
   });
  },
  async readOffers(){return fresh(async s=>{
   const result=await api.readOffers(s);if(!Array.isArray(result)||result.length>100)fail('INVALID_OFFERS');
   offers=result.map(x=>offer(x,s,clock()));return [...offers];
  });},
  async respondOffer(offerId,accepted){
   if(!validId(offerId)||typeof accepted!=='boolean')fail('INVALID_OFFER_RESPONSE');
   const chosen=offers.find(x=>x.offerId===offerId);if(!chosen||!chosen.canRespond||chosen.expiresAt<=clock())fail('OFFER_EXPIRED_OR_UNAVAILABLE');
   return fresh(async s=>{const result=offer(await api.respondOffer(s,{offerId,action:accepted?'accept':'reject',expectedRevision:chosen.revision,commandId:command()}),s,clock());
    offers=offers.map(x=>x.offerId===offerId?result:x);return result;
   });
  },
  async readTrip(id){if(!validId(id))fail('INVALID_TRIP_ID');return fresh(async s=>{trip=verifiedDriverTrip(await api.readTrip(s,id),s,trip);return trip;});},
  async transition(action){
   if(!trip||!['arrive','start','complete'].includes(action))fail('TRIP_UNAVAILABLE');
   const flags=driverTripPresentation(trip);
   if(!(action==='arrive'&&flags.canArrive||action==='start'&&flags.canStart||action==='complete'&&flags.canComplete))fail('TRANSITION_DENIED');
   return fresh(async s=>{trip=verifiedDriverTrip(await api.transition(s,trip.id,{action,expectedRevision:trip.revision,commandId:command()}),s,trip);return trip;});
  },
  async navigation(){if(!trip)fail('TRIP_UNAVAILABLE');return fresh(async s=>validateNavigationHandoff(await api.navigation(s,trip.id),trip));},
  async reportSafety(category){if(!trip||!driverTripPresentation(trip).canReport||!['medical','collision','threat','vehicle','other'].includes(category))fail('INCIDENT_DENIED');
   return fresh(async s=>api.reportSafety(s,trip.id,{category,commandId:command()}));},
  suspend(){generation++;review=null;available=null;offers=[];trip=null;}
 });
}
