// Versioned LIFTd HTTP consumer. Authenticated calls are authorized again by the server.
// This module must be constructed explicitly with an approved HTTPS base URL and a native token provider.
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function createRiderApi({origin,accessToken,fetchImpl=fetch,timeoutMs=8000}){
 let base;try{base=new URL(origin);}catch{throw Error('UNAPPROVED_ENDPOINT');}
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||typeof accessToken!=='function'||typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>10000)throw Error('UNAPPROVED_ENDPOINT');
 async function send(path,method,body){
  const token=await accessToken();
  if(typeof token!=='string'||token.length>32768||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token))throw Error('SESSION_UNAVAILABLE');
  const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith('/v1/rideshare/'))throw Error('ENDPOINT_DENIED');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
   const res=await fetchImpl(url.href,{method,redirect:'error',cache:'no-store',credentials:'omit',signal:abort.signal,
    headers:{authorization:'Bearer '+token,accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(!res.ok||res.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw Error('SERVICE_UNAVAILABLE');
   const raw=await res.text();if(raw.length>65536)throw Error('RESPONSE_TOO_LARGE');return JSON.parse(raw);
  }finally{clearTimeout(timer);}
 }
 const requireId=x=>{if(!valid(x))throw Error('INVALID_IDENTIFIER');return x;};
 return Object.freeze({
  prepareRoute:(s,route,commandId)=>send('/v1/rideshare/routes','POST',{riderId:requireId(s.subject),commandId:requireId(commandId),...route}),
  issueQuote:(s,route,commandId)=>send('/v1/rideshare/quotes','POST',{riderId:requireId(s.subject),routeRef:requireId(route.routeRef),commandId:requireId(commandId)}),
  consent:(s,q,request)=>send('/v1/rideshare/quotes/'+requireId(q.quoteId)+'/consent','POST',request),
  requestTrip:(s,body)=>send('/v1/rideshare/trips','POST',{...body,riderId:requireId(s.subject)}),
  readTrip:(s,id)=>send('/v1/rideshare/trips/'+requireId(id),'GET'),
  cancelTrip:(s,id,commandId,revision)=>send('/v1/rideshare/trips/'+requireId(id)+'/transitions','POST',{action:'cancel',expectedRevision:revision,commandId:requireId(commandId)}),
  reportSafety:(s,{tripId,details,commandId})=>send('/v1/rideshare/trips/'+requireId(tripId)+'/safety/report','POST',{category:'other',details,commandId:requireId(commandId)}),
  savePreferences:async(s,preferences)=>{const res=await send('/v1/rideshare/riders/'+requireId(s.accountId)+'/preferences','PUT',{preferences});return res.preferences??res;}
 });
}
