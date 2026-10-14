// L01 Location is the sole route authority. No third-party geocoder or browser route estimate.
export function createLocationProviders(sessionProvider,{fetchImpl=fetch,origin=globalThis.location?.origin,geolocation=globalThis.navigator?.geolocation,search=null,resolveAddress=null}={}){
 if(!sessionProvider||typeof sessionProvider.getAccessToken!=='function'||!origin||typeof fetchImpl!=='function')return Object.freeze({search,resolveAddress});
 const geolocate=geolocation&&typeof geolocation.getCurrentPosition==='function'?()=>new Promise((resolve,reject)=>{
   geolocation.getCurrentPosition(position=>{
     if(!Number.isFinite(position.coords.latitude)||!Number.isFinite(position.coords.longitude))return reject(Error('invalid position'));
     resolve({label:'Current device location',latitude:position.coords.latitude,longitude:position.coords.longitude,precision:'approximate'});
   },()=>reject(Error('location denied')),{enableHighAccuracy:false,timeout:10000,maximumAge:0});
 }):undefined;
 const prepareRoute=async payload=>{
   const session=await sessionProvider.getSession?.();
   if(!session||session.status!=='authenticated'||!session.roles?.includes('rider')||
      typeof session.subject!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(session.subject))throw Error('No verified rider');
   const token=await sessionProvider.getAccessToken();
   if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('Session unavailable');
   const url=new URL('/v1/rideshare/routes',origin);
   if(url.origin!==origin)throw Error('Origin mismatch');
   // Command id prevents accidental replay of distinct route preparations.
   const commandId=globalThis.crypto?.randomUUID?.();
   if(!commandId)throw Error('Secure random unavailable');
   const response=await fetchImpl(url,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
     headers:{'authorization':'Bearer '+token,'content-type':'application/json'},
     body:JSON.stringify({riderId:session.subject,commandId,...payload})});
   if(!response.ok)throw Error('Route authority unavailable');
   return response.json();
 };
 return Object.freeze({search,resolveAddress,geolocate,prepareRoute});
}
