import {Wallet} from './vendor/ethers-6.17.0.min.js';
import {registerPendingExtensionPasskey420} from './core/passkey-onboarding.js';
import {VAULT_STORAGE_KEY,createVault420,unlockVault420,hasVault420,restoreEncryptedBackup420,normalizeMnemonic420,generateMnemonic420,validatePrivateKey420,decryptVault420,deriveMnemonicAccount420} from './core/vault.js';

const $=id=>document.getElementById(id);
let session=null;
let sessionPassword=null;
let stagedPhrase=null;
let stagedPassword=null;
let confirmationIndexes=[];
let secureTask=null;
let nextTimer=null;
const views=['welcome','setup','confirm-phrase','unlock','accounts','add-wallet','secure-action','passkey-info','hardware-info'];
function message(value,kind=''){
  $('message').textContent=value;
  $('message').className='notice '+(kind||'');
}
function show(id){
  for(const v of views)$(v).hidden=v!==id;
  const head=$(id).querySelector('h2');if(head){head.setAttribute('tabindex','-1');head.focus({preventScroll:true});}
}
function zeroSecretFields(){
  for(const el of document.querySelectorAll('input[type=password],textarea'))el.value='';
}
async function publishAccounts(){
  if(!session)return;
  const publicAccounts=session.accounts().map(a=>a.address);
  const key='420-wallet-extension-config-v1';
  const value=(await chrome.storage.local.get(key))[key]||{};
  const previous=Array.isArray(value.accounts)?value.accounts:[];
  const previousVault=Array.isArray(value.vaultAccounts)?value.vaultAccounts:[];
  const external=previous.filter(a=>!previousVault.includes(a));
  const unique=[...new Set([...external,...publicAccounts])];
  await chrome.storage.local.set({[key]:{...value,accounts:unique,vaultAccounts:publicAccounts}});
  const prefs='420-wallet-ui-preferences-v1';
  const stored=(await chrome.storage.local.get(prefs))[prefs]||{};
  if(!unique.includes(stored.selectedAccount)){
    await chrome.storage.local.set({[prefs]:{...stored,selectedAccount:publicAccounts[0]||external[0]||null}});
  }
}
async function lease(){
  if(!session)return;
  await chrome.storage.session.set({'420-wallet-vault-lease-v1':{expiresAt:Date.now()+session.policy()*60_000}});
}
async function clearLease(){await chrome.storage.session.remove('420-wallet-vault-lease-v1');}
async function lock(){
  session?.lock();session=null;sessionPassword=null;stagedPhrase=null;stagedPassword=null;
  if(nextTimer){clearInterval(nextTimer);nextTimer=null;}
  await clearLease();zeroSecretFields();show('unlock');message('Wallet locked. Unlock with your local vault password.');
}
function manageTimer(){
  if(nextTimer)clearInterval(nextTimer);
  nextTimer=setInterval(async()=>{
    try{session?.ensureActive();}catch{if(session)await lock(); }
  },5000);
}
async function opened(sessionObject,password){
  session=sessionObject;
  sessionPassword=password;
  await publishAccounts();
  await lease();
  manageTimer();
  renderAccounts();
  show('accounts');
  message('Vault unlocked locally. Secret keys are never sent to the RPC or background service.','success');
  zeroSecretFields();
}
function accountRow(wallet,account){
  const card=document.createElement('div');card.className='account-row';
  const body=document.createElement('div');body.className='account-details';
  const title=document.createElement('strong');title.textContent=account.label||'Account';
  const address=document.createElement('code');address.textContent=account.address;
  const derivation=document.createElement('small');derivation.textContent=wallet.type==='mnemonic'?(account.path||'Standard EVM derivation'):'Imported key';
  body.append(title,address,derivation);
  card.append(body);
  const copy=document.createElement('button');copy.type='button';copy.className='secondary';copy.textContent='Copy';
  copy.addEventListener('click',()=>navigator.clipboard.writeText(account.address).then(()=>message('Public address copied.','success')).catch(()=>message('Clipboard access unavailable.','error')));
  card.append(copy);
  return card;
}
function renderAccounts(){
  if(!session)return;
  const area=$('account-list');area.replaceChildren();
  const wallets=session.wallets();
  for(const wallet of wallets){
    const group=document.createElement('section');group.className='wallet-group';
    const title=document.createElement('h3');title.textContent=wallet.label||'Wallet';group.append(title);
    for(const account of wallet.accounts)group.append(accountRow(wallet,account));
    if(wallet.type==='mnemonic'){
      const add=document.createElement('button');add.type='button';add.className='secondary';add.textContent='+ Derive next BIP-44 account';
      add.addEventListener('click',async()=>{
        try{const added=await session.deriveNext(sessionPassword,wallet.id);await publishAccounts();await lease();renderAccounts();message('Derived '+added[0].address+'. The new index is stored in your encrypted vault.','success');}catch(error){message(error.message,'error');}
      });
      group.append(add);
      const scan=document.createElement('button');scan.type='button';scan.className='secondary';scan.textContent='Discover from network';
      scan.addEventListener('click',()=>scanWallet(wallet.id));
      group.append(scan);
    }
    area.append(group);
  }
  if(!wallets.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='This vault contains no accounts. Use Import another wallet.';area.append(empty);}
  const pending=session.pendingPasskeys();
  if(pending.length){
    const heading=document.createElement('h3');heading.textContent='Device passkeys pending on-chain enrollment';area.append(heading);
    for(const credential of pending){
      const row=document.createElement('p');row.className='hint';
      row.textContent=credential.credentialId.slice(0,16)+'… · '+credential.rpId+' · NOT enrolled / NOT authorized';
      area.append(row);
    }
  }
  $('autolock-minutes').value=String(session.policy());
  $('lock-policy').textContent='Lock after '+session.policy()+' minute(s) without activity. Closing this page discards all decrypted key material from page memory.';
}
async function scanWallet(walletId){
  try{
    if(!session)throw new Error('Unlock first');
    const config=(await chrome.storage.local.get('420-wallet-extension-config-v1'))['420-wallet-extension-config-v1']||{};
    if(!config.rpcUrl||!config.chainId)throw new Error('Configure a verified chain and RPC in Wallet Settings before discovery. Otherwise choose and derive account indexes manually.');
    const url=new URL(config.rpcUrl);
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Approved HTTPS RPC required');
    const provider={
      async request(method,params=[]){
        const response=await fetch(url.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method,params})});
        if(!response.ok)throw new Error('Discovery RPC HTTP '+response.status);
        const data=await response.json();if(data.error)throw new Error(data.error.message||'Discovery RPC failure');
        return data.result;
      }
    };
    const observed=await provider.request('eth_chainId');
    if(BigInt(observed)!==BigInt(config.chainId))throw new Error('Discovery chain mismatch: no accounts added');
    const result=await session.scanMnemonic(sessionPassword,walletId,provider,{gapLimit:20,maxIndex:100});
    await publishAccounts();await lease();renderAccounts();
    message('Scanned '+result.scanned+' indexes. Found '+result.discovered.length+' active accounts. '+result.warning,'warn');
  }catch(error){message('Account discovery stopped: '+error.message,'error');}
}
async function readFile(input){
  const file=$(input).files?.[0];if(!file)throw new Error('Select a JSON file');
  if(file.size>1024*1024)throw new Error('Selected JSON file exceeds 1 MB');
  return file.text();
}
function setupMode(){
  const mode=$('setup-mode').value;
  $('create-fields').hidden=mode!=='create';
  $('mnemonic-fields').hidden=mode!=='mnemonic';
  $('private-fields').hidden=mode!=='private-key';
  $('keystore-fields').hidden=mode!=='keystore';
  $('backup-fields').hidden=mode!=='backup';
}
function clearStaging(){
  stagedPhrase=null;stagedPassword=null;
  $('new-phrase').replaceChildren();$('confirm-inputs').replaceChildren();
}
async function setup(event){
  event.preventDefault();
  const password=$('setup-password').value;
  if(password!==$('setup-confirm').value)throw new Error('Wallet passwords do not match');
  if(password.length<12)throw new Error('Use a wallet password of at least 12 characters');
  const mode=$('setup-mode').value;
  if(mode==='create'){
    const phrase=generateMnemonic420(Number($('word-count').value));
    stagedPhrase=phrase;stagedPassword=password;
    $('new-phrase').textContent=phrase.split(' ').map((w,i)=>(i+1)+'. '+w).join('    ');
    const wordCount=phrase.split(' ').length;
    const indices=new Set();
    while(indices.size<3){const byte=new Uint8Array(1);crypto.getRandomValues(byte);indices.add(byte[0]%wordCount);}
    confirmationIndexes=[...indices].sort((a,b)=>a-b);
    const container=$('confirm-inputs');container.replaceChildren();
    for(const index of confirmationIndexes){
      const label=document.createElement('label');label.textContent='Word #'+(index+1);
      const input=document.createElement('input');input.id='confirm-word-'+index;input.type='text';input.autocomplete='off';input.spellcheck=false;input.required=true;
      label.append(input);container.append(label);
    }
    $('setup-password').value='';$('setup-confirm').value='';
    show('confirm-phrase');message('Verify the recorded recovery phrase before saving the encrypted wallet.');
    return;
  }
  if(mode==='backup'){
    const vault=await restoreEncryptedBackup420(chrome.storage.local,await readFile('backup-file'),password);
    await opened(vault,password);return;
  }
  let importMode=mode;
  let importValue;
  let extra='';
  if(mode==='mnemonic'){
    importValue=normalizeMnemonic420($('import-mnemonic').value);
    extra=$('import-passphrase').value;
  }else if(mode==='private-key'){
    importValue=validatePrivateKey420($('import-key').value).privateKey;
  }else if(mode==='keystore'){
    const file=await readFile('keystore-file');
    const wallet=await Wallet.fromEncryptedJson(file,$('keystore-password').value);
    importValue=wallet.privateKey;importMode='private-key';
  }else throw new Error('Unsupported import mode');
  let created=false;let vault=null;
  try {
    vault=await createVault420(chrome.storage.local,password);created=true;
    if(importMode==='mnemonic')await vault.importMnemonic(password,importValue,{passphrase:extra,accountCount:Number($('restore-count').value)});
    else await vault.importPrivateKey(password,importValue);
    await opened(vault,password);
  }catch(error){
    if(created&&vault?.wallets().length===0)await chrome.storage.local.remove(VAULT_STORAGE_KEY);
    throw error;
  }
}
async function confirmPhrase(event){
  event.preventDefault();
  if(!stagedPhrase||!stagedPassword)throw new Error('Recovery phrase session expired');
  const words=stagedPhrase.split(' ');
  for(const index of confirmationIndexes){
    if($('confirm-word-'+index).value.trim().toLowerCase()!==words[index])throw new Error('Backup verification failed. Check your written words and try again.');
  }
  const phrase=stagedPhrase,password=stagedPassword;
  const vault=await createVault420(chrome.storage.local,password);
  try{await vault.importMnemonic(password,phrase,{label:'Wallet 1'});}catch(error){
    await chrome.storage.local.remove(VAULT_STORAGE_KEY);throw error;
  }
  clearStaging();await opened(vault,password);
}
async function addWallet(event){
  event.preventDefault();if(!session)throw new Error('Vault locked');
  const type=$('add-type').value,passphrase=$('add-passphrase').value;
  if(type==='mnemonic')await session.importMnemonic(sessionPassword,$('add-value').value,{passphrase,accountCount:Number($('add-count').value)});
  else if(type==='private-key')await session.importPrivateKey(sessionPassword,$('add-value').value);
  else if(type==='keystore')await session.importEncryptedKeystore(sessionPassword,await readFile('add-keystore-file'),passphrase);
  else throw new Error('Unsupported import');
  await publishAccounts();await lease();renderAccounts();zeroSecretFields();show('accounts');message('Wallet imported into your encrypted local vault.','success');
}
async function passwordAction(event){
  event.preventDefault();if(!session)throw new Error('Vault locked');
  const old=$('secure-password').value;
  await decryptVault420(session.record,old);
  if(secureTask==='change'){
    const password=$('new-password').value;
    if(password!==$('new-confirm').value)throw new Error('New passwords do not match');
    await session.changePassword(old,password);sessionPassword=password;show('accounts');message('Vault password changed and all secrets re-encrypted.','success');
  }else if(secureTask==='reveal'){
    const wallets=session.wallets().filter(w=>w.type==='mnemonic');
    if(!wallets.length)throw new Error('This vault contains no recovery phrase wallet');
    const options=wallets.map((w,i)=>(i+1)+': '+w.label).join('\n');
    const picked=Number(window.prompt('Choose recovery phrase wallet (number):\n'+options,'1'));
    if(!Number.isInteger(picked)||picked<1||picked>wallets.length)throw new Error('No recovery phrase wallet selected');
    const info=session.recoveryPhrase(wallets[picked-1].id);
    $('recovery-output').textContent=info.phrase+'\n\nDerived accounts saved: '+info.derivedCount+'\nBIP-39 passphrase: '+(info.passphraseUsed?info.passphrase:'(none)')+'\n\nImported private keys and passkeys are not restored by this phrase.';
    $('recovery-output').hidden=false;
    setTimeout(()=>{$('recovery-output').textContent='';$('recovery-output').hidden=true;},60000);
    message('Sensitive recovery phrase displayed temporarily. Keep it private.','warn');
  }
  $('secure-password').value='';$('new-password').value='';$('new-confirm').value='';
}
function beginSecure(action){
  secureTask=action;$('recovery-output').hidden=true;$('recovery-output').textContent='';
  $('change-password-fields').hidden=action!=='change';
  show('secure-action');
}
async function backup(){
  if(!session)throw new Error('Vault locked');
  const json=await session.backupEncrypted();
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{const a=document.createElement('a');a.href=url;a.download='420wallet-encrypted-vault-backup.json';a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),500);}
  message('Encrypted backup downloaded. This file contains your imported keys and all derived-account indices. Keep the backup and password separate.','success');
}
function listen(id,event,fn){$(id).addEventListener(event,async ev=>{try{await fn(ev);}catch(e){message(e.message,'error');}});}
async function initialize(){
  if(await hasVault420(chrome.storage.local)){show('unlock');message('Existing encrypted vault detected. Enter your password to unlock.');}
  else{show('welcome');message('No local wallet exists yet. Choose Create or Import.');}
}
listen('welcome-create','click',()=>{$('setup-mode').value='create';setupMode();show('setup');});
listen('welcome-import','click',()=>{$('setup-mode').value='mnemonic';setupMode();show('setup');});
listen('welcome-passkey','click',()=>{show('passkey-info');message('Passkey SmartAccount enrollment requires verified deployed contract authority.');});
listen('welcome-hardware','click',()=>{show('hardware-info');message('Hardware wallet connection requires a supported hardware signing integration.');});
listen('passkey-back','click',()=>{if(session){renderAccounts();show('accounts');}else initialize();});listen('hardware-back','click',initialize);listen('setup-back','click',()=>{clearStaging();show('welcome');});
listen('setup-mode','change',setupMode);
listen('setup-form','submit',setup);listen('confirm-form','submit',confirmPhrase);
listen('unlock-form','submit',async ev=>{ev.preventDefault();const pass=$('unlock-password').value;await opened(await unlockVault420(chrome.storage.local,pass),pass);});
listen('forget-help','click',()=>{$('forgot-message').hidden=!$('forgot-message').hidden;});
listen('lock-button','click',lock);
listen('add-derived','click',()=>{const list=session?.wallets().filter(w=>w.type==='mnemonic')||[];if(list.length===1){$('account-list').querySelector('.wallet-group button')?.click();}else message('Choose Derive next BIP-44 account beneath the relevant mnemonic wallet.','warn');});
listen('scan-accounts','click',()=>message('Choose Discover from network beneath the relevant mnemonic wallet; verify the account gap and scan limit.','warn'));
listen('add-import','click',()=>{show('add-wallet');});
listen('add-back','click',()=>{zeroSecretFields();show('accounts');});
listen('add-form','submit',addWallet);
listen('backup-export','click',backup);
listen('reveal-recovery','click',()=>beginSecure('reveal'));
listen('password-change','click',()=>beginSecure('change'));
listen('prepare-passkey','click',()=>{show('passkey-info');$('passkey-status').textContent='This credential will be staged only; it cannot sign on-chain until the canonical SmartAccount420 enrollment is confirmed.';});
listen('passkey-controller','click',()=>{if(session){show('accounts');}else{show('setup');$('setup-mode').value='create';setupMode();}});
listen('passkey-register','click',async()=>{
  if(!session)throw new Error('Create or unlock a password-encrypted vault before registering a device passkey');
  const button=$('passkey-register');button.disabled=true;
  $('passkey-status').textContent='Requesting device-bound WebAuthn ES256 credential…';
  try{
    const pending=await registerPendingExtensionPasskey420(navigator);
    await session.stagePasskey(sessionPassword,pending);
    await lease();
    $('passkey-status').textContent='Device passkey credential prepared: '+pending.credentialId.slice(0,16)+'…. No SmartAccount420 authority exists until verified on-chain enrollment.';
    message('Local passkey metadata encrypted. The authenticator retains its private key. On-chain enrollment and recovery remain required.','warn');
  }catch(error){$('passkey-status').textContent='Passkey registration failed without changing wallet authority: '+error.message;throw error;}
  finally{button.disabled=false;}
});
listen('secure-back','click',()=>{zeroSecretFields();$('recovery-output').textContent='';show('accounts');});
listen('secure-form','submit',passwordAction);
listen('autolock-minutes','change',async()=>{await session.setAutoLock(sessionPassword,Number($('autolock-minutes').value));await lease();renderAccounts();message('Autolock policy updated.','success');});
document.addEventListener('keydown',()=>{if(session){try{session.ensureActive();lease().catch(()=>{});}catch{lock();}}});
document.addEventListener('click',()=>{if(session){try{session.ensureActive();lease().catch(()=>{});}catch{lock();}}});
window.addEventListener('pagehide',()=>{session?.lock();session=null;sessionPassword=null;stagedPhrase=null;stagedPassword=null;});
initialize().catch(e=>message('Unable to initialize local vault: '+e.message,'error'));
