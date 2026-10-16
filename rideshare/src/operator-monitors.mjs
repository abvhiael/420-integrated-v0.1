import {AuthError} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=503)=>{throw new AuthError(code,status)};
const live=new Set(['ASSIGNED','ARRIVED','IN_PROGRESS']);
export function createOperatorMonitors({pool,tripStore,eligibilityAdapter,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof pool?.query!=='function'||typeof tripStore?.get!=='function'||typeof eligibilityAdapter?.project!=='function')
  fail('OPERATOR_MONITOR_UNAVAILABLE');
 async function snapshot(tripId){
  if(!id(tripId))fail('INVALID_TRIP',400);
  const t=await tripStore.get(tripId);if(!t||t.id!==tripId)fail('TRIP_UNAVAILABLE',404);
  return t;
 }
 return Object.freeze({
  dispatch:Object.freeze({async read(tripId){
   const trip=await snapshot(tripId);
   let result;try{result=await pool.query('SELECT state,expires_at FROM liftd.assignment_leases WHERE trip_id=$1',[tripId]);}
   catch{fail('DISPATCH_MONITOR_UNAVAILABLE')}
   if(result.rows.length>1)fail('INVALID_DISPATCH_PROJECTION');
   const lease=result.rows[0];if(!lease)return Object.freeze({status:'NONE'});
   if(!['PENDING','ACCEPTED','CLOSED'].includes(lease.state))fail('INVALID_DISPATCH_PROJECTION');
   if(!Number.isSafeInteger(Number(lease.expires_at)))fail('INVALID_DISPATCH_PROJECTION');
   if(lease.state==='CLOSED')return Object.freeze({status:'CLOSED'});
   const now=clock();if(!Number.isSafeInteger(now)||now<0)fail('CLOCK_UNAVAILABLE');
   if(Number(lease.expires_at)<=now)return Object.freeze({status:'CLOSED'});
   return Object.freeze({status:trip.state==='ARRIVED'?'ARRIVED':lease.state});
  }}),
  eligibility:Object.freeze({async read(tripId){
   const trip=await snapshot(tripId);
   if(trip.state==='REQUESTED')return Object.freeze({status:'PENDING'});
   if(!live.has(trip.state))return Object.freeze({status:'EXPIRED'});
   try{
    const action=trip.state==='ASSIGNED'?'arrive':'start';
    const p=await eligibilityAdapter.project(trip,{action,expectedRevision:trip.revision});
    const n=clock();
    if(p?.admission?.allowed!==true||p.admission.tripId!==tripId||p.admission.driverId!==trip.driverId||
      p.admission.vehicleId!==trip.vehicleId||!Number.isSafeInteger(n)||p.admission.expiresAt<=n)
      return Object.freeze({status:'UNKNOWN'});
    return Object.freeze({status:'ELIGIBLE'});
   }catch(e){
    if(e instanceof AuthError&&e.status===403)return Object.freeze({status:'REVOKED'});
    return Object.freeze({status:'UNKNOWN'});
   }
  }})
 });
}
