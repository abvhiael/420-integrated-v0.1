import assert from 'node:assert/strict';
import test from 'node:test';
import {tokenHashHex420,tokenHashText420,tokenReadCall420,tokenWord420} from '../core/token-sdk.js';
import {ARBITRATION_SERVICE_ID} from '../core/arbitration-runtime.js';
import {createVerifiedArbitrationWallet420,normalizeArbitrationRelease420,
  ARBITRATION_REGISTRY_420,ARBITRATION_TIMELOCK_420,ARBITRATION_COMPONENT_ID_420} from '../core/arbitration-verified.js';

const addr=n=>'0x'+n.toString(16).padStart(40,'0');
const h=n=>'0x'+n.toString(16).padStart(64,'0');
const aw=a=>a.slice(2).padStart(64,'0');
const words=(...args)=>'0x'+args.map(x=>typeof x==='string'&&x.startsWith('0x')?x.slice(2).padStart(64,'0'):tokenWord420(x)).join('');
const selector=s=>tokenReadCall420(s).slice(0,10);
const serviceHash=tokenHashText420(ARBITRATION_SERVICE_ID);
const componentHash=tokenHashText420(ARBITRATION_COMPONENT_ID_420);
const codeHash=code=>tokenHashHex420(code);
const CODE=Object.freeze({registry:'0x6001600055',router:'0x6002600055',policies:'0x6003600055',cases:'0x6004600055',rulings:'0x6005600055'});
const ADDR=Object.freeze({registry:ARBITRATION_REGISTRY_420,router:addr(300),policies:addr(301),cases:addr(302),rulings:addr(303)});
const manifest=h(200),metadata=h(201),interfaceHash=h(202),genesisHash=h(203),tipHash=h(204);
const root=()=>tokenHashHex420('0x'+['policies','cases','rulings','router'].map(k=>aw(ADDR[k])).join('')
  +['policies','cases','rulings','router'].map(k=>codeHash(CODE[k]).slice(2)).join(''));

function fixture(){
  const state={chain:'0x1a4',accounts:[addr(100)],version:1,active:true,
    tip:'0x20',genesisHash,tipHash,router:ADDR.router,routerCodeHash:codeHash(CODE.router),
    metadataHash:metadata,profileRoot:root(),manifestHash:manifest,interfaceHash,
    componentActive:true,code:{...CODE},links:{},genesisValid:true,blockValid:true,
    calls:[],override:null};
  const references={router:{policies:ADDR.policies,cases:ADDR.cases,rulings:ADDR.rulings},
    cases:{policies:ADDR.policies,rulingRegistry:ADDR.rulings,governanceTimelock:ARBITRATION_TIMELOCK_420},
    rulings:{cases:ADDR.cases},policies:{governanceTimelock:ARBITRATION_TIMELOCK_420}};
  state.links=structuredClone(references);
  const provider={
    async request(method,params=[]){
      state.calls.push([method,params]);
      if(state.override){const override=state.override(method,params);if(override!==undefined)return override;}
      if(method==='eth_chainId')return state.chain;
      if(method==='eth_accounts')return state.accounts;
      if(method==='eth_getBlockByNumber'){
        if(params[0]==='0x0')return {number:'0x0',hash:state.genesisHash};
        if(params[0]==='latest')return {number:state.tip,hash:state.tipHash};
        return {number:params[0],hash:state.blockValid?state.tipHash:h(999)};
      }
      if(method==='eth_getCode'){
        const key=Object.keys(ADDR).find(k=>ADDR[k]===params[0]);
        return state.code[key]??'0x';
      }
      if(method!=='eth_call')throw Error('unexpected RPC '+method);
      const [{to,data},block]=params;
      assert.equal(block,state.tip,'all contract reads use pinned block');
      const signature=data.slice(0,10);
      const key=Object.keys(ADDR).find(k=>ADDR[k]===to);
      if(key==='registry'){
        if(signature===selector('getService(bytes32)'))return words(state.router,state.routerCodeHash,state.metadataHash,state.version,1,state.active?1:0);
        if(signature===selector('resolveActive(bytes32)')){
          if(!state.active||state.version===0)throw Error('UnknownService');
          return words(state.router,state.version);
        }
        if(signature===selector('getRegistrationProfile(bytes32,uint32)'))
          return words(3,state.manifestHash,state.profileRoot,state.interfaceHash);
        if(signature===selector('component(bytes32)'))
          return words(componentHash,state.router,state.routerCodeHash,1,0,0,state.componentActive?2:3);
        if(signature===selector('resolve(bytes32)')){
          if(!state.componentActive)throw Error('UnknownComponent');
          return words(state.router);
        }
      }
      if(signature===selector('protocolVersion()'))return words(1);
      if(state.links[key]){
        for(const [getter,target] of Object.entries(state.links[key]))
          if(signature===selector(getter+'()'))return words(target);
      }
      throw Error('unexpected ABI read '+key+' '+signature);
    }
  };
  const release={chainId:420,version:1,genesisHash,registry:{address:ADDR.registry,codeHash:codeHash(CODE.registry)},
    metadataHash:metadata,manifestHash:manifest,interfaceHash};
  return {state,provider,release,client:()=>createVerifiedArbitrationWallet420({provider,release,account:addr(100)})};
}

test('trusted release pins canonical Registry and complete commitments',()=>{
  const {release}=fixture();
  assert.equal(normalizeArbitrationRelease420(release).registry.address,ARBITRATION_REGISTRY_420);
  assert.throws(()=>normalizeArbitrationRelease420({...release,registry:{address:addr(100),codeHash:h(1)}}),/noncanonical/);
  assert.throws(()=>normalizeArbitrationRelease420({...release,manifestHash:h(0)}),/invalid Arbitration hash/);
});

test('canonical discovery resolves active service and verifies on-chain dependency graph',async()=>{
  const {client,state}=fixture();
  const verified=await client().discover();
  assert.equal(verified.binding.router,ADDR.router);
  assert.equal(verified.binding.dependencies.cases.address,ADDR.cases);
  assert.equal(verified.binding.version,1);
  assert.equal(verified.account,addr(100));
  assert.equal(verified.registry,ADDR.registry);
  assert.equal(state.calls.some(([method])=>method==='eth_sendTransaction'),false);
  assert.equal(state.calls.some(([method])=>method==='eth_requestAccounts'),false);
});

test('reject wrong chain, different genesis, missing Wallet session and corrupt Registry',async()=>{
  for(const [change,message] of [
    [s=>s.chain='0x1',/chain/],[s=>s.genesisHash=h(9),/genesis/],
    [s=>s.accounts=[],/session/],[s=>s.code.registry='0x',/code missing/],
    [s=>s.code.registry='0x600a',/runtime mismatch/]
  ]){
    const {client,state}=fixture();change(state);
    await assert.rejects(client().discover(),message);
  }
});

test('reject unknown, deprecated, replaced service and mismatched release identity',async()=>{
  for(const [change,message] of [
    [s=>s.version=0,/inactive/],[s=>s.active=false,/inactive/],
    [s=>s.version=2,/version changed/],
    [s=>s.router=addr(500),/unexpected ABI read/],
    [s=>s.routerCodeHash=h(444),/runtime|component/],
    [s=>s.metadataHash=h(600),/metadata/],
    [s=>s.manifestHash=h(601),/profile/],
    [s=>s.interfaceHash=h(602),/profile/],
    [s=>s.profileRoot=h(603),/dependency commitment/],
    [s=>s.componentActive=false,/component/]
  ]){
    const {client,state}=fixture();change(state);
    await assert.rejects(client().discover(),message);
  }
});

test('reject missing and tampered contract code, alias and incorrect immutable bindings',async()=>{
  for(const [change,message] of [
    [s=>s.code.cases='0x',/code missing/],
    [s=>s.code.rulings='0x6008',/dependency commitment/],
    [s=>s.links.router.cases=ADDR.rulings,/dependency alias/],
    [s=>s.links.cases.policies=addr(991),/immutable/],
    [s=>s.links.cases.rulingRegistry=addr(991),/immutable/],
    [s=>s.links.rulings.cases=addr(991),/immutable/],
    [s=>s.links.router.rulings=addr(991),/code missing/],
    [s=>s.links.cases.governanceTimelock=addr(991),/governance/]
  ]){const {client,state}=fixture();change(state);await assert.rejects(client().discover(),message);}
});

test('reject malformed or malicious RPC results and chain reorganization',async()=>{
  for(const [change,message] of [
    [s=>s.blockValid=false,/reorganized/],
    [s=>s.override=(method)=>method==='eth_getCode'?'0xffg':undefined,/malformed/],
    [s=>s.override=(method,params)=>method==='eth_call'&&params[0].data.slice(0,10)===selector('getService(bytes32)')?'0x':undefined,/malformed/],
    [s=>s.override=(method,params)=>method==='eth_call'&&params[0].data.slice(0,10)===selector('protocolVersion()')?words(7):undefined,/version mismatch/],
    [s=>s.chain='not-hex',/chain/]
  ]){const {client,state}=fixture();change(state);await assert.rejects(client().discover(),message);}
});

test('no transaction target from an arbitrary supplied verified flag, fake intent or unsupported action',async()=>{
  const {client}=fixture(),wallet=client();
  await assert.rejects(wallet.prepare('__proto__'),/unsupported/);
  await assert.rejects(wallet.prepare('seizeFunds'),/unsupported/);
  await assert.rejects(wallet.confirm({verified:true,target:ADDR.cases},{authorize:async()=>true}),/unverified/);
  const intent=await wallet.prepare('submitEvidence');
  assert.equal(intent.target,ADDR.cases);
  assert.equal(intent.requiresExplicitWalletConfirmation,true);
  await assert.rejects(wallet.confirm(intent),/explicit Wallet confirmation/);
  await assert.rejects(wallet.confirm(intent,{authorize:async()=>false}),/confirmation rejected/);
});

test('preparation is one-shot and explicit callback never auto-signs or broadcasts',async()=>{
  const {client,state}=fixture(),wallet=client();
  const intent=await wallet.prepare('finalizeRuling');
  assert.equal(intent.target,ADDR.rulings);
  const output=await wallet.confirm(intent,{authorize:async()=>true});
  assert.deepEqual({to:output.to,from:output.from,action:output.action},
    {to:ADDR.rulings,from:addr(100),action:'finalizeRuling'});
  await assert.rejects(wallet.confirm(intent,{authorize:async()=>true}),/unverified/);
  assert.equal(state.calls.some(([method])=>method==='eth_sendTransaction'||method==='personal_sign'),false);
});

test('revalidate before confirmation, including Registry changes and stale chain/session',async()=>{
  for(const change of [
    s=>s.active=false,s=>s.version=2,s=>s.profileRoot=h(901),
    s=>s.accounts=[],s=>s.chain='0x1',s=>s.code.cases='0x'
  ]){
    const {client,state}=fixture(),wallet=client(),intent=await wallet.prepare('openCase');
    change(state);
    await assert.rejects(wallet.confirm(intent,{authorize:async()=>true}));
  }
});

test('revalidate after confirmation callback and fail closed on mid-review changes',async()=>{
  const {client,state}=fixture(),wallet=client(),intent=await wallet.prepare('appeal');
  await assert.rejects(wallet.confirm(intent,{authorize:async()=>{state.version=2;return true;}}),/version changed/);
});

test('invalidation rejects cached or pending intent after network or Registry event',async()=>{
  const {client}=fixture(),wallet=client(),intent=await wallet.prepare('openCase');
  wallet.invalidate();
  await assert.rejects(wallet.confirm(intent,{authorize:async()=>true}),/stale/);
  const newer=await wallet.prepare('openCase');
  assert.notEqual(newer,intent);
});

test('reject malicious RPC mutation between initial service and final service read',async()=>{
  const {client,state}=fixture();
  let reads=0;
  state.override=(method,params)=>{
    if(method==='eth_call'&&params[0].data.slice(0,10)===selector('getService(bytes32)')){
      reads++;
      if(reads===2){state.router=addr(777);return words(state.router,state.routerCodeHash,
        state.metadataHash,state.version,1,1);}
    }
    return undefined;
  };
  await assert.rejects(client().discover(),/changed while verifying/);
});
