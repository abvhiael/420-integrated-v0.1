import {installMockWebLocks420} from './support/mock-browser-locks.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {Wallet} from '../../extension/vendor/ethers-6.17.0.min.js';
import {
 VAULT_STORAGE_KEY,VAULT_SCHEMA,VAULT_PBKDF2_ITERATIONS,DERIVATION_PATH_420,
 generateMnemonic420,normalizeMnemonic420,deriveMnemonicAccount420,validatePrivateKey420,
 encryptVault420,decryptVault420,validateVaultEnvelope420,
 createVault420,unlockVault420,hasVault420,restoreEncryptedBackup420,
} from '../../extension/core/vault.js';

globalThis.crypto ??= webcrypto;
installMockWebLocks420();
class MemoryStorage{
  constructor(){this.data={};}
  async get(key){return {[key]:this.data[key]};}
  async set(values){Object.assign(this.data,structuredClone(values));}
  async remove(key){delete this.data[key];}
}
const PASSWORD='Correct horse battery staple 420';
const WRONG='the wrong password is not accepted';
const PHRASE='test test test test test test test test test test test junk';
const ADDRESS='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const KEY='0x'+'11'.repeat(32);

test('M1: pinned BIP-39 vector derives correct BIP-44 Ethereum first account',()=>{
 assert.equal(normalizeMnemonic420(PHRASE),PHRASE);
 const derived=deriveMnemonicAccount420(PHRASE,0);
 assert.equal(derived.path,DERIVATION_PATH_420+'/0');
 assert.equal(derived.address,ADDRESS);
 assert.notEqual(deriveMnemonicAccount420(PHRASE,1).address,ADDRESS);
 assert.throws(()=>normalizeMnemonic420('not a valid seed phrase'),/12- or 24-word/);
 assert.throws(()=>normalizeMnemonic420('test '.repeat(11)+'other'),/checksum|Invalid BIP/);
});
test('M1: secure entropy supports 12 and 24 words; unknown count rejected',()=>{
 for(const n of [12,24]){
   const phrase=generateMnemonic420(n);assert.equal(phrase.split(' ').length,n);
   assert.equal(normalizeMnemonic420(phrase),phrase);
 }
 assert.notEqual(generateMnemonic420(12),generateMnemonic420(12));
 assert.throws(()=>generateMnemonic420(18),/12 or 24/);
});
test('M1: password-encrypted local vault uses authenticated encryption and strong KDF',async()=>{
 const storage=new MemoryStorage();
 const session=await createVault420(storage,PASSWORD);
 assert.equal(await hasVault420(storage),true);
 assert.deepEqual(session.accounts(),[]);
 const record=storage.data[VAULT_STORAGE_KEY];
 assert.equal(record.schema,VAULT_SCHEMA);
 assert.equal(record.cipher.name,'AES-256-GCM');
 assert.equal(record.kdf.iterations,VAULT_PBKDF2_ITERATIONS);
 assert.equal(record.kdf.salt.length>30,true);
 assert.equal(record.cipher.iv.length>10,true);
 assert.ok(!JSON.stringify(record).includes(PHRASE));
 assert.deepEqual((await unlockVault420(storage,PASSWORD)).accounts(),[]);
 await assert.rejects(()=>unlockVault420(storage,WRONG),/password|integrity/);
 const changed=structuredClone(record);changed.ciphertext=changed.ciphertext.replace(/^./, changed.ciphertext[0]==='A'?'B':'A');
 await assert.rejects(()=>decryptVault420(changed,PASSWORD),/password|integrity/);
 const weaker=structuredClone(record);weaker.kdf.iterations=1000;
 assert.throws(()=>validateVaultEnvelope420(weaker),/strength/);
 await assert.rejects(()=>createVault420(storage,PASSWORD),/already exists/);
});
test('M1: mnemonic wallets with multiple accounts persist all indexes through lock/unlock',async()=>{
 const storage=new MemoryStorage();const session=await createVault420(storage,PASSWORD);
 const one=await session.importMnemonic(PASSWORD,PHRASE,{accountCount:3,label:'Recovered BIP-44'});
 assert.equal(one.accounts.length,3);
 assert.deepEqual(one.accounts.map(a=>a.index),[0,1,2]);
 const next=await session.deriveNext(PASSWORD,one.id,{count:2});
 assert.deepEqual(next.map(a=>a.index),[3,4]);
 assert.equal(session.accounts().length,5);
 assert.ok(!JSON.stringify(storage.data).includes(PHRASE));
 const backup=await session.backupEncrypted();
 session.lock();
 assert.throws(()=>session.accounts(),/locked/);
 const restored=await unlockVault420(storage,PASSWORD);
 assert.deepEqual(restored.accounts().map(a=>a.index),[0,1,2,3,4]);
 assert.equal(restored.accounts()[0].address,ADDRESS);
 assert.ok(backup.includes('ciphertext'));
 await assert.rejects(()=>restored.importMnemonic(PASSWORD,PHRASE),/already exists/);
});
test('M1: independent imported private keys remain encrypted; duplicates rejected',async()=>{
 const storage=new MemoryStorage();const session=await createVault420(storage,PASSWORD);
 const first=await session.importPrivateKey(PASSWORD,KEY);
 assert.equal(first.address,new Wallet(KEY).address.toLowerCase());
 assert.equal(session.accounts()[0].type,'private-key');
 assert.ok(!JSON.stringify(storage.data).includes(KEY));
 await assert.rejects(()=>session.importPrivateKey(PASSWORD,KEY),/already/);
 assert.throws(()=>validatePrivateKey420('0xdead'),/32-byte/);
});
test('M1: Ethereum encrypted JSON keystores are decrypted locally then re-encrypted',async()=>{
 const storage=new MemoryStorage();const session=await createVault420(storage,PASSWORD);
 const keystore=await new Wallet(KEY).encrypt('strong json keystore password');
 await session.importEncryptedKeystore(PASSWORD,keystore,'strong json keystore password');
 assert.equal(session.accounts()[0].address,new Wallet(KEY).address.toLowerCase());
 assert.ok(!JSON.stringify(storage.data).includes(KEY));
 await assert.rejects(()=>session.importEncryptedKeystore(PASSWORD,keystore,'wrong password'),/password|incorrect|invalid|could not/i);
});
test('M1: password change rejects old password and preserves account identities',async()=>{
 const storage=new MemoryStorage();const session=await createVault420(storage,PASSWORD);
 await session.importMnemonic(PASSWORD,PHRASE);
 const before=session.accounts();
 await assert.rejects(()=>session.changePassword(WRONG,'Strongly Updated Password 420'),/password|integrity/);
 await session.changePassword(PASSWORD,'Strongly Updated Password 420');
 await assert.rejects(()=>unlockVault420(storage,PASSWORD),/password|integrity/);
 session.lock();
 assert.deepEqual((await unlockVault420(storage,'Strongly Updated Password 420')).accounts(),before);
});
test('M1: encrypted backup restores exact account inventory without overwriting an existing vault',async()=>{
 const original=new MemoryStorage();const vault=await createVault420(original,PASSWORD);
 await vault.importMnemonic(PASSWORD,PHRASE,{accountCount:4});
 await vault.importPrivateKey(PASSWORD,KEY);
 const backup=await vault.backupEncrypted();
 const clean=new MemoryStorage();
 const recovered=await restoreEncryptedBackup420(clean,backup,PASSWORD);
 assert.deepEqual(recovered.accounts(),vault.accounts());
 assert.ok(!backup.includes(KEY)&&!backup.includes(PHRASE));
 await assert.rejects(()=>restoreEncryptedBackup420(original,backup,PASSWORD),/never be overwritten/);
 await assert.rejects(()=>restoreEncryptedBackup420(new MemoryStorage(),backup,WRONG),/password|integrity/);
});
test('M1: discovery inspects balances and nonces, restores used indexes, and reports limits explicitly',async()=>{
 const storage=new MemoryStorage();const vault=await createVault420(storage,PASSWORD);
 const {id}=await vault.importMnemonic(PASSWORD,PHRASE);
 const used=deriveMnemonicAccount420(PHRASE,3).address;
 const calls=[];
 const provider={async request(method,params){calls.push([method,params[0]]);return params[0]===used&&method==='eth_getTransactionCount'?'0x1':'0x0';}};
 const scan=await vault.scanMnemonic(PASSWORD,id,provider,{gapLimit:5,maxIndex:20});
 assert.deepEqual(scan.discovered.map(x=>x.index),[3]);
 assert.equal(scan.complete,true);
 assert.equal(scan.truncated,false);
 assert.equal(vault.accounts().length,4);
 assert.match(scan.warning,/Unused accounts beyond the gap/);
 const truncated=await vault.scanMnemonic(PASSWORD,id,provider,{gapLimit:5,maxIndex:5});
 assert.equal(truncated.truncated,true);
 assert.match(truncated.warning,/further accounts may exist/);
 assert.ok(calls.length>10);
});
test('M1: collision and malformed RPC response fail without persisting false discoveries',async()=>{
 const storage=new MemoryStorage();const vault=await createVault420(storage,PASSWORD);
 const {id}=await vault.importMnemonic(PASSWORD,PHRASE);
 const before=vault.accounts();
 await assert.rejects(()=>vault.scanMnemonic(PASSWORD,id,{request:async()=> 'wrong'},{gapLimit:3,maxIndex:9}),/Malformed/);
 assert.deepEqual(vault.accounts(),before);
 await assert.rejects(()=>vault.importMnemonic(PASSWORD,PHRASE,{passphrase:'',accountCount:1}),/already exists/);
});
test('M1: concurrent edit protection, lock and inactivity policy',async()=>{
 const storage=new MemoryStorage();const first=await createVault420(storage,PASSWORD);
 const second=await unlockVault420(storage,PASSWORD);
 await first.importPrivateKey(PASSWORD,KEY);
 await assert.rejects(()=>second.importMnemonic(PASSWORD,PHRASE),/changed in another window/);
 const v=await unlockVault420(storage,PASSWORD);
 await v.setAutoLock(PASSWORD,1);
 assert.equal(v.policy(),1);
 v.lastActive=Date.now()-62000;
 assert.throws(()=>v.accounts(),/auto-locked/);
 assert.throws(()=>v.accounts(),/locked/);
});
