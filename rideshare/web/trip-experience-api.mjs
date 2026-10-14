// Ephemeral bearer transport only: L01 trip and safety APIs enforce participant scope.
export function createTripExperienceApi(sessionProvider,{fetchImpl=fetch,origin=globalThis.location?.origin}={}){
 if(!sessionProvider||typeof sessionProvider.getAccessToken!=='function'||!origin||typeof fetchImpl!=='function')return null;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 async function send(path,method='GET',body){
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('Session unavailable');
  const url=new URL(path,origin);if(url.origin!==origin)throw Error('Origin mismatch');
  const res=await fetchImpl(url,{method,credentials:'omit',cache:'no-store',redirect:'error',
   headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!res.ok)throw Error('Authoritative trip endpoint rejected '+res.status);
  return res.json();
 }
 return Object.freeze({
  read:idValue=>{if(!id(idValue))throw Error('Invalid trip');return send('/v1/rideshare/trips/'+idValue);},
  cancel:(idValue,revision,commandId)=>{if(!id(idValue)||!id(commandId)||!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid cancellation');
   return send('/v1/rideshare/trips/'+idValue+'/transitions','POST',{action:'cancel',expectedRevision:revision,commandId});},
  report:(idValue,category,commandId)=>{if(!id(idValue)||!id(commandId)||!['medical','collision','threat','vehicle','other'].includes(category))throw Error('Invalid incident');
   return send('/v1/rideshare/trips/'+idValue+'/safety/report','POST',{category,commandId});}
 });
}
