// Public v1 SDK surface. Only LIFTd issues or verifies handoffs.
export const LIFTD_HANDOFF_API_VERSION='1.0';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function validateTravelHandoffV1(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==LIFTD_HANDOFF_API_VERSION||
  ![value.handoffId,value.tripId].every(id)||!Number.isSafeInteger(value.tripRevision)||value.tripRevision<0||
  !Number.isSafeInteger(value.expiresAt)||value.expiresAt<=0||
  !value.context||value.context.service!=='LIFTd'||value.context.kind!=='travel_ground_connection'||
  value.context.status!=='preview_only'||value.context.market!=='CA-BC-Vancouver'||
  Reflect.ownKeys(value).some(k=>!['version','handoffId','tripId','tripRevision','expiresAt','context'].includes(k))||
  Reflect.ownKeys(value.context).some(k=>!['service','kind','status','market'].includes(k)))throw Error('INVALID_HANDOFF_CONTRACT');
 return Object.freeze({...value,context:Object.freeze({...value.context})});
}
export function createLiftdTravelSdk({origin,fetchImpl,tokenProvider}){
 if(typeof origin!=='string'||typeof fetchImpl!=='function'||typeof tokenProvider!=='function')throw Error('SDK_CONFIGURATION_REQUIRED');
 const base=new URL(origin);if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw Error('SDK_ORIGIN_REQUIRED');
 async function send(path,body){
  const token=await tokenProvider();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('SESSION_UNAVAILABLE');
  const response=await fetchImpl(new URL(path,base),{method:body?'POST':'GET',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('HANDOFF_UNAVAILABLE');
  return validateTravelHandoffV1(await response.json());
 }
 return Object.freeze({
  prepare:(tripId,{commandId,consent})=>{
   if(!id(tripId)||!id(commandId)||consent!==true)throw Error('FRESH_CONSENT_REQUIRED');
   return send('/v1/rideshare/trips/'+tripId+'/travel-handoff',{commandId,purpose:'travel_ground_connection',consent:true});
  },
  verify:(tripId,handoffId)=>{
   if(!id(tripId)||!id(handoffId))throw Error('INVALID_HANDOFF');
   return send('/v1/rideshare/trips/'+tripId+'/travel-handoff/'+handoffId);
  }
 });
}
