// Explicitly configured transport for official LIFTd Pay and Messenger endpoints.
// Never constructs transaction calldata, payment receipts, Messenger grants, or push content.
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
export function createMobileServiceApi({approvedOrigin,tokenProvider,fetchImpl=fetch}){
 let base;try{base=new URL(approvedOrigin);}catch{throw Error('UNAPPROVED_ORIGIN');}
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||typeof tokenProvider!=='function'||typeof fetchImpl!=='function')throw Error('UNAPPROVED_ORIGIN');
 const requireId=v=>{if(!id(v))throw Error('INVALID_IDENTIFIER');return v;};
 async function send(path,method='GET',body){
  const token=await tokenProvider();
  if(typeof token!=='string'||token.length>32768||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token))throw Error('SESSION_UNAVAILABLE');
  const url=new URL(path,base);
  if(url.origin!==base.origin||!url.pathname.startsWith('/v1/rideshare/'))throw Error('ENDPOINT_DENIED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const res=await fetchImpl(url.href,{method,signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',
   headers:{authorization:'Bearer '+token,accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(!res.ok||res.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw Error('SERVICE_UNAVAILABLE');
   const text=await res.text();if(text.length>65536)throw Error('SERVICE_RESPONSE_TOO_LARGE');return JSON.parse(text);
  }finally{clearTimeout(timer);}
 }
 return Object.freeze({
  preparePayment:(_s,tripId,request)=>send('/v1/rideshare/trips/'+requireId(tripId)+'/payments/prepare','POST',request),
  readPayment:(_s,tripId)=>send('/v1/rideshare/trips/'+requireId(tripId)+'/payments'),
  readMessages:(_s,tripId)=>send('/v1/rideshare/trips/'+requireId(tripId)+'/messages'),
  sendMessage:(_s,tripId,request)=>send('/v1/rideshare/trips/'+requireId(tripId)+'/messages','POST',request)
 });
}
