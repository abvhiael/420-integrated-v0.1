import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserExecutionController,BrowserExecutionError,assertExecutableRuntime} from '../core/browser-execution-controller.js';
const account='0x'+'11'.repeat(20);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'}};
function provider(){
 const listeners=new Map();const calls=[];
 return {calls,listeners,on(name,cb){listeners.set(name,cb);},removeListener(name,cb){if(listeners.get(name)===cb)listeners.delete(name);},async request({method}){
  calls.push(method);
  if(method==='eth_requestAccounts'||method==='eth_accounts') return [account];
  if(method==='eth_chainId') return '0x420';
  throw Error('unexpected '+method);
 }};
}
test('V15.11 refuses executable requests without resolved testnet metadata',async()=>{
 assert.throws(()=>assertExecutableRuntime(null),e=>e.code==='DEPLOYMENT_UNRESOLVED');
 assert.throws(()=>assertExecutableRuntime({deployment:{status:'RESOLVED',environment:'production'},network:{chainId:'0x420'}}),e=>e.code==='DEPLOYMENT_UNRESOLVED');
 const control=new BrowserExecutionController({runtime:null});
 await assert.rejects(control.submit({}),e=>e.code==='WALLET_UNAVAILABLE');
 control.dispose();
});
test('explicit selection required with more than one announced provider',async()=>{
 const one=provider(),two=provider();
 const control=new BrowserExecutionController({runtime});
 control.announce({info:{uuid:'one',rdns:'one.wallet',name:'One'},provider:one});
 control.announce({info:{uuid:'two',rdns:'two.wallet',name:'Two'},provider:two});
 await assert.rejects(control.connect({}),e=>e.code==='WALLET_SELECTION_REQUIRED');
 const connected=await control.connect({selectedId:'eip6963:two'});
 assert.equal(connected.account,account);
 assert.equal(two.calls.includes('eth_requestAccounts'),true);
 assert.equal(one.calls.length,0);
 control.dispose();
 assert.equal(two.listeners.size,0);
});
test('account or chain events invalidate reviewed generation and dispose cleans listeners',async()=>{
 const injected=provider(),invalidated=[];
 const control=new BrowserExecutionController({runtime,onInvalidate:reason=>invalidated.push(reason)});
 await control.connect({ethereum:injected});
 const generation=control.wallet.session.generation;
 injected.listeners.get('accountsChanged')(['0x'+'22'.repeat(20)]);
 assert.ok(control.wallet.session.generation>generation);
 assert.deepEqual(invalidated,['accountsChanged']);
 await assert.rejects(control.assertLiveSession(),e=>e.code==='ACCOUNT_MISMATCH');
 control.dispose();
 assert.equal(injected.listeners.size,0);
});
test('no fixture or bare review may authorize signing or sending',async()=>{
 const injected=provider(),control=new BrowserExecutionController({runtime});
 await control.connect({ethereum:injected});
 await assert.rejects(control.submit({}),e=>e.code==='REVIEW_REQUIRED');
 await assert.rejects(control.signOrder({}),e=>e.code==='QUALIFICATION_REQUIRED');
 assert.equal(injected.calls.includes('eth_sendTransaction'),false);
 assert.equal(injected.calls.includes('eth_signTypedData_v4'),false);
 control.dispose();
});
