import {DriverTripError,verifiedDriverTrip,driverTripPresentation,validId,validateNavigationHandoff} from './driver-trip-policy.mjs';
export function createDriverTripController({api,session,nonce=()=>globalThis.crypto?.randomUUID?.(),navigationCapability}){
 let trip=null,pending=null,busy=false,disconnected=false,pickupConfirmed=false,lastTripId=null;
 const guard=()=>{if(disconnected)throw new DriverTripError('OFFLINE');if(busy)throw new DriverTripError('IN_PROGRESS');if(!api?.read)throw new DriverTripError('AUTHORITY_UNAVAILABLE');};
 const snapshot=()=>Object.freeze({trip,presentation:driverTripPresentation(trip),busy,disconnected,pickupConfirmed,pending:pending?.action??null});
 async function read(id){
  const next=verifiedDriverTrip(await api.read(id),session,trip);
  if(next.id!==id)throw new DriverTripError('CROSS_TRIP_RESPONSE');
  trip=next;
  if(next.state!=='ARRIVED')pickupConfirmed=false;
  return snapshot();
 }
 return Object.freeze({
  snapshot,
  async load(id){
   guard();if(!validId(id))throw new DriverTripError('INVALID_TRIP_ID');
   if(lastTripId!==id){trip=null;pending=null;pickupConfirmed=false;}lastTripId=id;
   busy=true;try{return await read(id)}finally{busy=false}
  },
  confirmPickup(value){guard();if(!trip||trip.state!=='ARRIVED')throw new DriverTripError('ARRIVAL_REQUIRED');pickupConfirmed=value===true;return snapshot();},
  async action(action){
   guard();if(!['arrive','start','complete'].includes(action))throw new DriverTripError('INVALID_COMMAND');
   if(!trip)throw new DriverTripError('NO_CONFIRMED_TRIP');
   if(!driverTripPresentation(trip)[{arrive:'canArrive',start:'canStart',complete:'canComplete'}[action]])throw new DriverTripError('TRANSITION_DENIED');
   if(action==='start'&&!pickupConfirmed)throw new DriverTripError('PICKUP_CONFIRMATION_REQUIRED');
   if(pending&&pending.action!==action)throw new DriverTripError('RECONCILE_REQUIRED');
   if(!pending){const key=nonce();if(!validId(key))throw new DriverTripError('SECURE_ID_REQUIRED');pending={action,commandId:key,expectedRevision:trip.revision,tripId:trip.id};}
   busy=true;try{
    await api.transition(trip.id,pending);
    const state=await read(trip.id);
    pending=null;return state;
   }finally{busy=false}
  },
  async reconcile(){
   guard();if(!lastTripId)throw new DriverTripError('NO_CONFIRMED_TRIP');
   busy=true;try{
    const old=trip,updated=await read(lastTripId);
    if(pending&&(!old||updated.trip.revision!==old.revision||updated.trip.state!==old.state))pending=null;
    return snapshot();
   }finally{busy=false}
  },
  async report(category){
   guard();if(!trip||!driverTripPresentation(trip).canReport)throw new DriverTripError('REPORT_DENIED');
   if(!['medical','collision','threat','vehicle','other'].includes(category))throw new DriverTripError('INVALID_INCIDENT');
   if(pending&&pending.action!=='report')throw new DriverTripError('RECONCILE_REQUIRED');
   if(!pending){const key=nonce();if(!validId(key))throw new DriverTripError('SECURE_ID_REQUIRED');pending={action:'report',commandId:key,category,tripId:trip.id};}
   if(pending.category!==category)throw new DriverTripError('RECONCILE_REQUIRED');
   busy=true;try{
    await api.report(trip.id,pending);const result=await read(trip.id);pending=null;return result;
   }finally{busy=false}
  },
  async navigation(){
   guard();if(!trip||!['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state)||typeof navigationCapability!=='function')
    throw new DriverTripError('NAVIGATION_UNAVAILABLE');
   const result=await navigationCapability(Object.freeze({tripId:trip.id,routeRef:trip.routeRef}),session);
   return validateNavigationHandoff(result,trip);
  },
  disconnect(){disconnected=true;trip=null;pickupConfirmed=false;/* retain pending command until explicit reconciliation */},
  reconnect(){disconnected=false;trip=null;pickupConfirmed=false;/* never replay queued offline actions */},
  clear(){trip=null;pending=null;lastTripId=null;busy=false;pickupConfirmed=false;disconnected=true}
 });
}
