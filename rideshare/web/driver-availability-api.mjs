// All endpoints must be backed by authoritative L01 verification; no fake offers are generated.
export function createDriverAvailabilityApi(sessionProvider,{origin=globalThis.location?.origin,fetchImpl=fetch}={}){
 if(!origin||typeof fetchImpl!=='function'||typeof sessionProvider?.getAccessToken!=='function')return null;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 async function call(path,method='GET',body){
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('UNVERIFIED_SESSION');
  const url=new URL(path,origin);if(url.origin!==origin)throw Error('CROSS_ORIGIN');
  const response=await fetchImpl(url,{method,credentials:'omit',cache:'no-store',redirect:'error',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('AUTHORITY_UNAVAILABLE');
  return response.json();
 }
 return Object.freeze({
  readAvailability:driver=>{if(!id(driver))throw Error('INVALID_DRIVER');return call('/v1/rideshare/drivers/'+driver+'/availability');},
  setAvailability:request=>call('/v1/rideshare/availability','POST',request),
  readOffers:driver=>{if(!id(driver))throw Error('INVALID_DRIVER');return call('/v1/rideshare/drivers/'+driver+'/offers');},
  respondOffer:(driver,request)=>{if(!id(driver))throw Error('INVALID_DRIVER');return call('/v1/rideshare/drivers/'+driver+'/offers/'+encodeURIComponent(request.offerId)+'/response','POST',request);}
 });
}
