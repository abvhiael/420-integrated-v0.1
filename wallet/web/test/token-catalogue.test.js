import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOKEN_TEMPLATES_420, TOKEN_CATALOGUE_PROFILES_420, describeTokenCatalogue420,
  createTokenCatalogue420, createTokenDiscoverySession420} from '../core/token-app.js';
import {TOKEN_CREATION_FEE_WEI_420} from '../core/token-runtime.js';
import {connected} from './token-connected-fixture.js';
import {controller,addr,digest,abi,serviceHash} from './token-test-fixture.js';

const start=(session,f)=>session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
const key=i=>TOKEN_TEMPLATES_420[i].key;
async function ready(){
  const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session);
  assert.equal((await start(session,f)).status,'verified');
  return {f,session,catalogue};
}

test('catalogue displays only the eight canonical templates with accurate features, permanent IDs and exact fee',async()=>{
  const profiles=TOKEN_CATALOGUE_PROFILES_420;
  const config=JSON.parse(await readFile(new URL('../../../contracts/config/420token-genesis.json',import.meta.url),'utf8'));
  assert.deepEqual(profiles.map(p=>p.key),config.templates);
  assert.deepEqual(profiles.map(p=>p.id),TOKEN_TEMPLATES_420.map(p=>p.id));
  assert.equal(new Set(profiles.map(p=>p.profileHash)).size,8);
  assert.ok(profiles.every(p=>p.version===1&&p.creationFeeWei===TOKEN_CREATION_FEE_WEI_420.toString()&&Object.isFrozen(p)&&Object.isFrozen(p.features)));
  assert.equal(profiles.filter(p=>p.standard==='ERC20'&&p.features.includes('18 decimals')).length,6);
  assert.equal(profiles.filter(p=>p.features.includes('Permanent supply cap')).length,1);
  assert.equal(profiles.filter(p=>p.features.includes('EIP-2612 permit')).length,2);
  assert.equal(profiles.filter(p=>p.features.includes('Delegation and historical voting checkpoints')).length,1);
  assert.equal(profiles.filter(p=>p.features.includes('Holder or allowance-based burning')).length,1);
  assert.ok(profiles[6].features.includes('Unique token IDs'));
  assert.ok(profiles[7].features.includes('Safe batch transfers'));
  for(const p of profiles.slice(6))assert.ok(p.features.includes('Holder or approved-operator burning'));
});
test('unconfigured, disconnected, checking and blocked states never infer enablement or selection',()=>{
  for(const status of ['unconfigured','disconnected','checking','blocked','nonsense']){
    const v=describeTokenCatalogue420({status,runtime:{templates:TOKEN_TEMPLATES_420.map(p=>({...p,enabled:true}))}});
    assert.equal(v.profiles.length,8);assert.equal(v.enabledCount,null);assert.equal(v.verificationBlock,null);
    assert.ok(v.profiles.every(p=>p.availability==='unknown'&&!p.selectable));
  }
});
test('verified availability supports mixed and all-disabled states without changing catalogued profiles',async()=>{
  const {f,session,catalogue}=await ready();
  f.enable(TOKEN_TEMPLATES_420[1],false);
  f.enable(TOKEN_TEMPLATES_420[7],false);
  await catalogue.refresh();
  let v=catalogue.getSnapshot();
  assert.equal(v.enabledCount,6);
  assert.equal(v.profiles[1].availability,'disabled');
  assert.equal(v.profiles[7].availability,'disabled');
  assert.equal(v.profiles[0].availability,'enabled');
  assert.equal(v.verificationBlock.hash,f.tokenControl.tipHash);
  assert.equal(v.chainId,420);
  assert.equal(v.accountReady,true);
  assert.equal(await catalogue.select(key(1)),false);
  for(const p of TOKEN_TEMPLATES_420)f.enable(p,false);
  await catalogue.refresh();v=catalogue.getSnapshot();
  assert.equal(v.status,'verified');assert.equal(v.enabledCount,0);
  assert.ok(v.profiles.every(p=>p.availability==='disabled'&&!p.selectable));
  assert.equal(v.selected,null);
  catalogue.dispose();
});
test('partial, substituted, duplicated, malformed and stale-block profile results fail closed',async()=>{
  const {session,catalogue}=await ready();
  for(const mutate of [
    s=>s.runtime.templates.pop(),
    s=>s.runtime.templates[7]=s.runtime.templates[0],
    s=>s.runtime.templates[0].id=digest(1),
    s=>s.runtime.templates[0].profileHash=digest(2),
    s=>s.runtime.templates[0].version=2,
    s=>s.runtime.templates[0].standard='ERC721',
    s=>s.runtime.templates[0].enabled='true',
    s=>s.verificationBlock.hash=digest(4),
    s=>s.accountGrant=true,
    s=>s.spendingAuthority=true,
    s=>s.serviceId='420/service/other/v1',
  ]){
    const s=structuredClone(session.getSnapshot());mutate(s);
    const v=describeTokenCatalogue420(s);
    assert.equal(v.status,'blocked');assert.equal(v.enabledCount,null);
    assert.ok(v.profiles.every(p=>p.availability==='unknown'&&!p.selectable));
  }
  // Display descriptions/features never come from the RPC or a supplied profile.
  const s=structuredClone(session.getSnapshot());s.runtime.templates[0].description='malicious';s.runtime.templates[0].mintable=true;
  assert.notEqual(describeTokenCatalogue420(s).profiles[0].description,'malicious');
  assert.equal(describeTokenCatalogue420(s).profiles[0].mintable,false);
  catalogue.dispose();
});
test('every enabled profile can be selected only after a fresh verified read, without transaction authority',async()=>{
  const {f,session,catalogue}=await ready();
  for(const p of TOKEN_TEMPLATES_420){
    const count=f.calls.length;
    assert.equal(await catalogue.select(p.key),true);
    const v=catalogue.getSnapshot();
    assert.equal(v.selected.key,p.key);assert.equal(v.selected.id,p.id);
    assert.equal(v.selected.authority,'DISPLAY_ONLY');
    assert.equal(v.authority,'DISCOVERY_ONLY');
    assert.deepEqual(v.selected.verificationBlock,v.verificationBlock);
    assert.ok(Object.isFrozen(v.selected)&&Object.isFrozen(v.profiles));
    assert.ok(f.calls.length>count);
  }
  assert.ok(f.calls.every(([m])=>['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(m)));
  assert.equal(await catalogue.select('unsupported'),false);
  session.invalidate();assert.equal(catalogue.getSnapshot().selected,null);
  assert.equal(catalogue.canRefresh(),false);
  assert.equal(await catalogue.select(key(0)),false);
  catalogue.dispose();
});
test('governance disablement between display and selection rejects and updates availability; reenable requires a refresh',async()=>{
  const {f,catalogue}=await ready();
  assert.equal(catalogue.getSnapshot().profiles[0].selectable,true);
  f.enable(TOKEN_TEMPLATES_420[0],false);
  assert.equal(await catalogue.select(key(0)),false);
  assert.equal(catalogue.getSnapshot().profiles[0].availability,'disabled');
  assert.equal(catalogue.getSnapshot().selected,null);
  f.enable(TOKEN_TEMPLATES_420[0],true);
  assert.equal(await catalogue.select(key(0)),false);
  await catalogue.refresh();
  assert.equal(await catalogue.select(key(0)),true);
  catalogue.dispose();
});
test('deactivated service, reorganization and RPC failure clear selection and availability; retry uses same approved context',async()=>{
  for(const mutate of [
    f=>f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]),
    f=>{f.tokenControl.canonicalHash=digest(99)},
    f=>{f.provider.request=async()=>{throw Error('offline')}},
  ]){
    const {f,session,catalogue}=await ready();
    assert.equal(await catalogue.select(key(0)),true);
    mutate(f);
    await catalogue.refresh();
    assert.equal(catalogue.getSnapshot().status,'blocked');
    assert.equal(catalogue.getSnapshot().selected,null);
    assert.equal(catalogue.getSnapshot().enabledCount,null);
    assert.ok(catalogue.canRefresh());
    assert.ok(catalogue.getSnapshot().profiles.every(p=>!p.selectable));
    session.invalidate();assert.equal(catalogue.canRefresh(),false);
    catalogue.dispose();
  }
});
test('superseded selection cannot survive a disconnect, newer host context or disposed catalogue',async()=>{
  for(const invalidate of ['disconnect','newer','dispose']){
    const {f,session,catalogue}=await ready();
    let release;
    const gate=new Promise(resolve=>{release=resolve});
    const original=f.provider.request;
    f.provider.request=async(...args)=>{await gate;return original(...args)};
    const selection=catalogue.select(key(0));
    assert.equal(catalogue.getSnapshot().status,'checking');
    if(invalidate==='disconnect')session.invalidate();
    if(invalidate==='newer'){
      const newer=connected();await start(session,newer);
    }
    if(invalidate==='dispose')catalogue.dispose();
    release();
    assert.equal(await selection,false);assert.equal(catalogue.getSnapshot().selected,null);
    catalogue.dispose();
  }
});
test('counterfactual and non-owner status is separate from Registry enablement',async()=>{
  for(const deployed of [false,true]){
    const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session);
    if(!deployed){f.control.accountDeployed=false;f.selected.deployed=false;}else f.control.owner=addr(333);
    await start(session,f);const v=catalogue.getSnapshot();
    assert.equal(v.status,'verified');assert.equal(v.enabledCount,8);assert.equal(v.accountReady,false);
    assert.equal(await catalogue.select(key(0)),true);
    assert.equal(catalogue.getSnapshot().selected.authority,'DISPLAY_ONLY');
    catalogue.dispose();
  }
});
test('read-only refresh cannot restore invalidated host context or substitute external config',async()=>{
  const {f,session,catalogue}=await ready();
  const original=session.getSnapshot().runtime.factory.address;
  f.config.token.binding.factory.address=addr(999);
  // Refresh uses the host-approved copied config, not caller mutation.
  assert.equal((await session.refreshCurrent()).runtime.factory.address,original);
  for(const reason of ['disconnected','blocked','unconfigured']){
    session.invalidate(reason);
    assert.equal(await session.refreshCurrent(),null);assert.equal(session.canRefresh(),false);
    assert.equal(catalogue.getSnapshot().selected,null);
  }
  catalogue.dispose();
});
