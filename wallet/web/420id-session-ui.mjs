// 420Wallet's authenticated 420ID browser session. An SSO subject is only an
// application account, never a wallet/controller address or signing authority.
// The confidential SSO code exchange, access token and app key remain server-side.
import {createAppSessionClient,mountAppSession} from './420id-client.mjs';

export const WALLET420_ID_ORIGIN='https://wallet.420integrated.org';
const APP='420wallet';
let enabled=false;
let session=null;
let mounted=null;
let generation=0;
let configured=false;
let requiresReconnect=false;
let bootError=null;
let bootstrap=Promise.resolve();
const client=createAppSessionClient({app:APP});

export function wallet420IDSessionState(){
  return Object.freeze({enabled,authenticated:!!session,subject:session?.subject??null,generation});
}
function invalidate(){
  session=null;
  if(enabled)requiresReconnect=true;
  generation++;
  if(typeof window!=='undefined'){
    window.dispatchEvent(new Event('wallet420id:invalidated'));
  }
}
export async function verifyWallet420IDSession(){
  await bootstrap;
  if(bootError)throw new Error('420ID Wallet configuration is not verified',{cause:bootError});
  if(!configured)throw new Error('420ID Wallet configuration is still unverified');
  if(!enabled)return null; // 420ID is optional; independent Wallet authority remains mandatory.
  // Once a 420ID session is lost or its subject changes, a newly minted
  // session must never inherit an already connected wallet/provider context.
  // A full page reload explicitly reconstructs account and chain authority.
  if(requiresReconnect)throw new Error('420ID session revoked or changed; reload Wallet and reconnect');
  const ticket=generation;
  let fresh;
  try{fresh=await client.session();}
  catch(error){invalidate();throw new Error('420ID wallet session unavailable; reconnect to 420ID before signing',{cause:error});}
  if(!fresh.authenticated||ticket!==generation||(session&&fresh.subject!==session.subject)){
    invalidate();
    throw new Error('420ID wallet account changed, expired or revoked');
  }
  session=fresh;
  return Object.freeze({app:fresh.app,subject:fresh.subject});
}

// The entire input is the actual EIP-1193 provider, not an alternate identity
// signer. A fresh server-side session introspection precedes *each* wallet
// mutation. It never accepts a 420ID subject as a wallet address and cannot
// sign or submit transactions on its own.
export function guardWallet420IDProvider(provider){
  if(!provider||typeof provider.request!=='function')throw new Error('EIP-1193 provider required');
  const methods=new Set(['eth_sendTransaction','eth_sign','personal_sign',
    'eth_signTypedData','eth_signTypedData_v3','eth_signTypedData_v4',
    'wallet_sendCalls','wallet_sendTransaction']);
  return {
    async request(method,params=[]){
      if(methods.has(method))await verifyWallet420IDSession();
      return provider.request(method,params);
    },
    requestAccounts:()=>provider.requestAccounts(),
    chainId:()=>provider.chainId(),
    on:(type,listener)=>provider.on(type,listener),
    removeListener:(type,listener)=>provider.removeListener(type,listener),
  };
}

export function installWallet420IDUi({runtimeConfig,origin=globalThis.location?.origin,
    root=globalThis.document?.querySelector('#wallet-420id-panel')}={}){
  if(!root||mounted) return mounted;
  if(runtimeConfig?.identitySession?.enabled!==true){
    root.hidden=true;
    configured=true;
    return {enabled:false};
  }
  if(origin!==WALLET420_ID_ORIGIN){
    // The 420ID app gateway is pinned to wallet.420integrated.org; no
    // localhost/alternate host silently substitutes a privileged 420ID session.
    root.hidden=true;
    configured=true;
    enabled=true;
    bootError=new Error('420ID Wallet origin does not match the pinned application');
    invalidate();
    throw bootError;
  }
  enabled=true;
  configured=true;
  root.dataset.app=APP;
  root.dataset.enabled='true';
  mounted=mountAppSession({root,app:APP,enabled:true,origin,
    onSessionChange(next){
      if(!next?.authenticated||session?.subject && session.subject!==next.subject){
        invalidate();
      }else{
        session=next;
      }
    }});
  return mounted;
}

if(typeof document!=='undefined'){
  bootstrap=fetch('./runtime-config.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('Wallet runtime configuration unavailable');
    const config=await response.json();
    installWallet420IDUi({runtimeConfig:config});
    configured=true;
  }).catch(error=>{
    const panel=document.querySelector('#wallet-420id-panel');
    if(panel)panel.hidden=true;
    bootError=error;
    invalidate();
  });
}else{
  // No browser authority is implicit in a Node test process. Tests must
  // explicitly call installWallet420IDUi with a bound fixture and origin.
  configured=true;
}
