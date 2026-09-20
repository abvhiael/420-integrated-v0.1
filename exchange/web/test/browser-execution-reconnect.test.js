import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
const account='0x'+'11'.repeat(20);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'}};
function provider(){
 const listeners=new Map(),calls=[];
 return {listeners,calls,on(name,fn){listeners.set(name,fn);},removeListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},async request({method}){
  calls.push(method);
  if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
  if(method==='eth_chainId')return '0x0420';
  throw Error('unexpected RPC '+method);
 }};
}
function target(){
 const listeners=new Map();
 return {listeners,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},dispatchEvent(){}};
}
test('EIP-6963 discovery remains registered after connect and provider switch; dispose cleans all listeners',async()=>{
 const first=provider(),second=provider(),events=target();
 const controller=new BrowserExecutionController({runtime});
 controller.listen(events,first);
 assert.equal(events.listeners.has('eip6963:announceProvider'),true);
 await controller.connect({ethereum:first});
 assert.equal(events.listeners.has('eip6963:announceProvider'),true);
 events.listeners.get('eip6963:announceProvider')({detail:{info:{uuid:'second',rdns:'second.wallet',name:'Second'},provider:second}});
 assert.equal(controller.discover(first).length,2);
 await controller.connect({ethereum:first,selectedId:'eip6963:second'});
 assert.equal(events.listeners.has('eip6963:announceProvider'),true);
 assert.equal(first.listeners.size,0);
 controller.dispose();
 assert.equal(second.listeners.size,0);
 assert.equal(events.listeners.size,0);
});
test('changing wallet while connect is pending rejects stale connection',async()=>{
 const first=provider(),second=provider();
 let release;
 const original=first.request.bind(first);
 first.request=({method,...rest})=>method==='eth_requestAccounts'?new Promise(resolve=>{release=()=>resolve([account]);}):original({method,...rest});
 const controller=new BrowserExecutionController({runtime});
 const pending=controller.connect({ethereum:first});
 await controller.connect({ethereum:second});
 release();
 await assert.rejects(pending,error=>error.code==='STALE_CONNECT');
 controller.dispose();
});
test('review mismatch rejects transaction without calling gas estimate or send',async()=>{
 const injected=provider(),controller=new BrowserExecutionController({runtime});
 await controller.connect({ethereum:injected});
 const tx={kind:'SWAP',chainId:'0x420',request:{from:account,to:'0x'+'22'.repeat(20),data:'0x12345678',value:'0x0'}};
 await assert.rejects(controller.submit({transaction:tx,reviewedIntent:{kind:'SWAP',transactionFingerprint:'0x'+'00'.repeat(32)},freshness:{observedAt:1,expiresAt:2,nowSeconds:1}}),error=>error.code==='REVIEW_MISMATCH');
 assert.equal(injected.calls.includes('eth_estimateGas'),false);
 assert.equal(injected.calls.includes('eth_sendTransaction'),false);
 controller.dispose();
});
