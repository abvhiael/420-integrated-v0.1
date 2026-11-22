// Authenticated, wallet-free CCC multiplayer transport. Only the Go 420ID
// session verifier can sign requests. Direct browser access fails closed.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {makeRoom,startRoom,moveRoom,continueRoom,projectRoom,MatchError} from './room.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const keys=(obj,allowed)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).every(k=>allowed.includes(k));
const bodyHash=raw=>createHash('sha256').update(raw).digest('hex');
export function signature(key,{method,path,at,subject,name,raw}){
 return createHmac('sha256',key).update([method,path,at,subject,name,bodyHash(raw)].join('\n')).digest('base64url');
}
export function authenticate(req,raw,key,{now=Date.now()}={}){
 const subject=req.headers['x-chaos-subject'],at=req.headers['x-chaos-time'],
  name=req.headers['x-chaos-name'],signed=req.headers['x-chaos-signature'];
 if(!UUID.test(subject??'')||!(/^[0-9]{10}$/.test(at??''))||
  !(/^[A-Za-z0-9_-]{1,480}$/.test(name??''))||
  !(/^[A-Za-z0-9_-]{43}$/.test(signed??'')))throw new MatchError(401,'Verified 420ID session required');
 if(Math.abs(Math.floor(now/1000)-Number(at))>30)throw new MatchError(401,'Expired server authentication');
 const expected=signature(key,{method:req.method,path:req.url,at,subject,name,raw});
 if(!timingSafeEqual(Buffer.from(signed),Buffer.from(expected)))throw new MatchError(401,'Verified 420ID session required');
 const displayName=Buffer.from(name,'base64url').toString('utf8');
 if(Buffer.byteLength(displayName,'utf8')>320)throw new MatchError(401,'Untrusted name');
 return {subject,displayName};
}
const unpack=(raw,fields=[])=>{
 let data;
 try{data=JSON.parse(raw);}catch{throw new MatchError(400,'Invalid request JSON');}
 if(!keys(data,fields))throw new MatchError(400,'Unexpected request fields');
 return data;
};
const revision=x=>{
 if(!Number.isSafeInteger(x)||x<0)throw new MatchError(400,'Expected revision required');
 return x;
};
export async function handleChaos(req,{repo,key}){
 const path=req.url;
 if(typeof path!=='string'||path.includes('?')||path.includes('%')||path.includes('//')||path.includes('\\')||
  !path.startsWith('/v1/chaos/'))throw new MatchError(404,'Not found');
 if(!['GET','POST'].includes(req.method))throw new MatchError(405,'Unsupported method');
 const raw=req.body??'';
 if(typeof raw!=='string'||Buffer.byteLength(raw)>4096)throw new MatchError(413,'Request too large');
 if(req.method==='GET'&&raw)throw new MatchError(400,'GET body prohibited');
 if(req.method==='POST'&&req.headers['content-type']!=='application/json')throw new MatchError(415,'JSON required');
 const actor=authenticate(req,raw,key);
 if(path==='/v1/chaos/rooms'&&req.method==='GET')return {rooms:await repo.list(actor.subject),onChain:false};
 if(path==='/v1/chaos/rooms'&&req.method==='POST'){
  const data=unpack(raw,['humanSeats','bots','vehicle']);
  const room=await repo.create(makeRoom(actor.subject,actor.displayName,data));
  return {room:projectRoom(room,actor.subject),onChain:false};
 }
 if(path==='/v1/chaos/rooms/join'&&req.method==='POST'){
  const data=unpack(raw,['code']);
  return {room:await repo.join(actor.subject,data.code,actor.displayName),onChain:false};
 }
 const match=path.match(/^\/v1\/chaos\/rooms\/([a-f0-9-]{36})(?:\/(start|move|next|chat))?$/);
 if(!match||!UUID.test(match[1]))throw new MatchError(404,'Match not found');
 const id=match[1],action=match[2];
 if(!action&&req.method==='GET')return {room:projectRoom(await repo.get(id,actor.subject),actor.subject),onChain:false};
 if(req.method!=='POST'||!action)throw new MatchError(405,'Unsupported match operation');
 if(action==='chat'){
  const data=unpack(raw,['text']);
  return {room:projectRoom(await repo.chat(id,actor.subject,data.text),actor.subject),onChain:false};
 }
 const data=unpack(raw,action==='move'?['expectedRevision','move']:['expectedRevision']);
 const rev=revision(data.expectedRevision);
 let room;
 if(action==='start')room=await repo.mutate(id,actor.subject,rev,r=>startRoom(r,actor.subject));
 else if(action==='move')room=await repo.mutate(id,actor.subject,rev,r=>moveRoom(r,actor.subject,data.move));
 else if(action==='next')room=await repo.mutate(id,actor.subject,rev,r=>continueRoom(r,actor.subject));
 else throw new MatchError(404,'Match operation unavailable');
 return {room:projectRoom(room,actor.subject),onChain:false};
}
export function createChaosServer({repo,key}){
 if(!repo||!Buffer.isBuffer(key)||key.length!==32)throw new Error('Game backend needs a 256-bit proxy secret');
 return createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'");
  res.setHeader('Access-Control-Allow-Origin','');
  if(req.url==='/healthz'&&req.method==='GET'){
   try{await repo.pool.query('SELECT 1');res.writeHead(200);res.end('{"ready":true}');}
   catch{res.writeHead(503);res.end('{"ready":false}');}
   return;
  }
  let raw='';
  try{
   for await(const part of req){
    raw+=part.toString('utf8');
    if(Buffer.byteLength(raw,'utf8')>4096)throw new MatchError(413,'Request too large');
   }
   const data=await handleChaos({method:req.method,url:req.url,headers:req.headers,body:raw},{repo,key});
   res.writeHead(req.method==='POST'&&req.url==='/v1/chaos/rooms'?201:200);
   res.end(JSON.stringify(data));
  }catch(e){
   const status=e instanceof MatchError?e.status:503;
   res.writeHead(status);
   res.end(JSON.stringify({error:status===503?'Game service temporarily unavailable':e.message}));
  }
 });
}
