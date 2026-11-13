import {HDNodeWallet, Mnemonic, Wallet, randomBytes, getAddress} from '../vendor/ethers-6.17.0.min.js';

export const VAULT_STORAGE_KEY='420-wallet-encrypted-vault-v1';
export const VAULT_SCHEMA='420-wallet-encrypted-vault-v1';
export const DERIVATION_PATH_420="m/44'/60'/0'/0";
export const VAULT_PBKDF2_ITERATIONS=600000;
const enc=new TextEncoder(),dec=new TextDecoder();
const LIMIT=500;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;

function assert(condition,message){if(!condition)throw new Error(message);}
function randHex(n=16){return Array.from(randomBytes(n),b=>b.toString(16).padStart(2,'0')).join('');}
function toB64(bytes){let str='';for(let i=0;i<bytes.length;i++)str+=String.fromCharCode(bytes[i]);return btoa(str);}
function fromB64(data){assert(typeof data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(data)&&data.length%4===0,'Invalid vault encoding');return Uint8Array.from(atob(data),c=>c.charCodeAt(0));}
function now(){return Date.now();}
async function serializedVaultWrite420(action){
  if(globalThis.navigator?.locks?.request)return globalThis.navigator.locks.request('420-wallet-vault-write',{mode:'exclusive'},action);
  return action();
}
function passwordPolicy(password){
  assert(typeof password==='string'&&password.length>=12&&password.length<=1024,'Wallet password must have 12–1024 characters');
  return password;
}
export function normalizeMnemonic420(phrase){
  assert(typeof phrase==='string'&&phrase.length<1024,'Recovery phrase required');
  const normalized=phrase.normalize('NFKD').toLowerCase().trim().replace(/\s+/g,' ');
  const words=normalized.split(' ');
  assert([12,24].includes(words.length),'Only 12- or 24-word BIP-39 phrases are supported');
  assert(Mnemonic.isValidMnemonic(normalized),'Invalid BIP-39 recovery phrase or checksum');
  return normalized;
}
export function generateMnemonic420(words=12){
  assert(words===12||words===24,'Recovery phrase must use 12 or 24 words');
  assert(globalThis.crypto?.getRandomValues,'Secure browser entropy unavailable');
  return Mnemonic.fromEntropy(randomBytes(words===12?16:32)).phrase;
}
export function deriveMnemonicAccount420(phrase,index=0,passphrase=''){
  const normalized=normalizeMnemonic420(phrase);
  assert(Number.isSafeInteger(index)&&index>=0&&index<LIMIT,'Derivation index outside supported range (0–499)');
  assert(typeof passphrase==='string'&&passphrase.length<=512,'Invalid mnemonic passphrase');
  const path=DERIVATION_PATH_420+'/'+index;
  const account=HDNodeWallet.fromPhrase(normalized,passphrase,path);
  return {address:account.address.toLowerCase(),path,index};
}
export function validatePrivateKey420(key){
  assert(typeof key==='string'&&/^0x[0-9a-fA-F]{64}$/.test(key),'Private key must be 32-byte hexadecimal with 0x prefix');
  const wallet=new Wallet(key);
  return {privateKey:wallet.privateKey,address:wallet.address.toLowerCase()};
}
function accountId(){return randHex(16);}
function validVaultPayload(payload){
  assert(payload?.schema==='420-wallet-secret-payload-v1'&&Array.isArray(payload.wallets),'Invalid wallet vault content');
  assert(payload.wallets.length<=100,'Vault contains too many wallets');
  for(const wallet of payload.wallets){
    assert(typeof wallet.id==='string'&&/^[0-9a-f]{32}$/.test(wallet.id),'Invalid wallet identifier');
    assert(['mnemonic','private-key','watch-only'].includes(wallet.type),'Unsupported wallet secret type');
    assert(Array.isArray(wallet.accounts)&&wallet.accounts.length>=1&&wallet.accounts.length<=LIMIT,'Invalid derived account inventory');
    if(wallet.type==='mnemonic'){
      normalizeMnemonic420(wallet.mnemonic);
      assert(typeof wallet.passphrase==='string','Missing mnemonic passphrase field');
      for(const item of wallet.accounts){
        const derived=deriveMnemonicAccount420(wallet.mnemonic,item.index,wallet.passphrase);
        assert(derived.address===item.address?.toLowerCase(),'Stored mnemonic account/address mismatch');
      }
    }else if(wallet.type==='private-key'){
      const validated=validatePrivateKey420(wallet.privateKey);
      assert(wallet.accounts.length===1&&wallet.accounts[0].address?.toLowerCase()===validated.address,'Private-key account/address mismatch');
    }else{
      assert(wallet.accounts.length===1&&ADDRESS.test(wallet.accounts[0].address)&&!/^0x0{40}$/i.test(wallet.accounts[0].address),'Invalid watch-only account');
    }
    for(const account of wallet.accounts){
      assert(typeof account.label==='string'&&account.label.length<=80,'Invalid account label');
      assert(account.hidden===undefined||typeof account.hidden==='boolean','Invalid account visibility');
    }
  }
  return true;
}
async function deriveKey(password,salt,iterations){
  passwordPolicy(password);
  assert(Number.isInteger(iterations)&&iterations>=VAULT_PBKDF2_ITERATIONS&&iterations<=3000000,'Unsupported or weakened password derivation');
  const raw=enc.encode(password);
  const material=await globalThis.crypto.subtle.importKey('raw',raw,'PBKDF2',false,['deriveKey']);
  raw.fill(0);
  return globalThis.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptVault420(payload,password,{id=randHex(16),revision=1}={}){
  validVaultPayload(payload);
  assert(globalThis.crypto?.subtle&&globalThis.crypto?.getRandomValues,'Browser WebCrypto is required');
  assert(/^[0-9a-f]{32}$/.test(id)&&Number.isSafeInteger(revision)&&revision>=1,'Invalid vault identifier/revision');
  const salt=randomBytes(32),iv=randomBytes(12),key=await deriveKey(password,salt,VAULT_PBKDF2_ITERATIONS);
  const aad=enc.encode(VAULT_SCHEMA+':'+id+':'+revision);
  const bytes=enc.encode(JSON.stringify(payload));
  try {
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,bytes);
    return {schema:VAULT_SCHEMA,id,revision,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:VAULT_PBKDF2_ITERATIONS,salt:toB64(salt)},cipher:{name:'AES-256-GCM',iv:toB64(iv)},ciphertext:toB64(new Uint8Array(ciphertext))};
  }finally{bytes.fill(0);salt.fill(0);iv.fill(0);}
}
export function validateVaultEnvelope420(record){
  assert(record?.schema===VAULT_SCHEMA&&typeof record.id==='string'&&/^[0-9a-f]{32}$/.test(record.id),'Unsupported vault version');
  assert(Number.isSafeInteger(record.revision)&&record.revision>0,'Invalid vault revision');
  assert(record.kdf?.name==='PBKDF2'&&record.kdf.hash==='SHA-256','Unsupported vault KDF');
  assert(Number.isInteger(record.kdf.iterations)&&record.kdf.iterations>=VAULT_PBKDF2_ITERATIONS&&record.kdf.iterations<=3000000,'Vault KDF strength insufficient');
  assert(record.cipher?.name==='AES-256-GCM','Unsupported vault cipher');
  assert(fromB64(record.kdf.salt).length===32&&fromB64(record.cipher.iv).length===12,'Invalid vault salt or IV');
  assert(fromB64(record.ciphertext).length>=17&&record.ciphertext.length<3000000,'Invalid vault ciphertext');
  return true;
}
export async function decryptVault420(record,password){
  validateVaultEnvelope420(record);
  const salt=fromB64(record.kdf.salt),iv=fromB64(record.cipher.iv);
  const key=await deriveKey(password,salt,record.kdf.iterations);
  const aad=enc.encode(VAULT_SCHEMA+':'+record.id+':'+record.revision);
  let plaintext;
  try {
    plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,fromB64(record.ciphertext)));
    const payload=JSON.parse(dec.decode(plaintext));
    validVaultPayload(payload);
    return payload;
  }catch{throw new Error('Invalid wallet password or vault integrity check failed');}
  finally{plaintext?.fill(0);salt.fill(0);iv.fill(0);}
}
async function stored(storage){
  assert(storage&&typeof storage.get==='function'&&typeof storage.set==='function','Extension local storage required');
  const result=await storage.get(VAULT_STORAGE_KEY);
  return result?.[VAULT_STORAGE_KEY]||null;
}
export class VaultSession420{
  constructor(storage,record,payload){
    this.storage=storage;this.record=record;this.payload=payload;this.lastActive=now();this.locked=false;
  }
  ensureActive(){
    assert(!this.locked&&this.payload,'Wallet is locked');
    const minutes=this.payload.autoLockMinutes??5;
    if(now()-this.lastActive>=minutes*60000){this.lock();throw new Error('Wallet auto-locked after inactivity');}
    this.lastActive=now();
  }
  lock(){this.locked=true;this.payload=null;this.record=null;}
  accounts(){
    this.ensureActive();
    return this.payload.wallets.flatMap(w=>w.accounts.map(a=>({id:w.id,type:w.type,index:a.index,address:a.address,path:a.path||null,label:a.label||'Account '+(a.index+1),hidden:a.hidden===true,accountClass:w.type==='watch-only'?'watch-only':'eoa'})));
  }
  wallets(){
    this.ensureActive();
    return this.payload.wallets.map(w=>({id:w.id,type:w.type,accounts:w.accounts.map(a=>({...a})),label:w.label}));
  }
  policy(){this.ensureActive();return this.payload.autoLockMinutes??5;}
  async mutate(password,fn){
    return serializedVaultWrite420(async()=>{
    this.ensureActive();
    const current=await stored(this.storage);
    assert(current?.id===this.record.id&&current?.revision===this.record.revision,'Vault was changed in another window; unlock it again');
    await decryptVault420(current,password); // Do not allow a wrong password to rotate or corrupt an unlocked vault.
    const next=structuredClone(this.payload);
    const result=await fn(next);
    validVaultPayload(next);
    const encrypted=await encryptVault420(next,password,{id:this.record.id,revision:this.record.revision+1});
    await this.storage.set({[VAULT_STORAGE_KEY]:encrypted});
    this.record=encrypted;this.payload=next;this.lastActive=now();
    return result;
    });
  }
  async importMnemonic(password,phrase,{passphrase='',label='Recovery phrase',accountCount=1}={}){
    const normalized=normalizeMnemonic420(phrase);
    assert(typeof passphrase==='string'&&passphrase.length<=512,'Invalid BIP-39 passphrase');
    assert(Number.isSafeInteger(accountCount)&&accountCount>=1&&accountCount<=LIMIT,'Invalid restored account count');
    return this.mutate(password,payload=>{
      assert(payload.wallets.length<100,'Wallet limit reached');
      assert(!payload.wallets.some(w=>w.type==='mnemonic'&&w.mnemonic===normalized&&w.passphrase===passphrase),'Recovery phrase already exists in this vault');
      const accounts=Array.from({length:accountCount},(_,index)=>({...deriveMnemonicAccount420(normalized,index,passphrase),label:'Account '+(index+1)}));
      const id=accountId();
      payload.wallets.push({id,type:'mnemonic',mnemonic:normalized,passphrase,label,accounts});
      return {id,accounts:accounts.map(a=>({...a}))};
    });
  }
  async importPrivateKey(password,key,{label='Imported private key'}={}){
    const validated=validatePrivateKey420(key);
    return this.mutate(password,payload=>{
      assert(payload.wallets.length<100,'Wallet limit reached');
      assert(!payload.wallets.some(w=>w.accounts.some(a=>a.address===validated.address)),'An account with this address is already in the vault');
      const id=accountId();
      payload.wallets.push({id,type:'private-key',privateKey:validated.privateKey,label,accounts:[{index:0,address:validated.address,label,path:null}]});
      return {id,address:validated.address};
    });
  }
  async addWatchOnly(password,address,{label='Watch-only account'}={}){
    assert(ADDRESS.test(address)&&!/^0x0{40}$/i.test(address),'Invalid watch-only address');
    const canonical=getAddress(address).toLowerCase();
    return this.mutate(password,payload=>{
      assert(payload.wallets.length<100,'Wallet limit reached');
      assert(!payload.wallets.some(w=>w.accounts.some(a=>a.address===canonical)),'Account already exists in the vault');
      const id=accountId();
      payload.wallets.push({id,type:'watch-only',label,accounts:[{index:0,address:canonical,label,hidden:false,path:null}]});
      return {id,address:canonical};
    });
  }
  async updateAccount(password,walletId,address,{label,hidden}={}){
    return this.mutate(password,payload=>{
      const wallet=payload.wallets.find(w=>w.id===walletId);
      const account=wallet?.accounts.find(a=>a.address===address);
      assert(account,'Unknown account');
      if(label!==undefined){assert(typeof label==='string'&&label.trim().length>=1&&label.trim().length<=80,'Account name must be 1–80 characters');account.label=label.trim();}
      if(hidden!==undefined){assert(typeof hidden==='boolean','Invalid hidden state');account.hidden=hidden;}
      return {address:account.address,label:account.label,hidden:account.hidden===true};
    });
  }
  exportPrivateKey(walletId,address){
    this.ensureActive();
    const wallet=this.payload.wallets.find(w=>w.id===walletId);
    const account=wallet?.accounts.find(a=>a.address===address);
    assert(account,'Unknown account');
    assert(wallet.type==='mnemonic'||wallet.type==='private-key','Watch-only and hardware accounts have no locally exportable private key');
    const privateKey=wallet.type==='private-key'?wallet.privateKey:HDNodeWallet.fromPhrase(wallet.mnemonic,wallet.passphrase,DERIVATION_PATH_420+'/'+account.index).privateKey;
    assert(new Wallet(privateKey).address.toLowerCase()===account.address,'Export account derivation mismatch');
    return privateKey;
  }
  async importEncryptedKeystore(password,json,keystorePassword){
    assert(typeof json==='string'&&json.length<1024*1024,'Encrypted JSON keystore must be smaller than 1 MB');
    const wallet=await Wallet.fromEncryptedJson(json,keystorePassword);
    return this.importPrivateKey(password,wallet.privateKey,{label:'Imported encrypted JSON keystore'});
  }
  async deriveNext(password,walletId,{count=1}={}){
    assert(Number.isSafeInteger(count)&&count>=1&&count<=LIMIT,'Derive between 1 and 500 accounts');
    return this.mutate(password,payload=>{
      const wallet=payload.wallets.find(x=>x.id===walletId);
      assert(wallet&&wallet.type==='mnemonic','Derived accounts require a recovery phrase wallet');
      const maximum=Math.max(...wallet.accounts.map(a=>a.index));
      assert(maximum+count<LIMIT,'Derivation limit reached');
      const added=Array.from({length:count},(_,i)=>{
        const index=maximum+1+i;
        return {...deriveMnemonicAccount420(wallet.mnemonic,index,wallet.passphrase),label:'Account '+(index+1)};
      });
      wallet.accounts.push(...added);
      return added;
    });
  }
  async scanMnemonic(password,walletId,provider,{gapLimit=20,maxIndex=100}={}){
    this.ensureActive();
    assert(Number.isInteger(gapLimit)&&gapLimit>=1&&gapLimit<=50,'Invalid discovery gap');
    assert(Number.isInteger(maxIndex)&&maxIndex>=gapLimit&&maxIndex<=LIMIT,'Invalid discovery maximum');
    assert(provider&&typeof provider.request==='function','Discovery RPC provider required');
    const wallet=this.payload.wallets.find(x=>x.id===walletId);
    assert(wallet&&wallet.type==='mnemonic','Recovery phrase wallet required');
    const discovered=[];let gap=0;let scanned=0;let lastUsed=-1;
    for(let i=0;i<maxIndex;i++){
      const account=deriveMnemonicAccount420(wallet.mnemonic,i,wallet.passphrase);
      const [balance,nonce]=await Promise.all([
        provider.request('eth_getBalance',[account.address,'latest']),
        provider.request('eth_getTransactionCount',[account.address,'latest']),
      ]);
      assert(/^0x[0-9a-fA-F]+$/.test(balance)&&/^0x[0-9a-fA-F]+$/.test(nonce),'Malformed discovery RPC response');
      const used=BigInt(balance)>0n||BigInt(nonce)>0n;
      if(used){lastUsed=i;gap=0;discovered.push(account);}else{gap++;}
      scanned++;
      if(gap>=gapLimit)break;
    }
    const count=Math.max(wallet.accounts.length,lastUsed+1);
    if(count>wallet.accounts.length)await this.deriveNext(password,walletId,{count:count-wallet.accounts.length});
    return {discovered,scanned,lastUsed,complete:gap>=gapLimit,truncated:gap<gapLimit,warning:gap>=gapLimit?'Discovery stops after a gap of '+gapLimit+'. Unused accounts beyond the gap may exist; review and extend the scan manually.':'Reached the configured scan limit; further accounts may exist.'};
  }
  async setAutoLock(password,minutes){
    assert([1,5,10,15,30].includes(minutes),'Autolock must be 1, 5, 10, 15 or 30 minutes');
    await this.mutate(password,payload=>{payload.autoLockMinutes=minutes;});
  }
  async changePassword(oldPassword,newPassword){
    return serializedVaultWrite420(async()=>{
    this.ensureActive();
    const current=await stored(this.storage);
    assert(current?.revision===this.record.revision&&current?.id===this.record.id,'Vault changed in another window');
    await decryptVault420(current,oldPassword);
    passwordPolicy(newPassword);
    const encrypted=await encryptVault420(this.payload,newPassword,{id:this.record.id,revision:this.record.revision+1});
    await this.storage.set({[VAULT_STORAGE_KEY]:encrypted});
    this.record=encrypted;this.lastActive=now();
    });
  }
  async backupEncrypted(){this.ensureActive();return JSON.stringify(this.record,null,2);}
  recoveryPhrase(walletId){
    this.ensureActive();
    const wallet=this.payload.wallets.find(w=>w.id===walletId);
    assert(wallet?.type==='mnemonic','Only BIP-39 accounts have recovery phrases');
    return {phrase:wallet.mnemonic,passphrase:wallet.passphrase,passphraseUsed:Boolean(wallet.passphrase),derivedCount:wallet.accounts.length};
  }
}
export async function createVault420(storage,password){
  assert(!(await stored(storage)),'A wallet vault already exists. Unlock or restore it; do not overwrite existing keys.');
  const payload={schema:'420-wallet-secret-payload-v1',wallets:[],autoLockMinutes:5};
  const record=await encryptVault420(payload,password);
  await storage.set({[VAULT_STORAGE_KEY]:record});
  return new VaultSession420(storage,record,payload);
}
export async function unlockVault420(storage,password){
  const record=await stored(storage);
  assert(record,'No wallet vault has been created');
  const payload=await decryptVault420(record,password);
  return new VaultSession420(storage,record,payload);
}
export async function hasVault420(storage){return Boolean(await stored(storage));}
export async function restoreEncryptedBackup420(storage,json,password){
  assert(typeof json==='string'&&json.length<3*1024*1024,'Invalid encrypted backup');
  assert(!(await stored(storage)),'Existing vault must never be overwritten by an import');
  const record=JSON.parse(json);
  await decryptVault420(record,password);
  await storage.set({[VAULT_STORAGE_KEY]:record});
  return unlockVault420(storage,password);
}
