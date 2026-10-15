// R06.3 account panel: operator supplies an issuer-backed authenticator, never a wallet or guest account string.
import {createCloudClient} from './cloud.js';
import {createOptionalWallet420} from './wallet.js';
import {loadGuest} from './guest.js';
export function mountAccountPanel({document,main,runtime,authenticate,storage=globalThis.localStorage,fetchImpl=fetch,localAuth=null,walletProvider=null}){
 const paragraph=(t)=>{const p=document.createElement('p');p.textContent=t;main.append(p);return p;};
 const field=(caption,value='')=>{const label=document.createElement('label');label.textContent=caption+' ';
  const input=document.createElement('input');input.value=value;label.append(input);main.append(label);return input;};
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',fn);main.append(b);return b;};
 const status=paragraph('Cloud is optional; guest progress stays on this device.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 if(runtime.mode!=='connected'||typeof authenticate!=='function'){
  paragraph('Account sign-in unavailable until a verified identity issuer and connected service are configured.');
  return;
 }
 if(localAuth){
  const username=field('Local development username'),password=field('Local development password');
  password.type='password';password.autocomplete='current-password';
  button('Create local test account',async()=>{try{await localAuth.register({username:username.value,password:password.value});
   password.value='';status.textContent='Local test account provisioned; sign in to continue.';}catch(e){report(e);}});
  button('Sign in locally',async()=>{try{await localAuth.login({username:username.value,password:password.value});
   password.value='';await sessionAction();}catch(e){report(e);}});
  button('Sign out',async()=>{try{await localAuth.logout();session=null;cloudRevision=null;
   status.textContent='Signed out; local guest game remains available.';}catch(e){report(e);}});
 }
 const client=createCloudClient({apiUrl:runtime.apiUrl,gameId:runtime.gameId,authenticate,fetchImpl});
 let session=null,cloudRevision=null;
 const report=e=>{status.textContent=e?.message||String(e);};
 const sessionAction=async()=>{session=await client.session();cloudRevision=session.revision;
  status.textContent=session.registered?'Registered profile available. Cloud revision '+cloudRevision:'Authenticated issuer account; register a game profile to activate cloud save.';};
 button('Check secure sign-in',()=>sessionAction().catch(report));
 const profileId=field('New game profile ID (not an account credential)');
 const rulesetId=field('Approved game ruleset ID');
 button('Register optional game profile',async()=>{try{const v=await client.register({profileId:profileId.value,rulesetId:rulesetId.value});status.textContent='Game profile registered: '+v.profileId;await sessionAction();}catch(e){report(e);}});
 button('Read cloud save',async()=>{try{const v=await client.read();cloudRevision=v.revision;
  status.textContent=v.save?'Cloud snapshot verified; revision '+v.revision+'. Local guest save was not overwritten.':'No cloud save exists yet.';}catch(e){report(e);}});
 const policy=field('Approved consent policy hash');
 const check=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';
 check.append(checkbox,document.createTextNode(' I consent to store this local guest preview in my account cloud save'));main.append(check);
 button('Back up guest preview to cloud',async()=>{
  try{if(!checkbox.checked)throw Error('cloud-consent-required');if(!session?.registered||!session.rulesetId)throw Error('registered-session-required');
   const local=loadGuest(storage);if(!local)throw Error('guest-save-not-found');
   const grant=await client.consent({policyHash:policy.value,accepted:true});
   const result=await client.publish({expectedRevision:cloudRevision??session.revision,consentId:grant.consentId,
    schemaLabel:'highcountry-guest-preview-v1',save:{schemaVersion:1,rulesetId:session.rulesetId,
     state:{kind:'untrusted-guest-preview',local}}});
   cloudRevision=result.revision;
   status.textContent='Guest preview backed up. Cloud revision '+result.revision+'. No achievements/assets promoted.';
  }catch(e){report(e);}
 });
 const prior=field('Cloud revision to restore');
 button('Restore prior cloud revision as new head',async()=>{
  try{if(!checkbox.checked)throw Error('cloud-consent-required');if(!session?.registered)throw Error('registered-session-required');
   const grant=await client.consent({policyHash:policy.value,accepted:true});
   const result=await client.restore({backupRevision:prior.value,expectedHead:cloudRevision??session.revision,
    consentId:grant.consentId,schemaLabel:'highcountry-guest-preview-v1'});
   cloudRevision=result.revision;
   status.textContent='Cloud revision restored as new revision '+result.revision+'. Device guest save remains unchanged.';
  }catch(e){report(e);}
 });
 // Wallet is always optional; never request accounts until the player presses Connect.
 if(walletProvider&&runtime.mode==='connected'){
  const walletStatus=paragraph('Wallet disconnected. Core guest play remains available.');
  walletStatus.setAttribute('role','status');walletStatus.setAttribute('aria-live','polite');
  let optional;
  try{optional=createOptionalWallet420({provider:walletProvider,authenticate,apiUrl:runtime.apiUrl,
   gameId:runtime.gameId,chainId:runtime.chainId,fetchImpl});}
  catch(e){walletStatus.textContent='Wallet unavailable: '+e.message;}
  if(optional){
   const consentId=field('Wallet link consent ID'),policyHash=field('Approved wallet-link policy hash');
   const label=document.createElement('label'),allowed=document.createElement('input');allowed.type='checkbox';
   label.append(allowed,document.createTextNode(' I deliberately authorize linking this wallet to my game profile'));main.append(label);
   button('Connect wallet voluntarily',async()=>{try{const addr=await optional.connect();walletStatus.textContent='Selected wallet: '+addr+'. Not linked.';}catch(e){walletStatus.textContent=e.message;}});
   button('Sign and link wallet',async()=>{try{if(!allowed.checked)throw Error('wallet-consent-required');
    await optional.link({consentId:consentId.value,policyHash:policyHash.value,consentAccepted:true});
    walletStatus.textContent='Link accepted by authenticated wallet service.';}catch(e){walletStatus.textContent=e.message;}});
   button('Check scoped wallet link',async()=>{try{const result=await optional.session();
    walletStatus.textContent=result.wallet?'Linked wallet verified for this game profile.':'No linked wallet.';}catch(e){walletStatus.textContent=e.message;}});
   button('Unlink wallet',async()=>{try{await optional.unlink();walletStatus.textContent='Unlinked. Guest play preserved.';}catch(e){walletStatus.textContent=e.message;}});
   button('Disconnect wallet locally',()=>{optional.disconnect();walletStatus.textContent='Disconnected. Guest play preserved.';});
   paragraph('Entitlements, holdings, market, rewards and cross-game records require separately authenticated and finalized authoritative services; unavailable features are disabled, never simulated.');
  }
 }
 paragraph('Cloud backups are historical untrusted previews, never canonical harvests, inventory, BUDS, claims, or wallet entitlement.');
}
