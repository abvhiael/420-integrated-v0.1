// BET-AUDIT-7 provider adapter. The configured HTTPS service is an independently
// operated subject-binding and eligibility authority, never a browser verdict.
import {normalizeAccount} from '../src/wallet.js';
const HEX32=/^0x[0-9a-fA-F]{64}$/;
const CHAIN=/^[1-9][0-9]*$/;
const validUrl=raw=>{
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
  url.pathname!=='/'||!url.hostname)throw Error('identity authority requires root HTTPS origin');
 return url.origin;
};
const ensure=(ok,msg)=>{if(!ok)throw Error(msg);};
export function createRemoteBetIdentityAuthority({
 origin, bearerToken,chainId,policyVersion,policyApprovalDigest,fetcher=fetch,timeoutMs=8000
}={}){
 const base=validUrl(origin);
 ensure(typeof bearerToken==='string'&&bearerToken.length>=32&&bearerToken.length<=4096&&
  /^[A-Za-z0-9._~+/-]+$/.test(bearerToken),'invalid identity authority secret');
 ensure(typeof chainId==='string'&&CHAIN.test(chainId),'invalid authority chain');
 ensure(typeof policyVersion==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(policyVersion),
  'approved policy version required');
 ensure(typeof policyApprovalDigest==='string'&&/^0x[0-9a-fA-F]{64}$/.test(policyApprovalDigest)&&
  !/^0x0{64}$/.test(policyApprovalDigest),'independently approved policy digest required');
 ensure(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid provider timeout');
 async function post(path,params){
  const response=await fetcher(base+path,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
   headers:{Accept:'application/json','Content-Type':'application/json',
    Authorization:'Bearer '+bearerToken},
   body:JSON.stringify(params),signal:AbortSignal.timeout(timeoutMs)});
  ensure(response?.ok,'independent Identity authority unavailable');
  const body=await response.text();
  ensure(body.length<=16384,'oversized authority response');
  const data=JSON.parse(body);
  ensure(data&&typeof data==='object'&&!Array.isArray(data),'invalid authority response');
  return data;
 }
 async function resolveSubjectId({account,chainId:requestedChain}){
  const wallet=normalizeAccount(account);
  ensure(wallet&&requestedChain===chainId,'subject binding scope denied');
  const result=await post('/v1/wallet-subject',{account:wallet,chainId});
  ensure(result.account===wallet&&result.chainId===chainId&&result.revoked===false&&
   typeof result.subjectId==='string'&&HEX32.test(result.subjectId),'unverified subject binding');
  return result.subjectId.toLowerCase();
 }
 async function verifyPolicy({account,subjectId,chainId:requestedChain,requiredCredentialTypes,mode}){
  const wallet=normalizeAccount(account);
  ensure(wallet&&requestedChain===chainId&&HEX32.test(subjectId)&&mode==='read-only'&&
   Array.isArray(requiredCredentialTypes)&&requiredCredentialTypes.length>0&&
   requiredCredentialTypes.every(v=>HEX32.test(v)),'eligibility policy scope denied');
  const decision=await post('/v1/420bet/eligibility',{
   account:wallet,subjectId:subjectId.toLowerCase(),chainId,
   requiredCredentialTypes,mode,expectedPolicyVersion:policyVersion,
   expectedPolicyApprovalDigest:policyApprovalDigest.toLowerCase()
  });
  ensure(decision.account===wallet&&decision.subjectId===subjectId.toLowerCase()&&
   decision.chainId===chainId&&decision.policyVersion===policyVersion&&
   decision.policyApprovalDigest===policyApprovalDigest.toLowerCase(),
   'eligibility provider identity/version mismatch');
  if(decision.authorized!==true||decision.revoked!==false)return {authorized:false,revoked:true};
  ensure(typeof decision.authorizationVersion==='string'&&decision.authorizationVersion.length>=1&&
   decision.authorizationVersion.length<=128&&
   Number.isSafeInteger(decision.expiresAt)&&decision.expiresAt>Date.now()&&
   decision.expiresAt<=Date.now()+900000,'invalid eligibility expiry/version');
  return {authorized:true,revoked:false,authorizationVersion:
   policyVersion+':'+decision.authorizationVersion,expiresAt:decision.expiresAt};
 }
 return Object.freeze({resolveSubjectId,verifyPolicy,policyVersion});
}
