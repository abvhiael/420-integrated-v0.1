import {validateTrip,tripPresentation,TripViewError} from './trip-experience-policy.mjs';
export function createTripExperienceController({api,session,idFactory=()=>globalThis.crypto?.randomUUID?.()}){
 let trip=null,busy=false,pending=null;
 const guard=()=>{if(!trip)throw new TripViewError('NO_CONFIRMED_TRIP');if(busy)throw new TripViewError('IN_PROGRESS');};
 const refresh=async id=>{if(!api?.read)throw new TripViewError('AUTHORITY_UNAVAILABLE');const snapshot=validateTrip(await api.read(id),session,trip);trip=snapshot;return tripPresentation(trip);};
 const action=async(type,category)=>{
  guard();const allowed=tripPresentation(trip);
  if(type==='cancel'&&!allowed.canCancel||type==='report'&&!allowed.canReport)throw new TripViewError('ACTION_NOT_PERMITTED');
  const identity=trip.id;
  if(!pending||pending.type!==type||pending.category!==category){const key=idFactory();if(!key)throw new TripViewError('SECURE_ID_REQUIRED');pending={type,category,key};}
  busy=true;
  try {
   if(type==='cancel')await api.cancel(identity,trip.revision,pending.key);
   else await api.report(identity,category,pending.key);
   // Acknowledgment of command is not authoritative event confirmation; reread.
   const state=await refresh(identity);pending=null;return state;
  }catch(e){throw e;}finally{busy=false;}
 };
 return Object.freeze({
  load:async id=>{if(busy)throw new TripViewError('IN_PROGRESS');if(!trip||trip.id!==id){trip=null;pending=null;}return refresh(id);},
  snapshot:()=>trip,
  cancel:()=>action('cancel'),
  report:category=>action('report',category),
  clear:()=>{trip=null;pending=null;busy=false;}
 });
}
