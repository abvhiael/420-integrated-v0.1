// Read-only 420Identity ABI v1 credential verification. The wallet address is
// NOT a canonical subjectId: a separately trusted binding resolver is required.
import {eventTopic} from './indexer-event-abi.mjs';
import {normalizeAccount} from '../src/wallet.js';
const A=/^0x[0-9a-fA-F]{40}$/;
const H=/^0x[0-9a-fA-F]{64}$/;
const CHAIN=/^[1-9][0-9]*$/;
const SELECTOR=eventTopic('hasValidCredential(bytes32,bytes32)').slice(0,10);
function ensure(v,m){if(!v)throw Error(m);}
function normalize32(v){ensure(typeof v==='string'&&H.test(v),'invalid bytes32');return v.toLowerCase();}
function rpcOrigin(value){
 const u=new URL(value);
 ensure(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&
  (u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))),'invalid identity RPC URL');
 return u.origin;
}
export function createCanonicalIdentityEligibility({
 rpcUrl,chainId,identityAddress,credentialTypes,resolveSubjectId,
 verifyPolicy,fetcher=fetch,timeoutMs=10000
}={}){
 const url=rpcOrigin(rpcUrl);
 ensure(typeof chainId==='string'&&CHAIN.test(chainId),'invalid Identity chain');
 ensure(typeof identityAddress==='string'&&A.test(identityAddress),'invalid Identity contract');
 ensure(Array.isArray(credentialTypes)&&credentialTypes.length>0&&credentialTypes.length<=8,'invalid Identity credential policy');
 const required=credentialTypes.map(normalize32);
 ensure(new Set(required).size===required.length,'duplicate credential type');
 ensure(typeof resolveSubjectId==='function'&&typeof verifyPolicy==='function','trusted subject and independent eligibility policy required');
 ensure(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid RPC timeout');
 const dest=identityAddress.toLowerCase();
 async function rpc(method,params){
  const res=await fetcher(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(timeoutMs)});
  ensure(res?.ok,'Identity RPC unavailable');
  const body=await res.text();ensure(body.length<20000,'Identity RPC response too large');
  const payload=JSON.parse(body);
  ensure(payload?.jsonrpc==='2.0'&&payload.id===1&&!('error' in payload)&&typeof payload.result==='string','invalid RPC response');
  return payload.result;
 }
 async function verifyIdentity({account,chainId:requestedChain,mode}){
  const wallet=normalizeAccount(account);
  ensure(wallet&&requestedChain===chainId&&mode==='read-only','Identity scope denied');
  const liveChain=await rpc('eth_chainId',[]);
  ensure(/^0x[0-9a-fA-F]+$/.test(liveChain)&&BigInt(liveChain)===BigInt(chainId),'Identity wrong chain');
  const code=await rpc('eth_getCode',[dest,'latest']);
  ensure(/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&code!=='0x00','Identity contract not deployed');
  const subject=normalize32(await resolveSubjectId({account:wallet,chainId}));
  for(const kind of required){
   const out=await rpc('eth_call',[{to:dest,data:SELECTOR+subject.slice(2)+kind.slice(2)},'latest']);
   ensure(/^0x[0-9a-fA-F]{64}$/.test(out),'invalid Identity ABI response');
   if(BigInt(out)!==1n)return {authorized:false,revoked:true};
  }
  // On-chain validity is necessary but not sufficient for legal/jurisdictional
  // eligibility. Fail closed unless independently verified policy also passes.
  const policy=await verifyPolicy({account:wallet,subjectId:subject,chainId,requiredCredentialTypes:[...required],mode});
  if(policy?.authorized!==true||policy.revoked!==false||
    typeof policy.authorizationVersion!=='string'||!policy.authorizationVersion)return {authorized:false,revoked:true};
  return {...policy,authorized:true,revoked:false};
 }
 return Object.freeze({verifyIdentity,identityAddress:dest,chainId,credentialTypes:Object.freeze(required),selector:SELECTOR});
}
