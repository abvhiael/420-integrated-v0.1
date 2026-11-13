import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../../extension/inpage.js',import.meta.url),'utf8');
function setup({existingWallet=false}={}){
  const listeners=new Map(),messages=[],announcements=[];
  const window={
    location:{origin:'https://dapp.example'},
    ethereum:existingWallet?{isMetaMask:true}:undefined,
    addEventListener(name,fn){const a=listeners.get(name)||[];a.push(fn);listeners.set(name,a);},
    dispatchEvent(event){if(event.type==='eip6963:announceProvider')announcements.push(event.detail);for(const fn of listeners.get(event.type)||[])fn(event);},
    postMessage(msg,origin){assert.equal(origin,window.location.origin);messages.push(msg);}
  };
  const global={window,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},setTimeout,clearTimeout,Promise,TextEncoder,encodeURIComponent};
  runInNewContext(source,global,{timeout:3000});
  const detail=announcements[0];
  const respond=(req,result,error)=>{for(const fn of listeners.get('message')||[])fn({
    source:window,origin:window.location.origin,data:{
      source:'420-wallet-extension',channel:'420-wallet-provider-v1',kind:'response',id:req.id,...(error?{error}:{result})
    }});
  };
  const event=(name,data,origin=window.location.origin)=>{for(const fn of listeners.get('message')||[])fn({
    source:window,origin,data:{source:'420-wallet-extension',channel:'420-wallet-provider-v1',kind:'event',event:name,data}
  });};
  return {window,messages,announcements,detail,respond,event,listeners};
}
const owner='0x'+'11'.repeat(20);
test('EIP-6963 always announces and reannounces one provider, preserving installed MetaMask',async()=>{
  const x=setup({existingWallet:true});
  assert.equal(x.window.ethereum.isMetaMask,true);
  assert.equal(x.announcements.length,1);
  assert.equal(x.detail.info.name,'420 Wallet');
  assert.match(x.detail.info.icon,/^data:image\/svg\+xml,/);
  assert.equal(x.detail.provider.is420Wallet,true);
  x.window.dispatchEvent({type:'eip6963:requestProvider'});
  assert.equal(x.announcements.length,2);
  assert.equal(x.announcements[1].provider,x.detail.provider);
  x.respond(x.messages[0],'0x1a4');x.respond(x.messages[1],[owner]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(x.detail.provider.isConnected(),true);
  assert.equal(x.detail.provider.selectedAddress,owner);
  assert.equal(x.detail.provider.chainId,'0x1a4');
});
test('injected provider rehydrates passive account state on every navigation without requesting permissions',async()=>{
  const x=setup(),provider=x.window.ethereum;
  assert.equal(provider,x.detail.provider);
  assert.deepEqual(x.messages.map(m=>m.method),['eth_chainId','eth_accounts']);
  x.respond(x.messages[0],'0x1a4');x.respond(x.messages[1],[]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(provider.isConnected(),true);
  assert.equal(provider.selectedAddress,null);
  const events=[];
  provider.on('accountsChanged',accounts=>events.push([...accounts]));
  x.event('accountsChanged',[owner]);
  x.event('accountsChanged',[], 'https://evil.example');
  assert.equal(provider.selectedAddress,owner);
  assert.deepEqual(events,[[owner]]);
  x.event('disconnect',{code:4900,message:'offline'});
  assert.equal(provider.isConnected(),false);
  assert.equal(provider.selectedAddress,null);
});
test('inpage request preserves provider errors, validates parameters and isolates IDs',async()=>{
 const x=setup(),provider=x.detail.provider;
 x.respond(x.messages[0],'0x1');x.respond(x.messages[1],[]);
 await new Promise(resolve=>setImmediate(resolve));
 const promise=provider.request({method:'personal_sign',params:['0x6869',owner]});
 const msg=x.messages.at(-1);
 assert.equal(msg.method,'personal_sign');
 x.respond(msg,null,{code:4001,message:'User rejected'});
 await assert.rejects(promise,e=>e.code===4001);
 await assert.rejects(provider.request({method:'',params:[]}),e=>e.code===-32600);
 await assert.rejects(provider.request({method:'eth_call',params:'bad'}),e=>e.code===-32602);
});
