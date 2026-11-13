import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createVault420,restoreEncryptedBackup420,unlockVault420,VAULT_STORAGE_KEY,
  validateVaultEnvelope420,encryptVault420,decryptVault420} from '../../extension/core/vault.js';
import {createExtensionRpcRouter420} from '../core/extension-rpc-router.js';
import {validateEoaReplacement420} from '../core/extension-replacement-policy.js';
import {inspectExtensionApprovalRisk420} from '../core/extension-approval-risk.js';
import {chainId420,endpoint420} from '../../extension/core/network-registry.js';
const SECRET='this-is-a-long-wallet-password-420';
const ACCOUNT='0x'+'11'.repeat(20),DEST='0x'+'22'.repeat(20);
let chain=Promise.resolve();
const locks={request:async(_name,_options,action)=>{
 const previous=chain,gate={};gate.promise=new Promise(r=>gate.release=r);
 chain=previous.then(()=>gate.promise);
 await previous;try{return await action()}finally{gate.release()}
}};
function setSecureGlobals(){
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
}
function storage(){
 const data={};return {data,async get(key){return {[key]:data[key]??null}},
 async set(values){Object.assign(data,values)}};
}
test('vault fails closed on missing cross-window Web Locks API',async()=>{
 setSecureGlobals();const store=storage();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
 await assert.rejects(()=>createVault420(store,SECRET),/Secure cross-window vault lock unavailable/);
 assert.equal(store.data[VAULT_STORAGE_KEY],undefined);
 setSecureGlobals();
});
test('concurrent vault creation cannot overwrite another window or change recovered key inventory',async()=>{
 setSecureGlobals();const store=storage();
 const results=await Promise.allSettled([createVault420(store,SECRET),createVault420(store,SECRET)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.match(results.find(x=>x.status==='rejected').reason.message,/already exists/);
 assert.equal((await unlockVault420(store,SECRET)).accounts().length,0);
});
test('locked vault rejects cross-window stale encrypted writes and preserves revision on conflict',async()=>{
 setSecureGlobals();const s=storage();const one=await createVault420(s,SECRET);
 const two=await unlockVault420(s,SECRET);
 await one.addWatchOnly(SECRET,ACCOUNT);
 await assert.rejects(()=>two.addWatchOnly(SECRET,DEST),/changed in another window/);
 assert.equal((await unlockVault420(s,SECRET)).accounts()[0].address,ACCOUNT);
});
test('AES-GCM vault authentication rejects tampered IV, ciphertext, revision, KDF downgrades and wrong password',async()=>{
 setSecureGlobals();const s=storage(),session=await createVault420(s,SECRET);
 const original=s.data[VAULT_STORAGE_KEY],json=JSON.stringify(original);
 assert.equal(json.includes(SECRET),false);
 const wrong={...original,kdf:{...original.kdf,iterations:1000}};
 assert.throws(()=>validateVaultEnvelope420(wrong),/strength/);
 const mutation={...original,revision:original.revision+1};
 await assert.rejects(()=>decryptVault420(mutation,SECRET),/integrity/);
 const tag={...original,ciphertext:original.ciphertext.slice(0,-3)+'AAA'};
 await assert.rejects(()=>decryptVault420(tag,SECRET));
 await assert.rejects(()=>decryptVault420(original,'wrong-but-long-enough'),/integrity/);
 session.lock();
 assert.throws(()=>session.accounts(),/locked/);
});
test('encrypted restore refuses an existing vault and cannot race with create',async()=>{
 setSecureGlobals();const store=storage(),one=await createVault420(store,SECRET);
 const archive=await one.backupEncrypted();
 await assert.rejects(()=>restoreEncryptedBackup420(store,archive,SECRET),/Existing vault/);
 const target=storage();
 const results=await Promise.allSettled([createVault420(target,SECRET),restoreEncryptedBackup420(target,archive,SECRET)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.ok(target.data[VAULT_STORAGE_KEY]);
});
test('sensitive source contains no RPC or telemetry key-exfiltration sink',async()=>{
 const authority=await readFile(new URL('../../extension/authority.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../../extension/service-worker.js',import.meta.url),'utf8');
 const signer=await readFile(new URL('../../extension/core/eoa-local-signer.js',import.meta.url),'utf8');
 const bridge=await readFile(new URL('../../extension/content-script.js',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/decryptVault420|signExtensionEoaMessage420|signExtensionEoa420\(/);
 assert.doesNotMatch(bridge,/privateKey|mnemonic|password|secretKey|BIP39/);
 assert.doesNotMatch(authority,/fetch\([^)]*privateKey|console\.log\([^\n]*(?:mnemonic|privateKey|password)/);
 assert.doesNotMatch(signer,/console\.(?:log|debug|info)\(|localStorage|sendMessage|fetch\(/);
 assert.match(worker,/sensitive wallet methods cannot use RPC signing or submission authority/);
});
test('malicious RPC endpoint, chain spoof and insecure URL are rejected before signing',()=>{
 assert.equal(chainId420('0x1a4'),'0x1a4');
 for(const url of ['http://evil.example.org','https://user:pw@rpc.example.org','https://rpc.example.org/#fragment'])
  assert.throws(()=>endpoint420(url));
 for(const id of ['0x0','420','0x-1'])assert.throws(()=>chainId420(id));
});
test('malicious infinite allowance and NFT operator grant require critical risk review',()=>{
 const encoded='0x095ea7b3'+'0'.repeat(24)+DEST.slice(2)+'f'.repeat(64);
 const assessed=inspectExtensionApprovalRisk420({data:encoded});
 assert.equal(assessed.unlimited,true);assert.equal(assessed.severity,'critical');
 assert.throws(()=>inspectExtensionApprovalRisk420({data:'0x095ea7b3dead'}),/malformed/);
});
test('EOA replacement replay cannot cross execution models, nonces, chains or unbumped fees',()=>{
 const original={hash:'0x'+'aa'.repeat(32),from:ACCOUNT,to:DEST,nonce:'0x1',
   chainId:'0x1a4',executionModel:'eoa',status:'submitted',action:'speed-up',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x32',value:'0x0',data:'0x'};
 const changed={...original,maxFeePerGas:'0x80',maxPriorityFeePerGas:'0x40'};
 assert.doesNotThrow(()=>validateEoaReplacement420(original,changed));
 for(const delta of [{chainId:'0x1'},{nonce:'0x2'},{executionModel:'erc4337'},
  {from:DEST},{maxFeePerGas:'0x65'},{maxPriorityFeePerGas:'0x33'}]){
  assert.throws(()=>validateEoaReplacement420(original,{...changed,...delta}));
 }
});
