export function createDriverOnboardingApi(sessionProvider,{origin=globalThis.location?.origin,fetchImpl=fetch}={}){
 if(!sessionProvider||typeof sessionProvider.getAccessToken!=='function'||typeof fetchImpl!=='function'||!origin)return null;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 async function request(driverId,body){
  if(!id(driverId))throw Error('Invalid driver');
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid session');
  const url=new URL('/v1/rideshare/drivers/'+driverId+'/onboarding',origin);
  if(url.origin!==origin)throw Error('Invalid origin');
  const r=await fetchImpl(url,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error('Onboarding request unavailable');return r.json();
 }
 return Object.freeze({read:d=>request(d),submit:(d,body)=>request(d,body)});
}
