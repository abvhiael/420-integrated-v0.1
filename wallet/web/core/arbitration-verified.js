// 420Arbitration Wallet discovery: independent, read-only verification of canonical RPC state.
// Caller-provided addresses, code hashes, and "verified" flags never constitute authorization.
import {tokenHashText420, tokenHashHex420, tokenReadCall420, tokenWord420} from './token-sdk.js';
import {assertWalletChain420} from './transaction-lifecycle.js';
import {ARBITRATION_SERVICE_ID, arbitrationActionTarget, validateArbitrationRuntime} from './arbitration-runtime.js';

export const ARBITRATION_REGISTRY_420 = '0x0000000000000000000000000000000000000434';
export const ARBITRATION_TIMELOCK_420 = '0x0000000000000000000000000000000000000429';
export const ARBITRATION_COMPONENT_ID_420 = '420/component/arbitration/v1';
const SID = tokenHashText420(ARBITRATION_SERVICE_ID);
const CID = tokenHashText420(ARBITRATION_COMPONENT_ID_420);
const KEYS = Object.freeze(['policies', 'cases', 'rulings']);
const NAMES = Object.freeze({router:'ArbitrationRouter420',policies:'ArbitrationPolicyRegistry420',
  cases:'ArbitrationCaseRegistry420',rulings:'ArbitrationRulingRegistry420'});
const check = (condition,message) => { if(!condition)throw Error(message); };
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const QTY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const hex = (value) => {
  check(typeof value==='string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(value),'malformed Arbitration RPC hex');
  return value.toLowerCase();
};
const address = (value) => {
  check(typeof value==='string' && ADDRESS.test(value) && BigInt(value)!==0n,'invalid Arbitration address');
  return value.toLowerCase();
};
const hash = (value) => {
  check(typeof value==='string' && HASH.test(value) && BigInt(value)!==0n,'invalid Arbitration hash');
  return value.toLowerCase();
};
const wordAddress = (word) => {
  check(BigInt('0x'+word)<(1n<<160n),'malformed Arbitration ABI address');
  return address('0x'+word.slice(24));
};
const exactWords = (value,count) => {
  const raw=hex(value).slice(2);
  check(raw.length===64*count,'malformed Arbitration ABI result');
  return Array.from({length:count},(_,i)=>raw.slice(i*64,(i+1)*64));
};
const quantity = (value) => {
  check(typeof value==='string' && QTY.test(value),'malformed Arbitration RPC quantity');
  return BigInt(value);
};
const uint = (value,bits=256) => {
  check(typeof value==='number' && Number.isSafeInteger(value) && value>=0
    && BigInt(value)<(1n<<BigInt(bits)),'invalid Arbitration release version/chain');
  return value;
};
const toWord = (value) => tokenWord420(value);
const wordHash = (value) => hash('0x'+value);
const count = (value,bits=256) => {
  const n=BigInt('0x'+value);
  check(n<(1n<<BigInt(bits)),'out-of-range Arbitration ABI integer');
  return n;
};

// These pins must be selected by the Wallet from its trusted chain-specific release
// configuration, never from an application, manifest candidate, route, or RPC response.
// The dependency root is independently reconstructed from observed code and bindings.
export function normalizeArbitrationRelease420(pins) {
  check(pins && typeof pins==='object','trusted Arbitration release required');
  check(pins.serviceId===ARBITRATION_SERVICE_ID,'Arbitration release service id mismatch');
  const chainId=uint(pins.chainId,53),version=uint(pins.version,32);
  check(chainId>0&&version>0,'invalid Arbitration release identity');
  const registry=address(pins.registry?.address);
  check(registry===ARBITRATION_REGISTRY_420,'noncanonical Arbitration ProtocolRegistry');
  return Object.freeze({chainId,version,genesisHash:hash(pins.genesisHash),
    registry:Object.freeze({address:registry,codeHash:hash(pins.registry.codeHash)}),
    metadataHash:hash(pins.metadataHash),manifestHash:hash(pins.manifestHash),
    interfaceHash:hash(pins.interfaceHash)});
}

export function createVerifiedArbitrationWallet420({provider,release,account}) {
  check(provider&&typeof provider.request==='function','Wallet RPC required');
  const approved=normalizeArbitrationRelease420(release);
  const selected=address(account);
  let generation=0;
  const prepared=new WeakMap();
  const invalidate=()=>{ generation+=1; };
  // An EIP-1193 provider may emit a transition and return to the same chain/account
  // before confirmation. Invalidate prepared handles even if the final values match.
  if(typeof provider.on==='function') {
    provider.on('chainChanged',invalidate);
    provider.on('accountsChanged',invalidate);
  }
  const rpc=(method,params=[])=>provider.request(method,params);
  const session=async()=>{
    await assertWalletChain420(provider,approved.chainId);
    const accounts=await rpc('eth_accounts',[]);
    check(Array.isArray(accounts) && accounts.some(a=>typeof a==='string'&&ADDRESS.test(a)&&a.toLowerCase()===selected),
      'Arbitration Wallet session missing or changed');
  };
  const call=async(target,signature,arguments_,block,count_)=>exactWords(await rpc('eth_call',
    [{to:target,data:tokenReadCall420(signature,arguments_.map(()=> 'bytes32'),arguments_)},block]),count_);
  const getter=async(target,signature,block)=>wordAddress((await call(target,signature,[],block,1))[0]);
  const code=async(target,block)=>{
    const bytes=hex(await rpc('eth_getCode',[target,block]));
    check(bytes!=='0x' && !/^0x0+$/.test(bytes),'Arbitration contract code missing');
    return hash(tokenHashHex420(bytes));
  };
  const revision=async(tag)=>{
    const service=await call(approved.registry.address,'getService(bytes32)',[SID],tag,6);
    const version=count(service[3],32);
    check(version===BigInt(approved.version) && count(service[5],8)===1n,
      'Arbitration service inactive, deprecated or version changed');
    const router=wordAddress(service[0]),routerCodeHash=wordHash(service[1]);
    check(wordHash(service[2])===approved.metadataHash,'Arbitration service metadata mismatch');
    const active=await call(approved.registry.address,'resolveActive(bytes32)',[SID],tag,2);
    check(wordAddress(active[0])===router&&count(active[1],32)===version,'Arbitration active resolution changed');
    const profile=await call(approved.registry.address,'getRegistrationProfile(bytes32,uint32)',
      [SID,'0x'+toWord(version)],tag,4);
    check(count(profile[0],8)===3n && wordHash(profile[1])===approved.manifestHash
      && wordHash(profile[3])===approved.interfaceHash,'Arbitration registration profile mismatch');
    const component=await call(approved.registry.address,'component(bytes32)',[CID],tag,7);
    check(wordHash(component[0])===CID && wordAddress(component[1])===router
      && wordHash(component[2])===routerCodeHash && count(component[3],32)===1n
      && count(component[4],32)===0n && count(component[5],32)===0n && count(component[6],8)===2n,
      'Arbitration registered component mismatch');
    const componentAddress=await call(approved.registry.address,'resolve(bytes32)',[CID],tag,1);
    check(wordAddress(componentAddress[0])===router,'Arbitration component inactive');
    return {version:Number(version),router,routerCodeHash,dependencyRoot:wordHash(profile[2])};
  };
  async function discover() {
    const epoch=generation;
    await session();
    const genesis=await rpc('eth_getBlockByNumber',['0x0',false]);
    check(genesis && quantity(genesis.number)===0n && hash(genesis.hash)===approved.genesisHash,
      'Arbitration network genesis mismatch');
    const latest=await rpc('eth_getBlockByNumber',['latest',false]);
    check(latest && quantity(latest.number)>=0n,'Arbitration verification block missing');
    const block=latest.number,blockHash=hash(latest.hash);
    check(await code(approved.registry.address,block)===approved.registry.codeHash,
      'Arbitration ProtocolRegistry runtime mismatch');
    const service=await revision(block),addr={router:service.router};
    for(const name of KEYS)addr[name]=await getter(service.router,name+'()',block);
    check(new Set(Object.values(addr)).size===4,'Arbitration dependency alias');
    const runtimeHashes={};
    for(const name of ['router',...KEYS])runtimeHashes[name]=await code(addr[name],block);
    check(runtimeHashes.router===service.routerCodeHash,'Arbitration router code hash mismatch');
    // Published root is keccak256(abi.encode(policies,cases,rulings,router,codehashes in the same order)).
    const ordered=[...KEYS,'router'];
    const root=tokenHashHex420('0x'+ordered.map(k=>addr[k].slice(2).padStart(64,'0')).join('')
      +ordered.map(k=>runtimeHashes[k].slice(2)).join(''));
    check(root===service.dependencyRoot,'Arbitration dependency commitment mismatch');
    for(const name of ['router',...KEYS]){
      const observed=count((await call(addr[name],'protocolVersion()',[],block,1))[0],32);
      check(observed===1n,'Arbitration contract version mismatch: '+name);
    }
    for(const [owner,signature,target] of [
      ['router','policies()','policies'],['router','cases()','cases'],['router','rulings()','rulings'],
      ['cases','policies()','policies'],['cases','rulingRegistry()','rulings'],['rulings','cases()','cases']
    ])check(await getter(addr[owner],signature,block)===addr[target],
      'Arbitration immutable/dependency mismatch: '+owner+'.'+signature);
    // Timelock authority must not silently change to an arbitrary registry controller.
    for(const name of ['policies','cases'])check(
      await getter(addr[name],'governanceTimelock()',block)===ARBITRATION_TIMELOCK_420,
      'Arbitration governance authority mismatch');
    const repeat=await revision(block);
    check(repeat.router===service.router&&repeat.version===service.version
      &&repeat.routerCodeHash===service.routerCodeHash&&repeat.dependencyRoot===service.dependencyRoot,
      'Arbitration service changed while verifying');
    const canonical=await rpc('eth_getBlockByNumber',[block,false]);
    check(canonical&&canonical.number===block&&hash(canonical.hash)===blockHash,
      'Arbitration verification block reorganized');
    await session();
    check(generation===epoch,'Arbitration binding invalidated during verification');
    const binding=validateArbitrationRuntime({serviceId:ARBITRATION_SERVICE_ID,
      chainId:approved.chainId,version:service.version,router:addr.router,routerCodeHash:runtimeHashes.router,
      dependencies:Object.fromEntries(KEYS.map(name=>[name,{address:addr[name],codeHash:runtimeHashes[name]}]))});
    return Object.freeze({binding,block,blockHash,version:service.version,registry:approved.registry.address,
      account:selected,generation:epoch,approvedRelease:approved});
  }
  async function prepare(action) {
    const epoch=generation;
    const snapshot=await discover();
    check(epoch===generation,'Arbitration binding invalidated');
    const target=arbitrationActionTarget(snapshot.binding,action);
    const token=Object.freeze({action,target,chainId:approved.chainId,account:selected,
      requiresExplicitWalletConfirmation:true,autonomousSigning:false});
    prepared.set(token,{snapshot,epoch,action,target});
    return token;
  }
  async function confirm(token,{authorize}={}) {
    const item=prepared.get(token);
    check(item && item.epoch===generation,'unverified or stale Arbitration transaction intent');
    check(typeof authorize==='function','explicit Wallet confirmation callback required');
    const before=await discover();
    check(same(before,item.snapshot)&&arbitrationActionTarget(before.binding,item.action)===item.target,
      'Arbitration Registry changed since transaction preparation');
    const allowed=await authorize(token);
    check(allowed===true,'Arbitration Wallet confirmation rejected');
    const after=await discover();
    check(item.epoch===generation&&same(after,item.snapshot)&&
      arbitrationActionTarget(after.binding,item.action)===item.target,
      'Arbitration Registry changed during Wallet confirmation');
    prepared.delete(token); // one-shot intent, no signing or broadcast by this module
    return Object.freeze({to:item.target,chainId:approved.chainId,from:selected,
      action:item.action,authorizedForWalletReview:true,autonomousSigning:false});
  }
  // Approval comparison deliberately does not rely on a caller-controlled "verified" boolean.
  function same(a,b) {
    return a.account===b.account && a.binding.chainId===b.binding.chainId
      && a.binding.version===b.binding.version && a.binding.router===b.binding.router
      && a.binding.routerCodeHash===b.binding.routerCodeHash
      && KEYS.every(k=>a.binding.dependencies[k].address===b.binding.dependencies[k].address
        && a.binding.dependencies[k].codeHash===b.binding.dependencies[k].codeHash)
      && a.registry===b.registry && a.approvedRelease.genesisHash===b.approvedRelease.genesisHash;
  }
  function dispose() {
    invalidate();
    if(typeof provider.removeListener==='function') {
      provider.removeListener('chainChanged',invalidate);
      provider.removeListener('accountsChanged',invalidate);
    }
  }
  return Object.freeze({discover,prepare,confirm,invalidate,dispose,release:approved});
}
