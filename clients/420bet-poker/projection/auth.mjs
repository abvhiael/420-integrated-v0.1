// Read-only EIP-191 wallet challenge/response session issuer.
// Cannot grant betting permissions; credentials are host-only secure cookies.
import {randomBytes,createHmac} from 'node:crypto';
import {verifyMessage} from 'viem';
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const NONCE=/^[A-Za-z0-9_-]{40,60}$/;
const noStore={'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','Pragma':'no-cache',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const challengeMs=120000,sessionMs=1800000;
export function createPokerWalletAuth({origin,chainId,secret,clock=()=>Date.now(),
 verifySignature=verifyMessage}={}){
 if(typeof origin!=='string'||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(origin)||
 !Number.isSafeInteger(chainId)||chainId<1||!Buffer.isBuffer(secret)||secret.length<32)
 throw Error('Incomplete trusted poker wallet auth configuration');
 const pending=new Map();
 const attempts=new Map();
 function rateLimit(id){
  const now=clock();const p=attempts.get(id)||{start:now,count:0};
  if(now-p.start>60000){p.start=now;p.count=0;}
  if(++p.count>10)throw Error('rate limited');
  attempts.set(id,p);
  if(attempts.size>3000)attempts.clear();
 }
 function challengeMessage({address,nonce,issuedAt,expiresAt}){
  return [
   origin.replace('https://','')+' requests a read-only 420Bet poker session:',
   address,'','URI: '+origin+'/api/420bet/poker/v1',
   'Version: 1','Chain ID: '+chainId,'Nonce: '+nonce,
   'Issued At: '+new Date(issuedAt).toISOString(),
   'Expiration Time: '+new Date(expiresAt).toISOString(),
   'Statement: Read-only poker tables; no wagers, signing of actions, or withdrawals.'
  ].join('\n');
 }
 async function readBody(req){
  const chunks=[];let len=0;
  for await(const part of req){
   len+=part.length;
   if(len>2048)throw Error('body too large');
   chunks.push(part);
  }
  const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('invalid JSON request');
  return obj;
 }
 const send=(res,code,payload,cookie)=>{res.writeHead(code,{...noStore,...(cookie?{'Set-Cookie':cookie}:{})});res.end(JSON.stringify(payload));};
 async function handle(req,res){
  if(req.method!=='POST')return send(res,405,{error:'method not allowed'});
  if(req.headers?.origin!==origin||req.headers?.['sec-fetch-site']==='cross-site')
   return send(res,403,{error:'origin denied'});
  if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')
   return send(res,415,{error:'JSON required'});
  try{
   const body=await readBody(req);
   if(req.url==='/api/420bet/poker/v1/auth/challenge'){
    if(typeof body.address!=='string'||!ADDRESS.test(body.address)||body.chainId!==chainId)
     throw Error('invalid wallet challenge');
    rateLimit('challenge:'+String(req.socket?.remoteAddress||'unknown'));
    for(const [n,c]of pending)if(c.expiresAt<=clock())pending.delete(n);
    if(pending.size>=500)throw Error('too many pending login challenges');
    const address=body.address.toLowerCase();
    const nonce=randomBytes(32).toString('base64url');
    const issuedAt=clock(),expiresAt=issuedAt+challengeMs;
    const state={address,nonce,issuedAt,expiresAt};
    pending.set(nonce,state);
    return send(res,200,{message:challengeMessage(state),nonce,chainId,expiresAt});
   }
   if(req.url==='/api/420bet/poker/v1/auth/verify'){
    const nonce=body.nonce;
    if(typeof nonce!=='string'||!NONCE.test(nonce))throw Error('invalid challenge');
    rateLimit('verify:'+String(req.socket?.remoteAddress||'unknown'));
    const state=pending.get(nonce);
    pending.delete(nonce); // single-use EVEN on failed signature
    if(!state||state.expiresAt<=clock()||typeof body.signature!=='string'||
      !/^0x[a-fA-F0-9]{130,}$/.test(body.signature))throw Error('invalid or expired challenge');
    const ok=await verifySignature({address:state.address,message:challengeMessage(state),signature:body.signature});
    if(!ok)throw Error('invalid wallet signature');
    const now=clock();const viewerId=state.address.slice(2),claims={
     iss:'420bet-poker-auth-v1',subject:state.address,viewerId,chainId,
     scope:'poker:read',issuedAt:now,expiresAt:now+sessionMs
    };
    const token=Buffer.from(JSON.stringify(claims)).toString('base64url');
    const digest=createHmac('sha256',secret).update(token).digest('base64url');
    const cookie='__Host-poker_session='+token+'.'+digest+
      '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.floor(sessionMs/1000);
    return send(res,200,{authenticated:true,scope:'poker:read',chainId,expiresAt:claims.expiresAt},cookie);
   }
   return send(res,404,{error:'not found'});
  }catch{
   return send(res,403,{error:'wallet authentication rejected'});
  }
 }
 return Object.freeze({handle,challengeMessage});
}
