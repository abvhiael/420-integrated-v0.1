import {availability,offer,capacity,DriverOfferError} from './driver-availability-policy.mjs';
export function createDriverAvailabilityController({api,session,clock=()=>Math.floor(Date.now()/1000),nonce=()=>globalThis.crypto?.randomUUID?.()}){
 let current=null,offers=[],busy=false,mutating=null, disconnected=false;
 const check=()=>{if(disconnected)throw new DriverOfferError('DISCONNECTED');if(busy)throw new DriverOfferError('IN_PROGRESS');if(!api)throw new DriverOfferError('AUTHORITY_UNAVAILABLE');};
 return Object.freeze({
  snapshot:()=>({current,offers:[...offers],busy,disconnected}),
  async refresh(){
   check();busy=true;
   try{
    const a=availability(await api.readAvailability(session.subject),session,clock());
    const o=await api.readOffers(session.subject);
    if(!Array.isArray(o)||o.length>20)throw new DriverOfferError('INVALID_OFFERS');
    const checked=o.map(x=>offer(x,session,clock()));
    if(checked.some(x=>x.vehicleId!==a.vehicleId))throw new DriverOfferError('VEHICLE_MISMATCH');
    current=a;offers=checked;return this.snapshot();
   }finally{busy=false;}
  },
  async setOnline(value,vehicleId,passengerCapacity){
   check();if(typeof value!=='boolean'||typeof vehicleId!=='string'||!current||current.vehicleId!==vehicleId)throw new DriverOfferError('INVALID_AVAILABILITY');
   capacity(passengerCapacity);
   if(!mutating){const id=nonce();if(!id)throw new DriverOfferError('SECURE_ID_REQUIRED');mutating={type:'availability',commandId:id,value,revision:current.revision};}
   if(mutating.type!=='availability'||mutating.value!==value||mutating.revision!==current.revision)throw new DriverOfferError('RECONCILE_REQUIRED');
   busy=true;
   try{
    const result=availability(await api.setAvailability({driverId:session.subject,vehicleId,online:value,expectedRevision:mutating.revision,commandId:mutating.commandId}),session,clock());
    current=result;mutating=null;return result;
   }finally{busy=false;}
  },
  async respond(entry,decision){
   check();if(!['accept','reject'].includes(decision))throw new DriverOfferError('INVALID_DECISION');
   const latest=offers.find(x=>x.offerId===entry?.offerId);if(!latest||!latest.canRespond||clock()>=latest.expiresAt)throw new DriverOfferError('OFFER_EXPIRED');
   if(!current?.active)throw new DriverOfferError('AVAILABILITY_EXPIRED');
   if(!mutating){const id=nonce();if(!id)throw new DriverOfferError('SECURE_ID_REQUIRED');mutating={type:'offer',commandId:id,offerId:latest.offerId,decision};}
   if(mutating.type!=='offer'||mutating.offerId!==latest.offerId||mutating.decision!==decision)throw new DriverOfferError('RECONCILE_REQUIRED');
   busy=true;
   try{
    await api.respondOffer(session.subject,{tripId:latest.tripId,offerId:latest.offerId,expectedRevision:latest.revision,decision,commandId:mutating.commandId});
    // Never infer acceptance from the command response: refresh server state.
    mutating=null;busy=false;return await this.refresh();
   }finally{busy=false;}
  },
  disconnect(){disconnected=true;current=null;offers=[];busy=false;},
  reconnect(){disconnected=false;mutating=null;current=null;offers=[];},
 });
}
