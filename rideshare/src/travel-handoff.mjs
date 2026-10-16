// L02.11 - bounded Travel handoff. Trip and consent authority remain with LIFTd.
import {randomBytes,createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=403)=>{throw new AuthError(code,status)};
const active=new Set(['REQUESTED','ASSIGNED','ARRIVED']);
const digest=x=>createHash('sha256').update(x).digest('hex');
export const TRAVEL_HANDOFF_VERSION='1.0';
export const travelHandoffSchema=Object.freeze({version:TRAVEL_HANDOFF_VERSION,request:['commandId','tripId','purpose','consent'],response:['version','handoffId','tripId','tripRevision','expiresAt','context']});
export function boundedTravelContext(trip) {
 if(!trip||!id(trip.id)||!id(trip.routeRef)||!active.has(trip.state)||!Number.isSafeInteger(trip.revision)||trip.revision<0)fail('TRIP_HANDOFF_UNAVAILABLE',409);
 // No coordinates, routeRef, identities, vehicle, fare, phone, documents or payment state.
 return Object.freeze({service:'LIFTd',kind:'travel_ground_connection',status:'preview_only',market:'CA-BC-Vancouver'});
}
export function createTravelHandoffService({authenticator,tripStore,consentStore,clock=()=>Math.floor(Date.now()/1000),ttlSeconds=120}) {
 if(typeof authenticator?.authorize!=='function'||typeof tripStore?.get!=='function'||
  typeof consentStore?.consume!=='function'||typeof consentStore?.read!=='function'||
  !Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>300)fail('HANDOFF_UNAVAILABLE',503);
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('CLOCK_UNAVAILABLE',503);return t};
 async function permitted(token,tripId,principal=null) {
  if(!id(tripId))fail('INVALID_TRIP',400);
  const p=await authenticator.authorize(token,{action:'travel.handoff',resource:'trip:'+tripId});
  if(!p||p.role!=='rider'||p.action!=='travel.handoff'||p.resource!=='trip:'+tripId||!id(p.subject)||!id(p.accountId)||
    !Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now())fail('HANDOFF_DENIED');
  if(principal&&(p.subject!==principal.subject||p.accountId!==principal.accountId||
    p.deviceId!==principal.deviceId||p.sessionId!==principal.sessionId||p.recoveryEpoch!==principal.recoveryEpoch))fail('SESSION_CHANGED');
  const trip=await tripStore.get(tripId);
  if(!trip||trip.riderId!==p.subject)fail('HANDOFF_DENIED');
  boundedTravelContext(trip);
  return {p,trip};
 }
 return Object.freeze({
  async prepare(token,tripId,input){
   record(input,['commandId','purpose','consent']);
   if(!id(input.commandId)||input.purpose!=='travel_ground_connection'||input.consent!==true)fail('CONSENT_REQUIRED',400);
   const first=await permitted(token,tripId);
   const expiresAt=Math.min(first.p.expiresAt,now()+ttlSeconds);
   if(expiresAt<=now())fail('HANDOFF_EXPIRED');
   // A durable exact-context one-time consent record is required. No client-supplied signed capability.
   const request=Object.freeze({commandId:input.commandId,tripId,tripRevision:first.trip.revision,
     actorId:first.p.subject,accountId:first.p.accountId,sessionId:first.p.sessionId,
     purpose:input.purpose,expiresAt,consent:true});
   const fresh=await permitted(token,tripId,first.p);
   if(fresh.trip.revision!==first.trip.revision||fresh.trip.state!==first.trip.state)fail('TRIP_CHANGED',409);
   const receipt=await consentStore.consume(request);
   if(!receipt||receipt.commandId!==input.commandId||receipt.tripId!==tripId||receipt.actorId!==first.p.subject||
      receipt.tripRevision!==first.trip.revision||receipt.purpose!==input.purpose||
      !id(receipt.handoffId)||receipt.expiresAt>expiresAt||receipt.expiresAt<=now())fail('CONSENT_UNVERIFIED',503);
   await permitted(token,tripId,first.p);
   return Object.freeze({version:TRAVEL_HANDOFF_VERSION,handoffId:receipt.handoffId,
      tripId,tripRevision:first.trip.revision,expiresAt:receipt.expiresAt,context:boundedTravelContext(first.trip)});
  },
  async verify(token,tripId,handoffId){
   if(!id(handoffId))fail('INVALID_HANDOFF',400);
   const first=await permitted(token,tripId);
   const receipt=await consentStore.read({handoffId,tripId,actorId:first.p.subject,accountId:first.p.accountId,sessionId:first.p.sessionId});
   if(!receipt||receipt.handoffId!==handoffId||receipt.tripId!==tripId||receipt.actorId!==first.p.subject||
      receipt.accountId!==first.p.accountId||receipt.sessionId!==first.p.sessionId||
      receipt.tripRevision!==first.trip.revision||receipt.purpose!=='travel_ground_connection'||
      !Number.isSafeInteger(receipt.expiresAt)||receipt.expiresAt<=now())fail('CONSENT_EXPIRED');
   const fresh=await permitted(token,tripId,first.p);
   if(fresh.trip.revision!==first.trip.revision||fresh.trip.state!==first.trip.state)fail('TRIP_CHANGED',409);
   return Object.freeze({version:TRAVEL_HANDOFF_VERSION,handoffId,tripId,tripRevision:fresh.trip.revision,
      expiresAt:receipt.expiresAt,context:boundedTravelContext(fresh.trip)});
  }
 });
}
export function createInMemoryTravelConsentFixture({clock=()=>Math.floor(Date.now()/1000)}={}){
 // Tests only. Never use this non-durable fixture as a production consent provider.
 const rows=new Map(),commands=new Map();
 return Object.freeze({
  async consume(request){
   const key=request.actorId+':'+request.commandId;
   const previous=commands.get(key);
   if(previous){
    if(previous.hash!==digest(JSON.stringify(request)))fail('IDEMPOTENCY_CONFLICT',409);
    return previous.receipt;
   }
   const receipt=Object.freeze({commandId:request.commandId,handoffId:randomBytes(18).toString('base64url'),
    tripId:request.tripId,actorId:request.actorId,tripRevision:request.tripRevision,purpose:request.purpose,expiresAt:request.expiresAt});
   commands.set(key,{hash:digest(JSON.stringify(request)),receipt});rows.set(receipt.handoffId,receipt);return receipt;
  },
  async read({handoffId,tripId,actorId}){const r=rows.get(handoffId);return r&&r.tripId===tripId&&r.actorId===actorId&&r.expiresAt>clock()?r:null}
 });
}
