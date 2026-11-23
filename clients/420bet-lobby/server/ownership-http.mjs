// Authenticated, server-only 420Bet ownership HTTP endpoint.
// Request bodies carry ONLY exact finalized event identities.
// Subject and subscriptions are looked up from independent private services.
import {timingSafeEqual} from 'node:crypto';

const demand=(v,m)=>{if(!v)throw Error('420Bet ownership HTTP: '+m);};
const TOKEN=/^[A-Za-z0-9._~+/-]{32,4096}$/;
export function createOwnershipHTTPHandler({authority,bearerToken,maxConcurrent=8}={}){
 demand(typeof authority?.resolve==='function','canonical resolver required');
 demand(typeof bearerToken==='string'&&TOKEN.test(bearerToken),
  'private service credential required');
 demand(Number.isInteger(maxConcurrent)&&maxConcurrent>=1&&maxConcurrent<=64,
  'invalid concurrency limit');
 const secret=Buffer.from('Bearer '+bearerToken),MAX_BODY=8192;
 let inFlight=0;
 return async function handle(req,res){
  function send(status,value){
   res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'});
   res.end(JSON.stringify(value));
  }
  if(req.method!=='POST'||req.url!=='/v1/420bet/ownership/resolve'){
   send(404,{error:'not_found'});return;
  }
  const given=Buffer.from(req.headers.authorization??'');
  if(given.length!==secret.length||!timingSafeEqual(given,secret)){
   send(403,{error:'access_denied'});return;
  }
  if(inFlight>=maxConcurrent){send(503,{error:'authority_busy'});return;}
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')){
   send(415,{error:'json_required'});return;
  }
  inFlight++;
  try{
   const parts=[];let size=0;
   for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY)throw Error('oversized');
    parts.push(chunk);
   }
   const raw=Buffer.concat(parts).toString('utf8');
   demand(raw.length>0&&raw.length<=MAX_BODY,'invalid payload length');
   const event=JSON.parse(raw);
   const answer=await authority.resolve(event);
   send(200,answer);
  }catch{
   // Never expose private account, subscription, source or RPC details in errors.
   send(503,{error:'ownership_not_verified'});
  }finally{inFlight--;}
 };
}
