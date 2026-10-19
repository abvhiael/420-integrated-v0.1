// Transport-only LIFTd driver adapter. No mobile-side approval or offer minting.
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function createDriverApi({origin,accessToken,fetchImpl=fetch}){
 let base;try{base=new URL(origin);}catch{throw Error('UNAPPROVED_ORIGIN');}
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||typeof accessToken!=='function'||typeof fetchImpl!=='function')throw Error('UNAPPROVED_ORIGIN');
 const check=x=>{if(!id(x))throw Error('INVALID_ID');return x;};
 const request=async(path,method='GET',body)=>{
  const token=await accessToken();if(typeof token!=='string'||token.length>32768||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('UNVERIFIED_SESSION');
  const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith('/v1/rideshare/'))throw Error('CROSS_ORIGIN');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetchImpl(url.href,{method,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error',
   headers:{authorization:'Bearer '+token,accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(!response.ok||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw Error('DRIVER_SERVICE_UNAVAILABLE');
   const text=await response.text();if(text.length>65536)throw Error('RESPONSE_TOO_LARGE');return JSON.parse(text);
  }finally{clearTimeout(timer);}
 };
 const driver=s=>check(s.subject);
 return Object.freeze({
  readOnboarding:s=>request('/v1/rideshare/drivers/'+driver(s)+'/onboarding'),
  submitOnboarding:(s,body)=>request('/v1/rideshare/drivers/'+driver(s)+'/onboarding','POST',body),
  readAvailability:s=>request('/v1/rideshare/drivers/'+driver(s)+'/availability'),
  setAvailability:(s,body)=>request('/v1/rideshare/availability','POST',body),
  readOffers:s=>request('/v1/rideshare/drivers/'+driver(s)+'/offers'),
  respondOffer:(s,body)=>request('/v1/rideshare/drivers/'+driver(s)+'/offers/'+check(body.offerId)+'/response','POST',body),
  readTrip:(s,tripId)=>request('/v1/rideshare/trips/'+check(tripId)),
  transition:(s,tripId,body)=>request('/v1/rideshare/trips/'+check(tripId)+'/transitions','POST',body),
  reportSafety:(s,tripId,body)=>request('/v1/rideshare/trips/'+check(tripId)+'/safety/report','POST',body),
  navigation:(s,tripId)=>request('/v1/rideshare/trips/'+check(tripId)+'/navigation')
 });
}
