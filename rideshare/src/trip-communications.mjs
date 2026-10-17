import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=403)=>{throw new AuthError(code,status)};
const active=new Set(['ASSIGNED','ARRIVED','IN_PROGRESS']);
const allowedChannels=new Set(['email','sms']);
const safeText=x=>typeof x==='string'&&x.length>=1&&x.length<=1000&&!/[\u0000-\u001f\u007f]/.test(x);
export function safeTripUpdate(trip){
 if(!trip||!id(trip.id)||!active.has(trip.state)&&!['REQUESTED','COMPLETED','CANCELLED'].includes(trip.state)||
    !Number.isSafeInteger(trip.revision)||trip.revision<0)fail('INVALID_TRIP',503);
 // Never include identifiers of participants, precise coordinates, route or text.
 return Object.freeze({type:'liftd.trip.status',tripId:trip.id,state:trip.state,revision:trip.revision});
}
export function allowedNotification(preferences){
 if(!preferences||preferences.tripNotifications!==true||!allowedChannels.has(preferences.contactMethod))return null;
 return preferences.contactMethod;
}
// Only canonical Messenger can issue a transport-capable entitlement.
// No client or LIFTd self-signed grant is interpreted as delivery authorization.
export function createTripCommunicationService({authenticator,store,messenger,notifications,preferencesFor,consentGuard,clock=()=>Math.floor(Date.now()/1000),maxMembershipSeconds=120}){
 if(typeof authenticator?.authorize!=='function'||typeof store?.get!=='function'||
   typeof messenger?.authorizeTrip!=='function'||typeof messenger?.send!=='function'||typeof messenger?.read!=='function'||
   typeof preferencesFor!=='function'||typeof consentGuard?.require!=='function'||typeof notifications?.publish!=='function'||
   !Number.isSafeInteger(maxMembershipSeconds)||maxMembershipSeconds<1||maxMembershipSeconds>300)fail('COMMUNICATION_UNAVAILABLE',503);
 function now(){const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n}
 async function scoped(token,tripId,action){
  if(!id(tripId))fail('INVALID_TRIP',400);
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!['rider','driver'].includes(p.role)||p.action!==action||p.resource!=='trip:'+tripId||!id(p.subject)||!id(p.accountId))fail('MEMBERSHIP_DENIED');
  const trip=await store.get(tripId);
  if(!trip||!active.has(trip.state)||!id(trip.driverId)||!id(trip.riderId)||
    (p.role==='rider'?p.subject!==trip.riderId:p.subject!==trip.driverId))fail('MEMBERSHIP_DENIED');
  if(!Number.isSafeInteger(trip.revision)||trip.revision<1||!id(trip.vehicleId))fail('INVALID_TRIP',503);
  const t=now();if(!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=t)fail('MEMBERSHIP_EXPIRED');
  return {p,trip,time:t};
 }
 async function grant(token,tripId,action){
  const prior=await scoped(token,tripId,action);
  const expiry=Math.min(prior.p.expiresAt,prior.time+maxMembershipSeconds);
  const recipient=prior.p.subject===prior.trip.riderId?prior.trip.driverId:prior.trip.riderId;
  const g=await messenger.authorizeTrip(Object.freeze({tripId,tripRevision:prior.trip.revision,subject:prior.p.subject,recipient,accountId:prior.p.accountId,expiresAt:expiry}));
  if(!g||typeof g!=='object'||typeof g.capability!=='string'||!g.capability||
    g.tripId!==tripId||g.subject!==prior.p.subject||g.recipient!==recipient||
    g.tripRevision!==prior.trip.revision||!Number.isSafeInteger(g.expiresAt)||g.expiresAt>expiry||g.expiresAt<=now())
   fail('MESSENGER_AUTHORITY_UNAVAILABLE',503);
  const fresh=await scoped(token,tripId,action);
  if(fresh.p.subject!==prior.p.subject||fresh.p.accountId!==prior.p.accountId||
     fresh.trip.revision!==prior.trip.revision||fresh.trip.driverId!==prior.trip.driverId||fresh.trip.state!==prior.trip.state)
     fail('MEMBERSHIP_CHANGED');
  return {grant:g,subject:prior.p.subject,recipient,trip:prior.trip};
 }
 return Object.freeze({
  async read(token,tripId,cursor){
   if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>256||!/^[A-Za-z0-9_-]+$/.test(cursor)))fail('INVALID_CURSOR',400);
   const {grant:g,trip}=await grant(token,tripId,'trip.message.read');
   const result=await messenger.read(Object.freeze({capability:g.capability,tripId,cursor,limit:25}));
   if(!result||!Array.isArray(result.messages)||result.messages.length>25)fail('MESSENGER_INVALID_RESPONSE',503);
   // Messenger receipts are private; no off-chain plain text is copied into notifications.
   for(const row of result.messages)if(!row||row.tripId!==tripId||!id(row.sender)||![trip.riderId,trip.driverId].includes(row.sender)||!safeText(row.text))
     fail('MESSENGER_INVALID_RESPONSE',503);
   const fresh=await scoped(token,tripId,'trip.message.read');
   if(fresh.trip.revision!==trip.revision||fresh.trip.driverId!==trip.driverId||fresh.trip.state!==trip.state)fail('MEMBERSHIP_CHANGED');
   return Object.freeze({messages:result.messages.map(row=>Object.freeze({id:row.id,sender:row.sender,text:row.text})),
     nextCursor:typeof result.nextCursor==='string'?result.nextCursor:null});
  },
  async send(token,tripId,input){
   record(input,['commandId','text']);
   if(!id(input.commandId)||!safeText(input.text))fail('INVALID_MESSAGE',400);
   const {grant:g,subject}=await grant(token,tripId,'trip.message.send');
   // Reauthorize immediately before external side-effect; Messenger must enforce expiry,
   // recipient membership, idempotency and authoritative revocation at delivery.
   const fresh=await scoped(token,tripId,'trip.message.send');
   if(fresh.trip.revision!==g.tripRevision||fresh.trip.driverId!==g.recipient&&fresh.trip.riderId!==g.recipient)fail('MEMBERSHIP_CHANGED');
   const response=await messenger.send(Object.freeze({capability:g.capability,tripId,commandId:input.commandId,sender:subject,text:input.text}));
   if(!response||response.tripId!==tripId||!id(response.messageId)||!['ACCEPTED','DELIVERED'].includes(response.status))
     fail('MESSENGER_INVALID_RESPONSE',503);
   return Object.freeze({messageId:response.messageId,status:response.status});
  },
  async notifyTripEvent({tripId,revision,actorToken}){
   if(!id(tripId)||!Number.isSafeInteger(revision)||revision<0||typeof actorToken!=='string')fail('INVALID_REQUEST',400);
   // A real trip authority is required for event notification; no fabricated caller event.
   const p=await authenticator.authorize(actorToken,{action:'trip.read',resource:'trip:'+tripId});
   const trip=await store.get(tripId);
   if(!trip||trip.revision!==revision||!['rider','driver'].includes(p.role)||
     (p.role==='rider'?p.subject!==trip.riderId:p.subject!==trip.driverId))fail('EVENT_AUTHORITY_DENIED');
   const event=safeTripUpdate(trip);let delivered=0;
   for(const recipient of [trip.riderId,trip.driverId].filter(id)){
    // Rider notifications require fresh Identity and durable opt-in before delivery.\n    // A driver actor cannot impersonate a rider to read their consent.\n    if(recipient===trip.riderId){\n     if(p.role!=='rider'||p.subject!==recipient)continue;\n     const verified=await consentGuard.require({token:actorToken,accountId:p.accountId,purpose:'trip_notifications'});\n     if(verified?.subject!==recipient||verified?.accountId!==p.accountId)fail('EVENT_CONSENT_DENIED');\n    }\n    const pref=await preferencesFor(recipient);
    const channel=allowedNotification(pref?.preferences??pref);
    if(!channel)continue;
    // No names, addresses, coordinates, private messages, device tokens, or payment state in payload.
    await notifications.publish(Object.freeze({recipient,channel,event,commandId:'liftd_'+tripId+'_'+revision+'_'+recipient}));
    delivered++;
   }
   return Object.freeze({accepted:delivered});
  }
 });
}
