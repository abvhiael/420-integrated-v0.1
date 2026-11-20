import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeTokenWalletConfig420,discoverWalletTokenRuntime420,createTokenDiscoverySession420} from '../core/token-app.js';
import {validateRuntimeConfig} from '../core/config.js';
import {encodeGetAddress,encodeAddressGetter,encodeUintGetter,ZERO_ADDRESS,ZERO_BYTES32} from '../core/abi.js';
import {TOKEN_SERVICE_ID_420} from '../core/token-runtime.js';
import {TOKEN_TEMPLATES_420} from '../core/token-sdk.js';
import {fixture,abi,addr,digest,controller,account,state,serviceHash} from './token-test-fixture.js';

import {connected} from './token-connected-fixture.js';

const refresh=(session,f)=>session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
const discover=f=>discoverWalletTokenRuntime420(f.provider,f.config,controller,f.selected);

test('offline Wallet production defaults contain no Token release candidate or live address',async()=>{
  const config=JSON.parse(await readFile(new URL('../runtime-config.json',import.meta.url),'utf8'));
  assert.equal(config.token,null);
  assert.equal(normalizeTokenWalletConfig420(config),null);
  assert.equal(validateRuntimeConfig(config),true);
  const session=createTokenDiscoverySession420();
  const snapshot=await session.refresh({config,provider:{request(){throw Error('unexpected RPC')}}});
  assert.equal(snapshot.status,'unconfigured');
  assert.equal(snapshot.runtime,undefined);
});

test('same-origin Wallet config requires full approved release, environment, chain and shared authority binding',()=>{
  const f=connected();
  assert.equal(validateRuntimeConfig(f.config),true);
  assert.equal(normalizeTokenWalletConfig420(f.config).binding.factory.address,f.binding.factory.address);
  for(const [mutate,pattern] of [
    [c=>{c.token.environment='mainnet'},/environment/],
    [c=>{c.network.chainId='0x1'},/chain differs/],
    [c=>{c.deployment.protocolRegistryAddress=addr(123)},/ProtocolRegistry differs/],
    [c=>{c.deployment.capabilityRegistryAddress=addr(123)},/CapabilityRegistry differs/],
    [c=>{c.deployment.entryPointAddress=null},/address/],
    [c=>{c.smartAccount.factoryAddress=null},/address/],
    [c=>{c.token.binding.release.dependencyRoot=digest(999)},/root mismatch/],
    [c=>{c.token.binding=f.binding.factory},/service id/],
    [c=>{c.token.approved=true},/malformed Wallet Token/],
  ]){
    const c=structuredClone(f.config);mutate(c);
    assert.throws(()=>validateRuntimeConfig(c),pattern);
  }
});

test('connected Wallet discovers the active Registry release, all template profiles and fresh selected SmartAccount',async()=>{
  const f=connected();
  const result=await discover(f);
  assert.equal(result.status,'verified');
  assert.equal(result.controller,controller);
  assert.equal(result.smartAccount,account);
  assert.equal(result.controllerIsOwner,true);
  assert.equal(result.runtime.factory.address,f.binding.factory.address);
  assert.equal(result.runtime.templates.length,8);
  assert.equal(result.verificationBlock.hash,f.tokenControl.tipHash);
  assert.equal(result.authority,'DISCOVERY_ONLY');
  assert.equal(result.accountGrant,false);
  assert.equal(result.spendingAuthority,false);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.runtime));
  assert.equal(f.calls.filter(x=>x[0]==='eth_accounts').length,2);
  assert.ok(f.calls.every(x=>['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(x[0])));
  assert.ok(f.calls.some(([m,args])=>m==='eth_call'&&args[0].to===state.factoryAddress));
});

test('counterfactual account discovery and non-owner accounts remain read-only',async()=>{
  const counter=connected();counter.control.accountDeployed=false;counter.selected.deployed=false;
  const x=await discover(counter);
  assert.equal(x.deployed,false);assert.equal(x.controllerIsOwner,false);assert.equal(x.spendingAuthority,false);
  const nonowner=connected();nonowner.control.owner=addr(333);
  const y=await discover(nonowner);
  assert.equal(y.deployed,true);assert.equal(y.controllerIsOwner,false);assert.equal(y.spendingAuthority,false);
});

test('discovery rejects changed controller, account, chain, missing factory, wrong EntryPoint and capability bindings',async()=>{
  for(const [mutate,pattern] of [
    [f=>{f.control.accounts=[]},/account changed or disconnected/],
    [f=>{f.control.accounts=[addr(222)]},/account changed or disconnected/],
    [f=>{f.selected.controller=addr(222)},/controller mismatch/],
    [f=>{f.selected.expectedChainId='0x1'},/account chain mismatch/],
    [f=>{f.tokenControl.chain='0x1'},/chain/],
    [f=>{f.control.account=addr(333)},/SmartAccount changed/],
    [f=>{f.control.accountDeployed=false},/SmartAccount changed/],
    [f=>{f.control.factoryDeployed=false},/not deployed/],
    [f=>{f.control.entryPoint=addr(333)},/EntryPoint binding/],
    [f=>{f.control.capabilityRegistry=addr(333)},/CapabilityRegistry binding/],
  ]){
    const f=connected();mutate(f);
    await assert.rejects(discover(f),pattern);
  }
});

test('discovery rejects late account, chain, canonical-block changes after runtime verification',async()=>{
  for(const [mutate,pattern] of [
    [f=>{f.control.accounts=[addr(42)]},/account changed/],
    [f=>{f.tokenControl.chain='0x1'},/chain/],
    [f=>{f.tokenControl.canonicalHash=digest(42)},/block reorganized/],
  ]){
    const f=connected();
    f.control.afterAccountRead=()=>mutate(f);
    await assert.rejects(discover(f),pattern);
  }
});

test('Registry deactivation, wrong code, disabled templates and RPC failure are handled without stale availability',async()=>{
  const f=connected(),session=createTokenDiscoverySession420();
  assert.equal((await refresh(session,f)).status,'verified');
  f.enable(TOKEN_TEMPLATES_420[0],false);
  const disabled=await refresh(session,f);
  assert.equal(disabled.status,'verified');
  assert.equal(disabled.runtime.templates[0].enabled,false);
  f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,
    f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]);
  let unavailable=await refresh(session,f);
  assert.equal(unavailable.status,'blocked');
  assert.equal(unavailable.runtime,undefined);
  const wrong=connected();wrong.codes.set(wrong.binding.factory.address,'0x6000');
  assert.equal((await refresh(session,wrong)).status,'blocked');
  const offline=connected();offline.provider.request=async()=>{throw Error('rpc offline')};
  unavailable=await refresh(session,offline);
  assert.equal(unavailable.status,'blocked');
  assert.equal(unavailable.runtime,undefined);
});

test('inflight discovery cannot resurrect stale state after disconnect or a newer discovery',async()=>{
  const f=connected(),session=createTokenDiscoverySession420(),seen=[];
  const unsubscribe=session.subscribe(s=>seen.push(s.status));
  let unblock;
  const delayed=new Promise(resolve=>{unblock=resolve});
  const original=f.provider.request;
  f.provider.request=async (...args)=>{await delayed;return original(...args)};
  const old=refresh(session,f);
  assert.equal(session.getSnapshot().status,'checking');
  session.invalidate();
  assert.equal(session.getSnapshot().status,'disconnected');
  const newer=connected();
  newer.config.token=null;
  assert.equal((await refresh(session,newer)).status,'unconfigured');
  unblock();
  await old;
  assert.equal(session.getSnapshot().status,'unconfigured');
  assert.equal(session.getSnapshot().runtime,undefined);
  assert.deepEqual(seen,['unconfigured','checking','disconnected','unconfigured']);
  unsubscribe();
  session.invalidate();
  assert.equal(seen.length,4);
});

test('discovery results do not grant signing or spending authority and are not accepted from wallet catalogue events',async()=>{
  const f=connected(),session=createTokenDiscoverySession420();
  const verified=await refresh(session,f);
  assert.equal(verified.authority,'DISCOVERY_ONLY');
  assert.equal(verified.accountGrant,false);assert.equal(verified.spendingAuthority,false);
  const host=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const apps=await readFile(new URL('../apps-page.js',import.meta.url),'utf8');
  assert.match(host,/walletTokenDiscovery420 as tokenDiscovery/);
  assert.match(host,/tokenDiscovery\.refresh\(\{provider:state\.provider,config:state\.config,controller:state\.controller,smartAccount:state\.smartAccount\}\)/);
  for(const e of ['accountsChanged','chainChanged','disconnect'])assert.ok(host.includes(e+":()=>tokenDiscovery.invalidate('disconnected')"));
  assert.match(apps,/walletTokenDiscovery420\.subscribe/);
  assert.doesNotMatch(apps,/event\.detail\?\.tokenDiscovery/);
});
