import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletController } from '../core/wallet-session.js';
import { BrowserExecutionController } from '../core/browser-execution-controller.js';

const account='0x'+'11'.repeat(20);
const runtime={network:{chainId:'0x420'},deployment:{status:'UNRESOLVED',environment:'testnet'}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function provider({deferred=false}={}){
  const listeners=new Map();let release;
  const gate=deferred?new Promise(resolve=>{release=resolve;}):null;
  const calls=[];
  return {listeners,calls,release:()=>release?.(),on(event,listener){listeners.set(event,listener);},removeListener(event,listener){if(listeners.get(event)===listener)listeners.delete(event);},async request({method}){
    calls.push(method);
    if(method==='eth_requestAccounts'){if(gate)await gate;return [account];}
    if(method==='eth_chainId')return '0x420';
    if(method==='eth_accounts')return [account];
    throw Error('unexpected RPC '+method);
  }};
}

test('disposed legacy wallet rejects late account response and unregisters its own listeners',async()=>{
  const injected=provider({deferred:true});
  const wallet=new WalletController(injected,{expectedChainId:'0x420'});
  let invalidations=0;
  wallet.bind({onInvalidate:()=>invalidations++});
  const connection=wallet.connect();
  await tick();
  wallet.dispose();
  assert.equal(injected.listeners.size,0);
  assert.equal(wallet.session.status,'DISCONNECTED');
  injected.release();
  await assert.rejects(connection,/superseded or disposed/);
  assert.equal(wallet.session.account,null);
  assert.deepEqual(injected.calls,['eth_requestAccounts'],'a disposed connection must not start chain reads');
  assert.equal(invalidations,0);
  assert.throws(()=>wallet.bind(),/disposed/);
  await assert.rejects(wallet.connect(),/disposed/);
});

test('V15 provider replacement disposes the previous wallet session even after a successful connect',async()=>{
  const one=provider(),two=provider();
  const selected=new BrowserExecutionController({runtime});
  selected.announce({info:{uuid:'one',rdns:'one.wallet',name:'One'},provider:one});
  selected.announce({info:{uuid:'two',rdns:'two.wallet',name:'Two'},provider:two});
  const previous=await selected.connect({selectedId:'eip6963:one'});
  const previousWallet=selected.wallet;
  assert.equal(previous.status,'CONNECTED');
  await selected.connect({selectedId:'eip6963:two'});
  assert.equal(previousWallet.disposed,true);
  assert.equal(previous.status,'DISCONNECTED');
  assert.equal(previous.account,null);
  assert.equal(one.listeners.size,0);
  assert.equal(selected.wallet.session.status,'CONNECTED');
  selected.dispose();
  assert.equal(two.listeners.size,0);
  assert.equal(selected.wallet,null);
});
