import {installMockWebLocks420} from './support/mock-browser-locks.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {Wallet} from '../../extension/vendor/ethers-6.17.0.min.js';
import {createVault420,unlockVault420} from '../../extension/core/vault.js';
import {extensionCanSend420,extensionReceiveAddress420} from '../core/extension-wallet-ui.js';
globalThis.crypto ??= webcrypto;
installMockWebLocks420();
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../extension');
const read=name=>readFileSync(resolve(root,name),'utf8');
const password='Correct horse battery staple 420';
const phrase='test test test test test test test test test test test junk';
const watch='0x2222222222222222222222222222222222222222';
class MemoryStorage {
 constructor(){this.data={};}
 async get(key){return {[key]:this.data[key]};}
 async set(object){Object.assign(this.data,structuredClone(object));}
}
test('M2: account labels, visibility, watch-only status survive lock and restoration',async()=>{
 const storage=new MemoryStorage(),vault=await createVault420(storage,password);
 const created=await vault.importMnemonic(password,phrase,{accountCount:2});
 await vault.updateAccount(password,created.id,created.accounts[0].address,{label:'My primary EOA',hidden:true});
 const observed=await vault.addWatchOnly(password,watch,{label:'Treasury observer'});
 assert.equal(vault.accounts().length,3);
 assert.equal(vault.accounts()[0].hidden,true);
 assert.equal(vault.accounts()[0].label,'My primary EOA');
 assert.equal(vault.accounts()[2].accountClass,'watch-only');
 assert.equal(vault.accounts()[2].address,watch);
 assert.throws(()=>vault.exportPrivateKey(observed.id,watch),/no locally exportable/);
 assert.ok(!JSON.stringify(storage.data).includes(phrase));
 vault.lock();
 assert.throws(()=>vault.accounts(),/locked/);
 const restored=await unlockVault420(storage,password);
 assert.equal(restored.accounts()[0].label,'My primary EOA');
 assert.equal(restored.accounts()[0].hidden,true);
 assert.equal(restored.accounts()[2].accountClass,'watch-only');
 await assert.rejects(()=>restored.addWatchOnly(password,watch),/already exists/);
 await assert.rejects(()=>restored.updateAccount('invalid password',created.id,created.accounts[0].address,{label:'Unauthorized'}),/password|integrity/);
 assert.equal(restored.accounts()[0].label,'My primary EOA');
});
test('M2: EOA private-key export matches chosen account; watch-only cannot export',async()=>{
 const storage=new MemoryStorage(),vault=await createVault420(storage,password);
 const derived=await vault.importMnemonic(password,phrase,{accountCount:2});
 for(const account of derived.accounts){
  const key=vault.exportPrivateKey(derived.id,account.address);
  assert.equal(new Wallet(key).address.toLowerCase(),account.address);
 }
 const pk='0x'+'11'.repeat(32),imported=await vault.importPrivateKey(password,pk);
 assert.equal(vault.exportPrivateKey(imported.id,imported.address),pk);
 assert.throws(()=>vault.exportPrivateKey(derived.id,watch),/Unknown account/);
});
test('M2: only a verified SmartAccount can send; watch-only and hardware remain read-only',()=>{
 const shared={network:{status:'matched'},account:{kind:'smart-account',controller:watch,smartAccount:watch,deployed:true,ownerVerified:true}};
 assert.equal(extensionCanSend420(shared),true);
 for(const kind of ['eoa','watch-only','hardware']){
  const state={...shared,account:{...shared.account,kind,receiveAddress:watch}};
  assert.equal(extensionCanSend420(state),false);
  assert.equal(extensionReceiveAddress420(state),watch);
 }
});
test('M2: account switching, origin permission filtering and transaction signer checks exist in trusted worker',()=>{
 const source=read('service-worker.js');
 assert.match(source,/switchSelectedAccount420/);
 assert.match(source,/return allowed.filter\(a=>a===prefs.selectedAccount\)/);
 assert.match(source,/Account selection or permission changed/);
 assert.match(source,/Requested signer is not the currently selected authorized account/);
 assert.match(source,/notifyDisconnectedSite420\(origin\)/);
 assert.match(source,/Untrusted account manager/);
 assert.match(source,/accountMeta/);
 assert.match(source,/activity:\(await refreshWalletUiActivity420\(\)\).filter/);
});
test('M2: account manager never exports keys to service worker; deliberate password authentication precedes reveal',()=>{
 const source=read('wallet.js'),html=read('wallet.html');
 assert.match(source,/decryptVault420\(session.record,old\)/);
 assert.match(source,/session.exportPrivateKey\(exportTarget.walletId,exportTarget.address\)/);
 assert.match(source,/addWatchOnly/);
 assert.match(source,/updateAccount/);
 assert.match(html,/id="watch-form"/);
 assert.match(html,/id="add-watch"/);
 assert.doesNotMatch(read('service-worker.js'),/exportPrivateKey\(/);
 assert.doesNotMatch(read('popup.js'),/exportPrivateKey\(/);
});
