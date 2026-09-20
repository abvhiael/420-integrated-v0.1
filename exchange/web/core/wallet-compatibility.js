import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export class WalletCompatibilityError extends Error {
  constructor(code,message){super(message);this.name='WalletCompatibilityError';this.code=code;}
}
const validProvider = provider => provider && typeof provider.request === 'function';

// Do not silently choose the first injected wallet when multiple extensions compete.
// EIP-6963 detail objects may be passed by the host's eip6963:announceProvider listener.
export function discoverWalletProviders({ethereum=null,announcements=[]}={}) {
  const candidates=[];
  function add(provider,id,label){
    if(!validProvider(provider) || candidates.some(entry=>entry.provider===provider)) return;
    candidates.push(Object.freeze({id,label,provider}));
  }
  for(const detail of announcements){
    if(!detail || !validProvider(detail.provider)) continue;
    const rdns=detail.info?.rdns;
    const uuid=detail.info?.uuid;
    if(typeof rdns!=='string'||!/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(rdns)||typeof uuid!=='string'||!uuid) continue;
    add(detail.provider,`eip6963:${uuid}`,String(detail.info?.name||rdns));
  }
  if(Array.isArray(ethereum?.providers)){
    for(const [index,provider] of ethereum.providers.entries()) add(provider,`legacy:${index}`,'Injected wallet');
  }else add(ethereum,'legacy:default','Injected wallet');
  return Object.freeze(candidates);
}

export function selectWalletProvider(candidates,{selectedId=null}={}) {
  if(!Array.isArray(candidates)||!candidates.length) throw new WalletCompatibilityError('WALLET_UNAVAILABLE','no EIP-1193 wallet provider detected');
  if(selectedId!==null){
    const match=candidates.find(entry=>entry.id===selectedId);
    if(!match||!validProvider(match.provider)) throw new WalletCompatibilityError('WALLET_SELECTION_INVALID','selected wallet is unavailable');
    return match;
  }
  if(candidates.length!==1) throw new WalletCompatibilityError('WALLET_SELECTION_REQUIRED','multiple wallets detected; select the wallet explicitly');
  return candidates[0];
}

export function verifyWalletSnapshot({session,chainId,accounts,generation}={}) {
  if(!session||session.status!=='CONNECTED'||session.generation!==generation) return {ok:false,reason:'STALE_SESSION'};
  let liveChain,liveAccount;
  try {liveChain=normalizeChainId(chainId);liveAccount=normalizeAccount(accounts?.[0]);}
  catch {return {ok:false,reason:'WALLET_DISCONNECTED'};}
  if(liveChain!==normalizeChainId(session.chainId)) return {ok:false,reason:'CHAIN_MISMATCH'};
  if(liveAccount!==normalizeAccount(session.account)) return {ok:false,reason:'ACCOUNT_MISMATCH'};
  return {ok:true,reason:null};
}

export async function inspectWalletCompatibility(provider,{expectedChainId}={}) {
  if(!validProvider(provider)) throw new WalletCompatibilityError('WALLET_UNAVAILABLE','EIP-1193 provider required');
  let chainId,accounts;
  try{
    chainId=normalizeChainId(await provider.request({method:'eth_chainId'}));
    accounts=await provider.request({method:'eth_accounts'});
  }catch(error){
    throw new WalletCompatibilityError('WALLET_RPC_UNAVAILABLE',String(error?.message??'wallet state unavailable'));
  }
  let account=null;
  try{if(accounts?.[0]) account=normalizeAccount(accounts[0]);}catch{throw new WalletCompatibilityError('INVALID_ACCOUNT','wallet returned an invalid account');}
  const expected=expectedChainId?normalizeChainId(expectedChainId):null;
  return Object.freeze({chainId,account,connected:!!account,chainMatches:expected!==null&&chainId===expected,canSubmit:!!account&&expected!==null&&chainId===expected});
}
