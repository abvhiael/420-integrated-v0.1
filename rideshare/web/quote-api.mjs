// Client is transport-only; canonical L01 signed-session Quote and Trip services enforce authority.
export function createQuoteApi(sessionProvider,{origin=globalThis.location?.origin,fetchImpl=fetch}={}){
 if(!sessionProvider||typeof sessionProvider.getSession!=='function'||typeof sessionProvider.getAccessToken!=='function'||!origin||typeof fetchImpl!=='function')return null;
 async function send(path,body){
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('Session unavailable');
  const url=new URL(path,origin);if(url.origin!==origin)throw Error('Invalid origin');
  const result=await fetchImpl(url,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!result.ok)throw Error('Server rejected request '+result.status);
  return result.json();
 }
 const uid=()=>{const value=globalThis.crypto?.randomUUID?.();if(!value)throw Error('Secure ID unavailable');return value;};
 return Object.freeze({
  issue:async(route)=>{
   const session=await sessionProvider.getSession();
   if(session.status!=='authenticated'||!session.roles?.includes('rider')||typeof session.subject!=='string')throw Error('Not authorized');
   return send('/v1/rideshare/quotes',{riderId:session.subject,routeRef:route.routeRef,commandId:uid()});
  },
  accept:(q,request)=>send('/v1/rideshare/quotes/'+encodeURIComponent(q.quoteId)+'/consent',request),
  createTrip:body=>send('/v1/rideshare/trips',body)
 });
}
