import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletSession} from '../core/wallet-session.js';
import {discoverWalletProviders,selectWalletProvider,verifyWalletSnapshot,inspectWalletCompatibility} from '../core/wallet-compatibility.js';
const account=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const provider=(chain='0x420',accounts=[account(1)])=>({request:async({method})=>{
  if(method==='eth_chainId') return chain;
  if(method==='eth_accounts') return accounts;
  throw Error('unsupported');
}});
test('one injected provider is selectable without extension-brand assumptions',()=>{
 const p=provider();const items=discoverWalletProviders({ethereum:p});
 assert.equal(items.length,1);assert.equal(selectWalletProvider(items).provider,p);
});
test('multiple injected providers require deliberate selection, never silently take first',()=>{
 const a=provider(),b=provider();const items=discoverWalletProviders({ethereum:{providers:[a,b]}});
 assert.equal(items.length,2);
 assert.throws(()=>selectWalletProvider(items),e=>e.code==='WALLET_SELECTION_REQUIRED');
 assert.equal(selectWalletProvider(items,{selectedId:'legacy:1'}).provider,b);
 assert.throws(()=>selectWalletProvider(items,{selectedId:'missing'}),e=>e.code==='WALLET_SELECTION_INVALID');
});
test('EIP-6963 announcements are deduplicated with legacy providers and malformed metadata ignored',()=>{
 const p=provider(),q=provider();const items=discoverWalletProviders({ethereum:{providers:[p,q]},announcements:[
  {provider:p,info:{uuid:'wallet-1',rdns:'org.example.wallet',name:'Example'}},
  {provider:q,info:{uuid:'',rdns:'bad',name:'Bad'}},
 ]});
 assert.equal(items.length,2);assert.equal(items[0].id,'eip6963:wallet-1');
});
test('wallet inspection is read-only and requires correct chain and account for submission',async()=>{
 const good=await inspectWalletCompatibility(provider(),{expectedChainId:'0x420'});
 assert.equal(good.canSubmit,true);
 assert.equal((await inspectWalletCompatibility(provider('0x421'),{expectedChainId:'0x420'})).canSubmit,false);
 assert.equal((await inspectWalletCompatibility(provider('0x420',[]),{expectedChainId:'0x420'})).canSubmit,false);
});
test('snapshot rejects chain change, account change, disconnect and generation invalidation',()=>{
 const s=new WalletSession();s.connected({account:account(1),chainId:'0x420'});
 const generation=s.generation;
 assert.deepEqual(verifyWalletSnapshot({session:s,generation,chainId:'0x420',accounts:[account(1)]}),{ok:true,reason:null});
 assert.equal(verifyWalletSnapshot({session:s,generation,chainId:'0x421',accounts:[account(1)]}).reason,'CHAIN_MISMATCH');
 assert.equal(verifyWalletSnapshot({session:s,generation,chainId:'0x420',accounts:[account(2)]}).reason,'ACCOUNT_MISMATCH');
 assert.equal(verifyWalletSnapshot({session:s,generation,chainId:'0x420',accounts:[]}).reason,'WALLET_DISCONNECTED');
 s.accountChanged(account(2));
 assert.equal(verifyWalletSnapshot({session:s,generation,chainId:'0x420',accounts:[account(1)]}).reason,'STALE_SESSION');
});
test('unsupported or disconnected providers fail closed',async()=>{
 assert.throws(()=>selectWalletProvider([]),e=>e.code==='WALLET_UNAVAILABLE');
 await assert.rejects(inspectWalletCompatibility({request:async()=>{throw Object.assign(Error('offline'),{code:4900});}},{expectedChainId:'0x420'}),e=>e.code==='WALLET_RPC_UNAVAILABLE');
});
