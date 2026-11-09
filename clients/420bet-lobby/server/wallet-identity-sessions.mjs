// BET-AUDIT-7 — explicit wallet authentication boundary, not a wager capability.
// A qualified Ethereum signature verifier and canonical Identity provider are REQUIRED;
// provider connection / wallet address alone NEVER authenticates a player.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {normalizeAccount} from '../src/wallet.js';
const CHAIN=/^[1-9][0-9]*$/,TOKEN=/^[0-9a-f]{64}$/;
function check(ok,why){if(!ok)throw Error(why);}
function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export function createBetWalletSessions({
 origin,chainId,verifySignature,verifyIdentity,clock=()=>Date.now(),
 challengeTtlMs=120000,sessionTtlMs=900000
}={}){
 const url=new URL(origin);
 check(url.origin===origin&&!url.username&&!url.password&&
  (url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))),
 'invalid session origin');
 check(typeof chainId==='string'&&CHAIN.test(chainId),'invalid chain scope');
 check(typeof verifySignature==='function'&&typeof verifyIdentity==='function','qualified verification providers required');
 check(Number.isSafeInteger(challengeTtlMs)&&challengeTtlMs>=1000&&challengeTtlMs<=300000,'invalid challenge TTL');
 check(Number.isSafeInteger(sessionTtlMs)&&sessionTtlMs>=1000&&sessionTtlMs<=3600000,'invalid session TTL');
 const challenges=new Map(),sessions=new Map();
 let epoch=0;
 function nonce(){return randomBytes(32).toString('hex');}
 function now(){const n=clock();check(Number.isSafeInteger(n)&&n>=0,'invalid time');return n;}
 function clean(t){
  for(const [k,v] of challenges)if(v.expiresAt<=t||v.used)challenges.delete(k);
  for(const [k,v] of sessions)if(v.expiresAt<=t)sessions.delete(k);
 }
 function scope(account,requestedChainId){
  const a=normalizeAccount(account);
  check(a&&requestedChainId===chainId,'wallet identity scope denied');
  return a;
 }
 function challenge({account,requestedChainId}){
  const a=scope(account,requestedChainId),t=now();clean(t);
  check(challenges.size<10000,'challenge capacity exceeded');
  const id=nonce(),expiresAt=t+challengeTtlMs;
  // Fixed, human-readable domain-specific string: no broad login or transaction authority.
  const message=`420Bet read-only session\nOrigin: ${origin}\nAccount: ${a}\nChain ID: ${chainId}\nNonce: ${id}\nIssued At (ms): ${t}\nExpires At (ms): ${expiresAt}\nNo wagering, signing delegation or spending authority is granted.`;
  challenges.set(id,{account:a,message,expiresAt,used:false,epoch});
  return {nonce:id,message,expiresAt};
 }
 async function authenticate({account,requestedChainId,nonce:challengeId,signature}){
  const a=scope(account,requestedChainId),t=now();clean(t);
  check(typeof challengeId==='string'&&TOKEN.test(challengeId)&&typeof signature==='string'&&
   /^0x(?:[0-9a-fA-F]{2}){1,4096}$/.test(signature),'invalid challenge response');
  const c=challenges.get(challengeId);
  check(c&&c.account===a&&c.expiresAt>t&&c.epoch===epoch&&!c.used,'challenge expired or replayed');
  c.used=true;challenges.delete(challengeId); // Consume BEFORE the async verifier.
  const signed=await verifySignature({account:a,chainId,message:c.message,signature});
  check(signed===true,'signature not verified');
  const policy=await verifyIdentity({account:a,chainId,mode:'read-only'});
  check(policy?.authorized===true&&policy?.revoked===false&&
    typeof policy.authorizationVersion==='string'&&policy.authorizationVersion.length>0,
    'canonical identity denied');
  check(c.epoch===epoch&&c.expiresAt>now(),'challenge revoked during verification');
  clean(now());check(sessions.size<10000,'session capacity exceeded');
  const key=nonce(),expiresAt=Math.min(t+sessionTtlMs,Number.isSafeInteger(policy.expiresAt)?policy.expiresAt:t+sessionTtlMs);
  check(expiresAt>now(),'identity expired');
  sessions.set(key,{account:a,chainId,version:policy.authorizationVersion,expiresAt,epoch});
  return {token:key,expiresAt,account:a,chainId};
 }
 async function authorize({token,account,requestedChainId}){
  const a=scope(account,requestedChainId),t=now();clean(t);
  check(typeof token==='string'&&TOKEN.test(token),'invalid session');
  const stored=sessions.get(token);
  check(stored&&stored.account===a&&stored.chainId===chainId&&stored.expiresAt>t&&stored.epoch===epoch,'invalid or expired session');
  const policy=await verifyIdentity({account:a,chainId,mode:'read-only'});
  check(policy?.authorized===true&&policy?.revoked===false&&
    policy.authorizationVersion===stored.version&&
    (!Number.isSafeInteger(policy.expiresAt)||policy.expiresAt>now()),'identity revoked or changed');
  check(sessions.get(token)===stored&&stored.epoch===epoch&&stored.expiresAt>now(),'session revoked during verification');
  return Object.freeze({account:a,chainId,expiresAt:stored.expiresAt,readOnly:true});
 }
 function revoke({token,account,requestedChainId}){
  const a=scope(account,requestedChainId),stored=sessions.get(token);
  if(stored&&stored.account===a&&stored.chainId===chainId)sessions.delete(token);
 }
 function revokeAll(){epoch++;challenges.clear();sessions.clear();}
 return Object.freeze({challenge,authenticate,authorize,revoke,revokeAll});
}
