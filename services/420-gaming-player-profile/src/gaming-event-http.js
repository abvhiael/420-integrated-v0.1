// R05.6 scoped read-only HTTP gateway. Authenticated principal is never caller-supplied.
// High-risk operations remain authoritative on chain (R05.7), not via this projection.
import {createServer} from 'node:http';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const dec=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x);
export function createGamingEventHttp420({indexer,authority,gameId,origin}={}){
 if(typeof indexer?.query!=='function'||typeof authority?.verifyToken!=='function'||
  typeof authority?.registeredPrincipal!=='function'||typeof gameId!=='string'||
  !/^0x[0-9a-f]{64}$/.test(gameId)||typeof origin!=='string'||!/^https?:\/\//.test(origin))
  fail('events-http-configuration');
 return createServer(async(req,res)=>{
  const reject=(status,code)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff'});
   res.end(JSON.stringify({error:code}));
  };
  if(req.method!=='GET')return reject(405,'method-not-allowed');
  if(req.headers.origin&&req.headers.origin!==origin)return reject(403,'origin-denied');
  let url;
  try{url=new URL(req.url,origin);}catch{return reject(400,'invalid-request');}
  if(url.pathname!=='/events')return reject(404,'route-not-found');
  const names=[...url.searchParams.keys()];
  if(names.some(k=>!['limit','beforeBlock','beforeTxIndex','beforeLogIndex','beforeContract'].includes(k))||
   new Set(names).size!==names.length)return reject(400,'invalid-query');
  const auth=req.headers.authorization;
  if(typeof auth!=='string'||!/^Bearer [^\s]{1,8192}$/.test(auth))return reject(401,'unauthorized');
  const token=auth.slice(7);
  let before=null,limit=50;
  try{
   if(url.searchParams.has('limit')){
    const x=url.searchParams.get('limit');
    if(!dec(x)||Number(x)<1||Number(x)>100)throw Error('limit');
    limit=Number(x);
   }
   const fields=['beforeBlock','beforeTxIndex','beforeLogIndex','beforeContract'];
   if(fields.some(k=>url.searchParams.has(k))){
    if(!fields.every(k=>url.searchParams.has(k)))throw Error('partial cursor');
    before={blockNumber:url.searchParams.get('beforeBlock'),
     txIndex:url.searchParams.get('beforeTxIndex'),logIndex:url.searchParams.get('beforeLogIndex'),
     contract:url.searchParams.get('beforeContract')};
   }
  }catch{return reject(400,'invalid-query');}
  try{
   const claims=await authority.verifyToken(token);
   const accountId=await authority.registeredPrincipal(token);
   if(!accountId||accountId!==claims?.sub||claims.game!==gameId)
    return reject(403,'scope-denied');
   const events=await indexer.query({accountId,gameId,authority:token,limit,before});
   const fresh=await authority.verifyToken(token);
   const principal=await authority.registeredPrincipal(token);
   if(fresh?.sub!==accountId||fresh.game!==gameId||principal!==accountId)
    return reject(403,'session-revoked');
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff'});
   return res.end(JSON.stringify({events}));
  }catch{return reject(403,'scope-denied');}
 });
}
