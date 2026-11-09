// Opt-in read-only 420Bet wallet sign-in UI transport.
// This is NOT connected to casino wager controls or production capabilities.
import {normalizeAccount,normalizeChain} from './wallet.js';
export function createWalletSessionClient({
 provider,fetcher=fetch,endpoint='/api/420bet/session',
 expectedOrigin=typeof location==='object'?location.origin:null
}={}){
 if(!provider?.request||typeof fetcher!=='function'||endpoint!=='/api/420bet/session')
  throw Error('invalid wallet session transport');
 let current=null,disposed=false,generation=0;
 const invalidate=()=>{generation++;current=null;};
 const listener=()=>invalidate();
 for(const event of ['accountsChanged','chainChanged','disconnect'])provider.on?.(event,listener);
 async function request(action,payload,identity=null){
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  if(identity){headers.Authorization='Bearer '+identity.token;headers['X-Bet-Account']=identity.account;headers['X-Bet-Chain-Id']=identity.chainId;}
  const response=await fetcher(endpoint+'/'+action,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
    headers,body:JSON.stringify(payload)});
  if(!response?.ok)throw Error('session unavailable');
  return response.json();
 }
 async function connect(){
  if(disposed)throw Error('session client disposed');
  const mine=++generation;current=null;
  const accounts=await provider.request({method:'eth_requestAccounts'});
  const account=normalizeAccount(Array.isArray(accounts)?accounts[0]:null);
  const chainId=normalizeChain(await provider.request({method:'eth_chainId'}));
  if(disposed||generation!==mine||!account||!chainId)throw Error('wallet identity changed');
  const chain=String(chainId);
  const challenge=await request('challenge',{account,chainId:chain});
  if(disposed||generation!==mine||typeof challenge?.message!=='string'||
   (expectedOrigin!==null&&!challenge.message.startsWith('420Bet read-only session\\nOrigin: '+expectedOrigin+'\\n'))||
   !challenge.message.includes('Account: '+account+'\n')||
   !challenge.message.includes('Chain ID: '+chain+'\n'))throw Error('invalid wallet challenge');
  // The player explicitly initiates this login request; never sign on page load.
  const signature=await provider.request({method:'personal_sign',params:[challenge.message,account]});
  if(disposed||generation!==mine)throw Error('wallet identity changed');
  const session=await request('authenticate',{account,chainId:chain,nonce:challenge.nonce,signature});
  if(disposed||generation!==mine||session.account!==account||session.chainId!==chain||
    typeof session.token!=='string'||!/^[a-f0-9]{64}$/.test(session.token))throw Error('invalid session response');
  current={token:session.token,account,chainId:chain};
  return {account,chainId:chain,readOnly:true};
 }
 async function status(){
  const state=current;if(!state||disposed)throw Error('not authenticated');
  const out=await request('status',{},state);
  if(current!==state||out.account!==state.account||out.chainId!==state.chainId||out.readOnly!==true)
   throw Error('stale or invalid session');
  return out;
 }
 async function disconnect(){
  const state=current;invalidate();
  if(state)await request('revoke',{},state); // Propagate failure: do not claim remote revocation.
 }
 function dispose(){invalidate();disposed=true;for(const event of ['accountsChanged','chainChanged','disconnect'])provider.removeListener?.(event,listener);}
 return Object.freeze({connect,status,disconnect,dispose,get authenticated(){return !disposed&&Boolean(current);}});
}
