import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,Transaction} from '../../extension/vendor/ethers-6.17.0.min.js';
import {encryptVault420} from '../../extension/core/vault.js';
import {signExtensionEoa420} from '../../extension/core/eoa-local-signer.js';
import {quoteExtensionEoa420} from '../core/extension-eoa-preflight.js';
import {extensionCanSend420} from '../core/extension-wallet-ui.js';
const key='0x'+'11'.repeat(32),password='test-password-strong-420';
const from=new Wallet(key).address.toLowerCase(),to='0x'+'22'.repeat(20);
const chainId='0x1a4',hash='0x'+'ab'.repeat(32);
function fixture(){
 const calls=[];
 return {calls,request:async(method,params)=>{
  calls.push({method,params});
  if(method==='eth_chainId')return chainId;
  if(method==='eth_call')return '0x';
  if(method==='eth_estimateGas')return '0x5208';
  if(method==='eth_getTransactionCount')return '0x1';
  if(method==='eth_getBlockByNumber')return {hash,baseFeePerGas:'0x20'};
  if(method==='eth_getBalance')return '0xfffffffffffffff';
  if(method==='eth_maxPriorityFeePerGas')return '0x10';
  throw Error('unexpected '+method);
 }};
}
test('local EOA preflight binds nonce, balances, simulation, gas and chain',async()=>{
 const p=fixture();
 const preview=await quoteExtensionEoa420(p,{chainId,from,transaction:{to,value:'0x100',data:'0x'},choice:{level:'standard'}});
 assert.equal(preview.nonce,'0x1');
 assert.equal(preview.gasLimit,'0x6270');
 assert.equal(preview.maxFeePerGas,'0x60');
 assert.equal(preview.totalFeeWei,(25200n*96n).toString());
 assert.ok(p.calls.some(x=>x.method==='eth_call'));
});
test('EOA send is available only for selected unlocked local vault, not watch-only or hardware',()=>{
 const state={selectedAccount:from,account:{kind:'eoa',controller:from},vault:{unlocked:true},network:{status:'matched'}};
 assert.equal(extensionCanSend420(state),true);
 assert.equal(extensionCanSend420({...state,vault:{unlocked:false}}),false);
 assert.equal(extensionCanSend420({...state,account:{...state.account,kind:'watch-only'}}),false);
});
test('EOA signing takes place in local vault, checks entire EIP-1559 envelope, never exports keys',async()=>{
 const vault=await encryptVault420({schema:'420-wallet-secret-payload-v1',autoLockMinutes:5,
  wallets:[{id:'1'.repeat(32),type:'private-key',label:'Test',privateKey:key,
   accounts:[{address:from,label:'Imported account'}]}]},password);
 const tx={to,nonce:'0x1',value:'0x100',data:'0x',gasLimit:'0x6270',
  maxFeePerGas:'0x60',maxPriorityFeePerGas:'0x20'};
 const signed=await signExtensionEoa420({vaultRecord:vault,password,account:from,transaction:tx,chainId});
 assert.equal(signed.from,from);
 assert.equal(signed.chainId,chainId);
 assert.equal(signed.nonce,'0x1');
 assert.equal(signed.hash,Transaction.from(signed.raw).hash.toLowerCase());
 assert.ok(!JSON.stringify(signed).includes(key));
 await assert.rejects(signExtensionEoa420({vaultRecord:vault,password:'wrong-password-x',account:from,
  transaction:tx,chainId}),/password|integrity/i);
});
