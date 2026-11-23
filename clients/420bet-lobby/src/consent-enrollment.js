// Browser consent client: explicit action only. Never auto-sign on page load.
// Uses wallet personal_sign for EIP-191 or EIP-1271 verification by backend.
import {normalizeAccount,normalizeChain} from './wallet.js';
export function createBetConsentClient({provider,fetcher=fetch,
 endpoint='/api/420bet/consent',expectedOrigin=typeof location==='object'?location.origin:null}={}){
 if(typeof provider?.request!=='function'||typeof fetcher!=='function'||
  endpoint!=='/api/420bet/consent')throw Error('invalid consent browser transport');
 let disposed=false,revision=0;
 const invalidate=()=>{revision++};
 for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on?.(event,invalidate);
 async function call(route,payload){
  const response=await fetcher(endpoint+'/'+route,{method:'POST',
   credentials:'omit',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json',Accept:'application/json',
    Origin:expectedOrigin??''},body:JSON.stringify(payload)});
  if(!response?.ok)throw Error('420Bet consent endpoint unavailable or denied');
  return response.json();
 }
 async function act(action,{subscriptionId,recipient,channel,policyVersion,expectedRevision}={}){
  if(disposed||!['enroll','revoke'].includes(action))throw Error('consent action unavailable');
  const ticket=revision;
  const accounts=await provider.request({method:'eth_requestAccounts'});
  const account=normalizeAccount(Array.isArray(accounts)?accounts[0]:null);
  const chainId=normalizeChain(await provider.request({method:'eth_chainId'}));
  if(!account||!chainId||ticket!==revision||disposed)throw Error('wallet identity changed');
  const proof=await call('challenge',{tenant:'420bet',account,action,
   subscriptionId,recipient,channel,policyVersion,expectedRevision});
  const claim=proof?.challenge;
  if(!claim||claim.action!==action||claim.account!==account||
   claim.chainId!==String(chainId)||claim.subscriptionId!==subscriptionId||
   claim.recipient!==recipient||claim.channel!==channel||
   claim.policyVersion!==policyVersion||claim.expectedRevision!==expectedRevision||
   claim.origin!==expectedOrigin||!Number.isSafeInteger(claim.expiresAt)||
   claim.expiresAt<=Date.now()||typeof proof.message!=='string'||
   !proof.message.startsWith('420Bet Notification Consent\n')||
   !proof.message.includes('Action: '+action+'\n')||
   !proof.message.includes('Account: '+account+'\n')||
   !proof.message.includes('Route: '+recipient+'\n')||
   !proof.message.includes('Policy version: '+policyVersion+'\n'))
   throw Error('consent challenge is not bound to user intent');
  if(ticket!==revision||disposed)throw Error('wallet identity changed');
  const hex='0x'+Array.from(new TextEncoder().encode(proof.message),b=>b.toString(16).padStart(2,'0')).join('');
  const walletSignature=await provider.request({method:'personal_sign',params:[hex,account]});
  if(ticket!==revision||disposed)throw Error('wallet identity changed');
  const result=await call('confirm',{challenge:claim,signature:proof.signature,walletSignature});
  if(ticket!==revision||disposed||result.consent!==(action==='enroll')||
   result.revoked!==(action==='revoke')||
   result.revision!==expectedRevision+1)throw Error('consent state not verified');
  return result;
 }
 return Object.freeze({
  enroll:params=>act('enroll',params),
  revoke:params=>act('revoke',params),
  dispose:()=>{disposed=true;invalidate();
   for(const event of ['accountsChanged','chainChanged','disconnect'])
    provider.removeListener?.(event,invalidate);}
 });
}
