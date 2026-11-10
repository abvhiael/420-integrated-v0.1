// User-authorized 420Bet consent enrollment broker, never a browser-owned
// consent verdict. EIP-191/EIP-1271 signature + independent 420Identity binding
// are mandatory before a private, HMAC-bound commit to the Go consent ledger.
import {randomBytes,createHmac,createHash,timingSafeEqual} from 'node:crypto';
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ACCOUNT=/^0x[0-9a-fA-F]{40}$/;
const TOKEN=/^[A-Za-z0-9._~+/-]{32,4096}$/;
const check=(yes,why)=>{if(!yes)throw Error('420Bet consent enrollment: '+why);};
const hmac=(key,message)=>createHmac('sha256',key).update(message,'utf8').digest('hex');
const digest=s=>createHash('sha256').update(s).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const lines=(p)=>['420BET-CONSENT-BROKER-V1',p.action,p.tenant,p.userId,p.subscriptionId,
 p.recipient,p.channel,p.policyVersion,p.nonce,String(p.expiresAt),
 String(p.expectedRevision)].join('\n');
const message=p=>['420Bet Notification Consent','Action: '+p.action,
 'Origin: '+p.origin,'Chain: '+p.chainId,'Account: '+p.account,
 'Subscription: '+p.subscriptionId,'Channel: '+p.channel,
 'Route: '+p.recipient,'Policy version: '+p.policyVersion,
 'Expected revision: '+p.expectedRevision,'Nonce: '+p.nonce,
 'Expires: '+p.expiresAt,
 'Signing only controls 420Bet notifications; it does not authorize wagering or payments.'].join('\n');
export function createBetConsentEnrollmentBroker({
 origin,chainId,challengeKey,assertionKey,verifySignature,resolveSubject,
 commit,now=Date.now,random=()=>randomBytes(32).toString('hex')
}={}){
 const u=new URL(origin);
 check(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&
  u.pathname==='/'&&u.hostname,'approved HTTPS origin required');
 check(typeof chainId==='string'&&/^[1-9][0-9]*$/.test(chainId),'chain required');
 check(TOKEN.test(challengeKey)&&TOKEN.test(assertionKey)&&challengeKey!==assertionKey,
  'separate challenge and broker keys required');
 check(typeof verifySignature==='function'&&typeof resolveSubject==='function'&&
  typeof commit==='function','qualified wallet, Identity and Go commit providers required');
 function scoped(raw){
  check(raw&&typeof raw==='object'&&!Array.isArray(raw),'scope required');
  check(raw.tenant==='420bet'&&['enroll','revoke'].includes(raw.action)&&
   ACCOUNT.test(raw.account)&&ID.test(raw.subscriptionId)&&ID.test(raw.recipient)&&
   ID.test(raw.policyVersion)&&['mail','notifications'].includes(raw.channel)&&
   Number.isSafeInteger(raw.expectedRevision)&&raw.expectedRevision>=0,
   'invalid subscription or wallet scope');
  return {tenant:'420bet',action:raw.action,account:raw.account.toLowerCase(),
   chainId,origin:u.origin,subscriptionId:raw.subscriptionId,
   recipient:raw.recipient,channel:raw.channel,policyVersion:raw.policyVersion,
   expectedRevision:raw.expectedRevision};
 }
 function challenge(raw){
  const s=scoped(raw);
  const nonce=random();
  check(/^[a-f0-9]{64}$/.test(nonce),'cryptographic nonce required');
  const payload={...s,nonce,expiresAt:now()+90000};
  const walletMessage=message(payload);
  return Object.freeze({challenge:payload,signature:hmac(challengeKey,walletMessage),
   message:walletMessage});
 }
 async function confirm({challenge:claim,signature:challengeSignature,walletSignature}={}){
  const s=scoped(claim);
  const p={...s,nonce:claim.nonce,expiresAt:claim.expiresAt};
  check(/^[a-f0-9]{64}$/.test(p.nonce)&&Number.isSafeInteger(p.expiresAt)&&
   p.expiresAt>now()&&p.expiresAt<=now()+90000,'challenge expired or invalid');
  const walletMessage=message(p);
  check(same(hmac(challengeKey,walletMessage),challengeSignature),
   'challenge was not issued by trusted server');
  check((await verifySignature({account:p.account,chainId,message:walletMessage,
   signature:walletSignature}))===true,'wallet owner did not authorize');
  const identity=await resolveSubject({account:p.account,chainId,mode:'read-only'});
  check(identity?.verified===true&&identity?.active===true&&
   identity.account?.toLowerCase()===p.account&&
   typeof identity.userId==='string'&&ID.test(identity.userId),
   'independent 420Identity binding unavailable');
  const assertion={action:p.action,tenant:p.tenant,userId:identity.userId,
   subscriptionId:p.subscriptionId,recipient:p.recipient,channel:p.channel,
   policyVersion:p.policyVersion,nonce:digest(p.nonce),expiresAt:p.expiresAt,
   expectedRevision:p.expectedRevision};
  return commit({...assertion,signature:hmac(assertionKey,lines(assertion))});
 }
 return Object.freeze({challenge,confirm});
}
export function createGoConsentCommit({origin,bearerToken,fetcher=fetch}={}){
 const url=new URL(origin);
 check(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&
  url.pathname==='/'&&TOKEN.test(bearerToken),'private HTTPS Go endpoint required');
 return async assertion=>{
  const result=await fetcher(url.origin+'/v1/420bet/enrollments/commit',{
   method:'POST',cache:'no-store',redirect:'error',credentials:'omit',
   headers:{Authorization:'Bearer '+bearerToken,
    Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify(assertion),signal:AbortSignal.timeout(8000)});
  check(result?.ok,'Go consent verification rejected enrollment');
  const raw=await result.text();check(raw.length<=8192,'oversized consent receipt');
  const data=JSON.parse(raw);
  check(data.tenant===assertion.tenant&&data.userId===assertion.userId&&
   data.subscriptionId===assertion.subscriptionId&&
   data.recipient===assertion.recipient&&data.channel===assertion.channel&&
   data.policyVersion===assertion.policyVersion&&
   data.revision===assertion.expectedRevision+1&&
   data.revoked===(assertion.action==='revoke')&&
   data.consent===(assertion.action==='enroll'),'Go consent receipt not bound');
  return Object.freeze({revision:data.revision,active:data.active,
   revoked:data.revoked,consent:data.consent});
 };
}
