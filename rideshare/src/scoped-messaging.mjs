import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=403)=>{throw new AuthError(code,status);};
// Transport credentials and room minting belong only to the independent Messaging owner.
export function createScopedMessagingService({authenticator,tripStore,messagingAuthority,clock=()=>Math.floor(Date.now()/1000),isPaused=()=>true}){
 if(typeof authenticator?.authorize!=='function'||typeof tripStore?.get!=='function'||
 typeof messagingAuthority?.mint!=='function'||typeof messagingAuthority?.revoke!=='function')
  fail('MESSAGING_UNAVAILABLE',503);
 const fresh=async(token,tripId)=>{
  const p=await authenticator.authorize(token,{action:'trip.read',resource:'trip:'+tripId});
  if(!['rider','driver'].includes(p.role)||!id(p.subject)||p.expiresAt<=clock())fail('MESSAGE_SCOPE_DENIED');
  return p;
 };
 return Object.freeze({
  async open(token,input){
   record(input,['tripId','commandId']);
   if(!id(input.tripId)||!id(input.commandId))fail('INVALID_MESSAGE_REQUEST',400);
   if(isPaused())fail('MESSAGING_PAUSED');
   const p=await fresh(token,input.tripId);
   const trip=await tripStore.get(input.tripId);
   if(!trip||!['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state)||
    !id(trip.riderId)||!id(trip.driverId)||!Number.isSafeInteger(trip.revision)||
    !(p.subject===trip.riderId&&p.role==='rider'||p.subject===trip.driverId&&p.role==='driver'))
    fail('MESSAGE_SCOPE_DENIED');
   // A fresh authoritative read precedes minting; a revision and assignment-bound
   // entitlement must be checked again by the independent Messaging transport.
   const expiresAt=Math.min(clock()+60,p.expiresAt);
   if(expiresAt<=clock())fail('MESSAGE_SCOPE_DENIED');
   const claim=Object.freeze({tripId:input.tripId,revision:trip.revision,riderId:trip.riderId,
    driverId:trip.driverId,requester:p.subject,role:p.role,commandId:input.commandId,expiresAt});
   const current=await fresh(token,input.tripId);
   const latest=await tripStore.get(input.tripId);
   if(current.subject!==p.subject||latest?.revision!==trip.revision||
      latest?.driverId!==trip.driverId||latest?.state!==trip.state||isPaused()||expiresAt<=clock())
    fail('MESSAGE_STATE_CHANGED');
   let entitlement;
   try{entitlement=await messagingAuthority.mint(claim);}catch{fail('MESSAGING_UNAVAILABLE',503);}
   if(!entitlement||entitlement.boundTripId!==claim.tripId||entitlement.boundRevision!==claim.revision||
     entitlement.boundRequester!==claim.requester||!id(entitlement.conversationId)||
     !Number.isSafeInteger(entitlement.expiresAt)||entitlement.expiresAt>claim.expiresAt||entitlement.expiresAt<=clock())
     fail('INVALID_MESSAGE_ENTITLEMENT',503);
   return Object.freeze({conversationId:entitlement.conversationId,expiresAt:entitlement.expiresAt,
     transportAvailable:true}); // no token in response, no user phone number
  },
  async revokeForTrip(tripId,revision){
   if(!id(tripId)||!Number.isSafeInteger(revision)||revision<0)fail('INVALID_MESSAGE_REQUEST',400);
   // This requires a trusted server lifecycle hook: never expose as a user endpoint.
   try{return await messagingAuthority.revoke({tripId,throughRevision:revision});}
   catch{fail('MESSAGING_UNAVAILABLE',503);}
  }
 });
}
