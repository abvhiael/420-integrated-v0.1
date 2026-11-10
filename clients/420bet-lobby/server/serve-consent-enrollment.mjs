// Private Node enrollment backend. The public site must use a qualified TLS
// reverse proxy with rate limiting and an edge secret, never expose this port.
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createPublicClient,http} from 'viem';
import {createWalletSignatureVerifier} from './wallet-signature-verifier.mjs';
import {createPrivateOwnerDirectories} from './ownership-directories.mjs';
import {createBetConsentEnrollmentBroker,createGoConsentCommit} from './consent-enrollment-broker.mjs';
const need=name=>{const s=process.env[name];if(!s)throw Error('420Bet consent enrollment: missing '+name);return s;};
const env=process.env;
const chainId=need('BET_CONSENT_CHAIN_ID');
const rpc=need('BET_CONSENT_RPC_URL');
const origin=need('BET_CONSENT_ENROLL_ORIGIN');
const edge=need('BET_CONSENT_EDGE_TOKEN');
if(edge.length<32)throw Error('enrollment requires private edge credential');
const wallet=createWalletSignatureVerifier({
 publicClient:createPublicClient({transport:http(rpc,{retryCount:0,timeout:9000})}),chainId});
const directory=createPrivateOwnerDirectories({
 chainId,identityOrigin:need('BET_IDENTITY_AUTHORITY_URL'),
 identityToken:need('BET_IDENTITY_AUTHORITY_TOKEN'),
 consentOrigin:need('BET_NOTIFICATIONS_CONSENT_URL'),
 consentToken:need('BET_NOTIFICATIONS_CONSENT_TOKEN')
});
const broker=createBetConsentEnrollmentBroker({
 origin,chainId,challengeKey:need('BET_CONSENT_CHALLENGE_KEY'),
 assertionKey:need('BET_CONSENT_BROKER_KEY'),
 verifySignature:wallet,resolveSubject:directory.resolveIdentity,
 commit:createGoConsentCommit({origin:need('BET_NOTIFICATIONS_CONSENT_URL'),
  bearerToken:need('BET_CONSENT_BROKER_TOKEN')})
});
const windows=new Map();
function withinLimit(key){
 const now=Date.now(),period=60000;
 if(windows.size>10000)for(const [k,v] of windows)if(v.at+period<now)windows.delete(k);
 if(windows.size>10000&&!windows.has(key))return false;
 const old=windows.get(key);
 if(!old||old.at+period<now){windows.set(key,{at:now,count:1});return true;}
 old.count++;return old.count<=20;
}
const send=(res,status,result)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(result));};
const server=createServer((req,res)=>{void (async()=>{
 const supplied=req.headers['x-bet-edge-secret'];
 if(typeof supplied!=='string'||supplied.length!==edge.length||
  !timingSafeEqual(Buffer.from(supplied),Buffer.from(edge))){
  send(res,403,{error:'access_denied'});return;
 }
 if(req.headers.origin!==origin.replace(/\/$/,'')||
  !withinLimit(typeof req.headers['x-bet-client-ip']==='string'?
   req.headers['x-bet-client-ip']:'unknown')){
  send(res,429,{error:'origin_or_rate_limit_denied'});return;
 }
 if(req.method!=='POST'||!['/v1/420bet/consent/challenge',
  '/v1/420bet/consent/confirm'].includes(req.url)){
  send(res,404,{error:'not_found'});return;
 }
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')){
  send(res,415,{error:'json_required'});return;
 }
 const parts=[];let size=0;
 try{
  for await(const part of req){size+=part.length;
   if(size>8192)throw Error('oversized request');parts.push(part);}
  const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
  const result=req.url.endsWith('/challenge')?broker.challenge(body):
   await broker.confirm(body);
  send(res,200,result);
 }catch{send(res,409,{error:'consent_proof_not_verified'});}
 })().catch(()=>{if(!res.headersSent)send(res,503,{error:'enrollment_unavailable'});});});
const host=env.BET_CONSENT_BIND_HOST??'127.0.0.1',port=Number(env.BET_CONSENT_BIND_PORT??8451);
if(!['127.0.0.1','::1'].includes(host)||!Number.isInteger(port)||port<1||port>65535)
 throw Error('private loopback consent listener required');
server.listen(port,host,()=>console.log(JSON.stringify({service:'420Bet consent enrollment',ready:true,
 listener:'loopback',chainId})));
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>server.close());
