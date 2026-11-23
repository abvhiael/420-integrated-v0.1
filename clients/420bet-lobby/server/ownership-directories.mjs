// Private Identity and Notifications directories for the canonical owner engine.
// No client-supplied subject, subscriptions or recipient is accepted.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const TOKEN=/^[A-Za-z0-9._~+/-]{32,4096}$/;
const demand=(ok,m)=>{if(!ok)throw Error('420Bet owner directory: '+m);};
function endpoint(raw){
 const u=new URL(raw);
 demand(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
  u.pathname==='/'&&u.hostname,'approved private HTTPS root required');
 return u.origin;
}
export function createPrivateOwnerDirectories({
 chainId,identityOrigin,identityToken,consentOrigin,consentToken,
 fetcher=fetch,timeoutMs=8000
}={}){
 demand(typeof chainId==='string'&&/^[1-9][0-9]*$/.test(chainId),'invalid chain');
 const identity=endpoint(identityOrigin),consent=endpoint(consentOrigin);
 demand(TOKEN.test(identityToken)&&TOKEN.test(consentToken),'private service credentials required');
 demand(Number.isInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 async function post(origin,path,token,body){
  const result=await fetcher(origin+path,{method:'POST',credentials:'omit',cache:'no-store',
   redirect:'error',headers:{Authorization:'Bearer '+token,
    Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
  demand(result?.ok,'private directory unavailable');
  const raw=await result.text();
  demand(raw.length<=16384,'oversized private directory response');
  return JSON.parse(raw);
 }
 async function resolveIdentity({account,chainId:requestedChain,subject=null}){
  demand(requestedChain===chainId&&ADDRESS.test(account),'unapproved account scope');
  const wallet=account.toLowerCase();
  const r=await post(identity,'/v1/wallet-subject',identityToken,{account:wallet,chainId});
  demand(r?.account===wallet&&r.chainId===chainId&&r.revoked===false&&
   HASH.test(r.subjectId),'unverified subject binding');
  const id=r.subjectId.toLowerCase();
  demand(subject===null||id===subject,'fantasy subject is not bound to beneficiary');
  return Object.freeze({verified:true,active:true,account:wallet,userId:id,subject:id});
 }
 async function subscriptions({tenant,userId}){
  demand(tenant==='420bet'&&ID.test(userId),'unapproved subject audience');
  const r=await post(consent,'/v1/420bet/subscriptions/audience',consentToken,
   {tenant,userId});
  demand(Array.isArray(r?.subscriptions)&&r.subscriptions.length<=16,
   'unqualified subscription enumeration');
  return Object.freeze(r.subscriptions.map(s=>{
   demand(s.tenant===tenant&&s.userId===userId&&ID.test(s.subscriptionId)&&
    ID.test(s.recipient)&&ID.test(s.policyVersion)&&
    ['mail','notifications'].includes(s.channel)&&
    s.active===true&&s.consent===true&&!s.muted&&!s.revoked,
    'invalid audience subscription');
   return Object.freeze({tenant,userId,id:s.subscriptionId,channel:s.channel,
    recipient:s.recipient,policyVersion:s.policyVersion,
    active:true,consent:true,muted:false,revoked:false});
  }));
 }
 return Object.freeze({resolveIdentity,subscriptions});
}
