import test from 'node:test';
import assert from 'node:assert/strict';

const origin='https://wallet.420integrated.org';
const subject='12345678-1234-4123-8123-123456789abc';
const verified={authenticated:true,app:'420wallet',subject,financialAuthority:false,permissions:[]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const reply=(body,status=200)=>({status,headers:{get:name=>name.toLowerCase()==='content-type'?'application/json':null},json:async()=>body});
let serial=0;

async function fixture(t,active=verified){
  const originalFetch=globalThis.fetch;
  const originalWindow=globalThis.window;
  const originalDocument=globalThis.document;
  let result=active;
  const calls=[],events=[];
  globalThis.window={dispatchEvent:event=>{events.push(event.type);return true}};
  delete globalThis.document;
  globalThis.fetch=async(url,opts)=>{
    calls.push({url,opts});
    return reply(url.endsWith('/logout')?{signedOut:true}:result);
  };
  const module=await import('../420id-session-ui.mjs?walletSessionTest='+ ++serial);
  const elements=Object.fromEntries(['status','login','logout','refresh'].map(key=>[key,{
    hidden:false,textContent:'',events:new Map(),setAttribute(k,v){this[k]=v},
    addEventListener(key,fn){this.events.set(key,fn)},
    click(){this.events.get('click')?.()}
  }]));
  const root={hidden:true,dataset:{},querySelector:(s)=>elements[s.match(/\[data-420id-(.*?)\]/)?.[1]]};
  t.after(()=>{
    globalThis.fetch=originalFetch;
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  });
  return {module,root,elements,calls,events,set:(next)=>{result=next}};
}

test('Wallet 420ID is disabled by default and cannot grant transaction signing authority',async t=>{
  const f=await fixture(t);
  assert.deepEqual(f.module.wallet420IDSessionState(),{enabled:false,authenticated:false,subject:null,generation:0});
  assert.equal(f.module.installWallet420IDUi({runtimeConfig:{identitySession:{enabled:false}},root:f.root,origin}).enabled,false);
  assert.equal(f.root.hidden,true);
  assert.equal(f.calls.length,0);
  const calls=[];
  const provider={request:async(method)=>{calls.push(method);return 'no privileged action'}};
  const guarded=f.module.guardWallet420IDProvider({...provider,on:()=>false,removeListener:()=>{}});
  assert.equal(await guarded.request('eth_sendTransaction',[]),'no privileged action');
  assert.deepEqual(calls,['eth_sendTransaction']); // independent on-chain Wallet authority is unchanged when SSO is off
});

test('Wallet 420ID refuses any alternate origin even with seemingly valid session',async t=>{
  const f=await fixture(t);
  assert.throws(()=>f.module.installWallet420IDUi({runtimeConfig:{identitySession:{enabled:true}},root:f.root,origin:'http://127.0.0.1:18780'}),/origin/);
  assert.equal(f.calls.length,0);
  await assert.rejects(f.module.verifyWallet420IDSession(),/unverified|configured/);
});

test('Wallet 420ID session is authenticated by fresh same-origin server introspection, never browser bearer',async t=>{
  const f=await fixture(t);
  f.module.installWallet420IDUi({runtimeConfig:{identitySession:{enabled:true}},root:f.root,origin});
  await flush();
  assert.equal(f.root.hidden,false);
  assert.equal(f.elements.login.href,'/420id-api/auth/start');
  assert.deepEqual(await f.module.verifyWallet420IDSession(),{app:'420wallet',subject});
  const methods=[];
  const provider={request:async(method)=>{methods.push(method);return 'SIGNED_BY_REAL_DEVICE_NOT_420ID'},
    requestAccounts:async()=>[],chainId:async()=> '0x1a4',on:()=>false,removeListener:()=>{}};
  const guarded=f.module.guardWallet420IDProvider(provider);
  assert.equal(await guarded.request('eth_sendTransaction',[{from:'0xabc'}]),'SIGNED_BY_REAL_DEVICE_NOT_420ID');
  assert.deepEqual(methods,['eth_sendTransaction']);
  assert.ok(f.calls.every(x=>x.opts?.credentials==='same-origin' && x.opts?.cache==='no-store' &&
    !x.opts?.headers?.Authorization && x.opts?.body===undefined));
  assert.ok(f.calls.every(x=>x.url==='/420id-api/auth/session'));
  assert.equal(f.module.wallet420IDSessionState().authenticated,true);
});

test('Central SSO revocation, financial-rights forgery, and account substitution fail closed before signing',async t=>{
  const f=await fixture(t);
  f.module.installWallet420IDUi({runtimeConfig:{identitySession:{enabled:true}},root:f.root,origin});
  await flush();
  let sends=0;
  const guarded=f.module.guardWallet420IDProvider({request:async()=>{sends++;return '0x'+'aa'.repeat(32)},
    requestAccounts:async()=>[],chainId:async()=> '0x1a4',on:()=>false,removeListener:()=>{}});
  f.set({authenticated:false});
  await assert.rejects(guarded.request('eth_sendTransaction',[]),/revoked|changed/);
  assert.equal(sends,0);
  assert.ok(f.events.includes('wallet420id:invalidated'));
  f.set({...verified,financialAuthority:true});
  await assert.rejects(guarded.request('personal_sign',[]),/unavailable|revoked|changed/);
  f.set({...verified,subject:'98765432-4321-4123-8123-123456789abc',financialAuthority:false});
  await assert.rejects(guarded.request('eth_signTypedData_v4',[]),/unavailable|revoked|changed/);
  assert.equal(sends,0);
});

test('A changed 420ID account cannot inherit an older authenticated browser session',async t=>{
  const f=await fixture(t);
  f.module.installWallet420IDUi({runtimeConfig:{identitySession:{enabled:true}},root:f.root,origin});
  await flush();
  await f.module.verifyWallet420IDSession();
  const before=f.module.wallet420IDSessionState();
  f.set({...verified,subject:'98765432-4321-4123-8123-123456789abc'});
  await assert.rejects(f.module.verifyWallet420IDSession(),/changed/);
  const after=f.module.wallet420IDSessionState();
  assert.equal(after.authenticated,false);
  assert.ok(after.generation>before.generation);
  assert.ok(f.events.includes('wallet420id:invalidated'));
});
