import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
  normalizeExtensionAddress420,normalizeExtensionChain420,normalizeExtensionRpc420,
  normalizeExtensionConfig420,extensionBalanceText420,shortExtensionAddress420,
  buildExtensionSend420,extensionCanSend420,extensionReceiveAddress420,extensionNetworkLabel420,
} from '../core/extension-wallet-ui.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../extension');
const read=name=>readFileSync(resolve(root,name),'utf8');
const ACCOUNT='0x1111111111111111111111111111111111111111';
const RECIPIENT='0x2222222222222222222222222222222222222222';
const TOKEN='0x3333333333333333333333333333333333333333';

test('W15.6: premium extension popup is a wallet not only an approval dialog',()=>{
 const html=read('popup.html');
 for(const id of ['dashboard','account-select','native-balance','asset-list','send-view',
  'receive-view','activity-view','activity-list','sites-view','site-list','settings-view',
  'approval-view','request','kind','origin','details','account-picker','account','approve','reject']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(html,/id="bottom-nav"/);
 assert.match(html,/href="#primary-content"/);
 assert.match(html,/popup\.css/);
 assert.match(read('popup.css'),/:focus-visible/);
 assert.match(read('popup.css'),/prefers-reduced-motion/);
});
test('W15.6: wallet popup requests only trusted service-worker actions',()=>{
 const js=read('popup.js');
 for(const marker of ['420-wallet-popup-ui','get-state','save-network','set-account','disconnect-site','send','get-state','approved','approval-result','delete next[approvalId]']) {
   assert.ok(js.includes(marker),'missing '+marker);
 }
 assert.match(js,/screen\('dashboard'\)/);
 assert.match(js,/extensionCanSend420/);
 assert.match(js,/extensionReceiveAddress420/);
 assert.match(js,/buildExtensionSend420/);
 assert.match(js,/navigator\.clipboard\.writeText/);
 assert.doesNotMatch(js,/eth_sendTransaction\s*\(/);
 assert.doesNotMatch(js,/localStorage/);
});
test('W15.6: manual network endpoint inputs fail closed',()=>{
 assert.equal(normalizeExtensionChain420('0x01a4'),'0x1a4');
 assert.throws(()=>normalizeExtensionChain420('420'),/hex/);
 assert.throws(()=>normalizeExtensionChain420('0x0'),/positive/);
 assert.equal(normalizeExtensionRpc420('https://example.org/rpc'),'https://example.org/rpc');
 assert.equal(normalizeExtensionRpc420('http://localhost:8545/'),'http://localhost:8545/');
 for(const value of ['http://evil.example/rpc','file:///tmp/rpc','https://name:pass@example.org/rpc','https://example.org/#secret']){
  assert.throws(()=>normalizeExtensionRpc420(value),/HTTPS|credentials/);
 }
});
test('W15.6: only provisioned accounts survive normalization and unknown addresses are blocked',()=>{
 const config=normalizeExtensionConfig420({accounts:[ACCOUNT,ACCOUNT.toUpperCase().replace('0X','0x'),'bad',RECIPIENT]});
 assert.deepEqual(config.accounts,[ACCOUNT,RECIPIENT]);
 assert.equal(normalizeExtensionAddress420(ACCOUNT),ACCOUNT);
 assert.throws(()=>normalizeExtensionAddress420('0x'+'0'.repeat(40)),/nonzero/);
 assert.throws(()=>normalizeExtensionAddress420('not-an-address'),/nonzero/);
});
test('W15.6: correct decimal formatting, ERC-20 transfer and zero-address protection',()=>{
 assert.equal(extensionBalanceText420('42000000000000000000'), '42');
 assert.equal(extensionBalanceText420('1234567890000000000'), '1.23456');
 assert.equal(extensionBalanceText420('oops'), '—');
 assert.equal(shortExtensionAddress420(ACCOUNT),'0x11111…11111');
 const send=buildExtensionSend420({from:ACCOUNT,recipient:RECIPIENT,amount:'1.5'});
 assert.deepEqual(send.transaction,{from:ACCOUNT,to:RECIPIENT,value:'0x14d1120d7b160000',data:'0x'});
 assert.equal(send.summary.amount,'1.5');
 const token=buildExtensionSend420({from:ACCOUNT,recipient:RECIPIENT,amount:'2.5',asset:TOKEN,
  trackedAssets:[{address:TOKEN,symbol:'TEST',decimals:6}]});
 assert.equal(token.transaction.to,TOKEN);
 assert.equal(token.transaction.value,'0x0');
 assert.match(token.transaction.data,/^0xa9059cbb/);
 assert.equal(token.summary.symbol,'TEST');
 assert.throws(()=>buildExtensionSend420({from:ACCOUNT,recipient:RECIPIENT,amount:'1',asset:TOKEN}),/verified asset list/);
 assert.throws(()=>buildExtensionSend420({from:ACCOUNT,recipient:ACCOUNT,amount:'0'}),/greater than zero/);
 assert.throws(()=>buildExtensionSend420({from:ACCOUNT,recipient:'0x'+'0'.repeat(40),amount:'1'}),/zero address/);
});
test('W15.6: receive and send blocked unless chain and SmartAccount are verified',()=>{
 const state={network:{status:'matched',name:'420 Test'},account:{controller:ACCOUNT,smartAccount:RECIPIENT,deployed:true,ownerVerified:true}};
 assert.equal(extensionCanSend420(state),true);
 assert.equal(extensionReceiveAddress420(state),RECIPIENT);
 assert.equal(extensionNetworkLabel420(state),'420 Test');
 assert.equal(extensionCanSend420({...state,network:{status:'wrong-chain'}}),false);
 assert.equal(extensionReceiveAddress420({...state,network:{status:'wrong-chain'}}),null);
 assert.equal(extensionCanSend420({...state,account:{...state.account,deployed:false}}),false);
 assert.equal(extensionCanSend420({...state,account:{...state.account,ownerVerified:false}}),false);
 assert.equal(extensionReceiveAddress420({network:{status:'matched'},account:{smartAccount:null}}),null);
});
test('W15.6: the background validates extension popup origin and rechecks authority before sending',()=>{
 const worker=read('service-worker.js');
 assert.match(worker,/trustedWalletPopup420\(sender\)/);
 assert.match(worker,/sender\?\.id!==chrome\.runtime\.id/);
 assert.match(worker,/url\.href\.split\('\?'\)\[0\]===chrome\.runtime\.getURL\('popup\.html'\)/);
 assert.match(worker,/confirmed!==true/);
 assert.match(worker,/extensionCanSend420\(state\)/);
 assert.match(worker,/buildExtensionSend420/);
 assert.match(worker,/executeWithLocalAuthority/);
 assert.match(worker,/rememberWalletUiActivity420/);
 assert.match(worker,/notifyDisconnectedSite420/);
 assert.match(worker,/accountsChanged/);
 assert.match(worker,/origin !== senderOrigin/);
 assert.match(worker,/sensitive wallet methods cannot use RPC signing or submission authority/);
});
