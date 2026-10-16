// L02.8: client presentation never grants authoritative trip transitions.
export class DriverTripError extends Error {constructor(code){super(code);this.name='DriverTripError';this.code=code;}}
const fail=code=>{throw new DriverTripError(code)};
export const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const stages=['ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED'];
export function verifiedDriverTrip(value,session,previous=null){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
    Reflect.ownKeys(value).some(k=>!['id','riderId','driverId','vehicleId','routeRef','state','revision'].includes(k)))fail('INVALID_TRIP');
 if(!session||session.status!=='authenticated'||!session.roles?.includes('driver')||!validId(session.subject)||
    value.driverId!==session.subject||![value.id,value.riderId,value.vehicleId,value.routeRef].every(validId)||
    !stages.includes(value.state)||!Number.isSafeInteger(value.revision)||value.revision<0)fail('UNAUTHORIZED_TRIP');
 if(previous&&(previous.id!==value.id||value.driverId!==previous.driverId||value.vehicleId!==previous.vehicleId||
    value.riderId!==previous.riderId||value.routeRef!==previous.routeRef||
    value.revision<previous.revision||(value.revision===previous.revision&&JSON.stringify(value)!==JSON.stringify(previous))))fail('STALE_TRIP');
 return Object.freeze({...value});
}
export function driverTripPresentation(trip){
 if(!trip)return Object.freeze({state:'UNVERIFIED',canArrive:false,canStart:false,canComplete:false,canReport:false,terminal:false});
 return Object.freeze({state:trip.state,revision:trip.revision,canArrive:trip.state==='ASSIGNED',
   canStart:trip.state==='ARRIVED',canComplete:trip.state==='IN_PROGRESS',
   canReport:['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state),
   terminal:['COMPLETED','CANCELLED'].includes(trip.state)});
}
export function validateNavigationHandoff(result,trip){
 // An independent server-issued capability, not client-built geocoordinates or a guessed URL.
 if(!result||typeof result!=='object'||Array.isArray(result)||!validId(result.tripId)||result.tripId!==trip.id||
    !validId(result.routeRef)||result.routeRef!==trip.routeRef||!Number.isSafeInteger(result.expiresAt)||
    result.expiresAt<=Math.floor(Date.now()/1000)||typeof result.url!=='string')fail('NAVIGATION_UNAVAILABLE');
 let uri;try{uri=new URL(result.url)}catch{fail('NAVIGATION_UNAVAILABLE')}
 if(uri.protocol!=='https:'||uri.username||uri.password||uri.hash||uri.origin==='null')fail('NAVIGATION_UNAVAILABLE');
 return uri.href;
}
