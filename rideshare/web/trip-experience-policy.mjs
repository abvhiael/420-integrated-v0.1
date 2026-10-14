// L02.5: only canonical server trip snapshots create confirmed state.
export class TripViewError extends Error {constructor(code){super(code);this.name='TripViewError';this.code=code;}}
const fail=c=>{throw new TripViewError(c)};
export const tripId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export const statuses=Object.freeze(['REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED']);
export function validateTrip(snapshot,session,previous=null){
 if(!snapshot||typeof snapshot!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(snapshot))||
 Reflect.ownKeys(snapshot).some(k=>!['id','riderId','driverId','vehicleId','routeRef','state','revision'].includes(k)))fail('INVALID_TRIP');
 const {id,riderId,driverId,vehicleId,routeRef,state,revision}=snapshot;
 if(![id,riderId,routeRef].every(tripId)||!statuses.includes(state)||!Number.isSafeInteger(revision)||revision<0||
 !session||session.status!=='authenticated'||!session.roles?.includes('rider')||session.subject!==riderId||
 (driverId===null)!==(vehicleId===null)||(['ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED'].includes(state)&&(!tripId(driverId)||!tripId(vehicleId)))||
 (state==='REQUESTED'&&driverId!==null))fail('INVALID_OR_UNAUTHORIZED_TRIP');
 if(previous&&(previous.id!==id||previous.riderId!==riderId||revision<previous.revision||
 (revision===previous.revision&&JSON.stringify(snapshot)!==JSON.stringify(previous))))fail('STALE_OR_CROSS_TRIP');
 return Object.freeze({...snapshot});
}
export function tripPresentation(t){
 return Object.freeze({state:t.state,confirmed:true,driver:t.driverId??null,vehicle:t.vehicleId??null,
 canCancel:['REQUESTED','ASSIGNED','ARRIVED'].includes(t.state),
 canReport:['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(t.state),
 finished:['COMPLETED','CANCELLED'].includes(t.state)});
}
export function estimateLabel(seconds){
 if(!Number.isFinite(seconds)||seconds<0||seconds>86400)fail('INVALID_ESTIMATE');
 return 'Estimate only — approximately '+Math.ceil(seconds/60)+' minutes. Not a confirmed event.';
}
