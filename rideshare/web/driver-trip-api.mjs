// Ephemeral authenticated transport. Server remains the only trip and incident authority.
export function createDriverTripApi(sessionProvider,{origin=globalThis.location?.origin,fetchImpl=globalThis.fetch}={}){
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 if(!origin||typeof fetchImpl!=='function'||typeof sessionProvider?.getAccessToken!=='function')return null;
 async function send(path,method='GET',body){
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('UNVERIFIED_SESSION');
  const u=new URL(path,origin);if(u.origin!==origin)throw Error('ORIGIN_DENIED');
  const response=await fetchImpl(u,{method,cache:'no-store',credentials:'omit',redirect:'error',
   headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw Error('AUTHORITY_UNAVAILABLE');
  return response.json();
 }
 return Object.freeze({
  read:tripId=>{if(!id(tripId))throw Error('INVALID_TRIP_ID');return send('/v1/rideshare/trips/'+tripId);},
  transition:(tripId,{action,expectedRevision,commandId})=>{
   if(!id(tripId)||!id(commandId)||!['arrive','start','complete'].includes(action)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('INVALID_COMMAND');
   return send('/v1/rideshare/trips/'+tripId+'/transitions','POST',{action,expectedRevision,commandId});
  },
  report:(tripId,{category,commandId})=>{
   if(!id(tripId)||!id(commandId)||!['medical','collision','threat','vehicle','other'].includes(category))throw Error('INVALID_INCIDENT');
   return send('/v1/rideshare/trips/'+tripId+'/safety/report','POST',{category,commandId});
  }
 });
}
