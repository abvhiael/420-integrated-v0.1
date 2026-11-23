// ARB-PRE-09: real contract deployment and governance-executed local Genesis qualification.
// Deliberately local-only. No predeploy address or release identity is published to a live chain.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JsonRpcProvider,Contract,ContractFactory,AbiCoder,keccak256,id,ZeroHash} from 'ethers';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contracts=resolve(root,'contracts');
const artifactDir=resolve(root,'artifacts/arbitration/arb-pre-09');
const output=resolve(root,process.argv[2]||'artifacts/arbitration/arb-pre-09/local-genesis.json');
const rpcUrl='http://127.0.0.1:18709';
const timelockAddress='0x0000000000000000000000000000000000000429';
const registryAddress='0x0000000000000000000000000000000000000434';
const manifestFile=resolve(contracts,'config/arbitration/arbitration-audit-4-release-materialization.json');
const sourceManifest=JSON.parse(readFileSync(manifestFile,'utf8'));
const sid=id('420/service/arbitration/v1');
const cid=id('420/component/arbitration/v1');
const domain=id('420/arbitration/domain/local-genesis-qualification/v1');
const origin=id('420/component/local-genesis-qualification/v1');
const wait=(ms)=>new Promise(ok=>setTimeout(ok,ms));
const anvil=spawn('anvil',['--host','127.0.0.1','--port','18709','--chain-id','31337',
  '--timestamp','1700000000','--silent'],{stdio:['ignore','pipe','pipe']});
let outputLog='';
for(const pipe of [anvil.stdout,anvil.stderr])pipe.on('data',chunk=>{outputLog+=chunk.toString().slice(0,2000);});
const provider=new JsonRpcProvider(rpcUrl);
const evidence=[];
const addresses={};
const hashes={};
const receiptOrder=[];
const hashesByStep={};
async function rpc(method,params=[]){
  const res=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',method,params,id:1})});
  assert.equal(res.ok,true,'Anvil RPC HTTP '+method);
  const payload=await res.json();
  if(payload.error)throw Error(method+': '+payload.error.message);
  return payload.result;
}
async function ready(){
  for(let i=0;i<100;i++){
    if(anvil.exitCode!==null)throw Error('Anvil exited '+outputLog);
    try{assert.equal(await rpc('eth_chainId'),'0x7a69');return;}
    catch{await wait(100);}
  }
  throw Error('Anvil startup failed '+outputLog);
}
function artifact(name){
  const path=resolve(contracts,'out',name+'.sol',name+'.json');
  assert(existsSync(path),'Missing verified Foundry artifact: '+path);
  const raw=JSON.parse(readFileSync(path,'utf8'));
  assert(raw.bytecode?.object && raw.abi,'Compiled artifact missing: '+name);
  const metadata=typeof raw.metadata==='string'?JSON.parse(raw.metadata):raw.metadata;
  if(metadata?.compiler?.version)
    assert(metadata.compiler.version.startsWith('0.8.24'),'incorrect compiler '+name);
  return raw;
}
async function codehash(address){
  const runtime=await provider.getCode(address);
  assert(runtime!=='0x','No runtime code at '+address);
  return keccak256(runtime);
}
async function track(label,tx,contractAddress=null){
  const mined=await tx.wait();
  assert.equal(mined.status,1,'Transaction failed: '+label);
  assert.equal(mined.blockNumber>0,true,'Missing transaction block: '+label);
  const fresh=await provider.getTransactionReceipt(mined.hash);
  assert.equal(fresh.hash,mined.hash,'Receipt mismatch: '+label);
  assert.equal(fresh.blockHash,mined.blockHash,'Receipt block mismatch: '+label);
  const row={order:receiptOrder.length+1,step:label,txHash:mined.hash,
    blockNumber:mined.blockNumber,transactionIndex:mined.index,blockHash:mined.blockHash,
    from:mined.from,to:mined.to,created:contractAddress,gasUsed:mined.gasUsed.toString()};
  receiptOrder.push(row);
  assert.equal(receiptOrder.at(-1).order,receiptOrder.length);
  hashesByStep[label]=mined.hash;
  return mined;
}
async function deploy(name,signer,args,label,record=true){
  const a=artifact(name);
  const instance=await new ContractFactory(a.abi,a.bytecode.object,signer).deploy(...args);
  const receipt=await track(label,instance.deploymentTransaction(),await instance.getAddress());
  assert.equal(receipt.contractAddress?.toLowerCase(),(await instance.getAddress()).toLowerCase());
  await instance.waitForDeployment();
  if(record){
    addresses[name]=await instance.getAddress();
    hashes[name]=await codehash(addresses[name]);
  }
  return instance;
}
async function reject(description,action){
  let failed=false;
  try{await action();}catch{failed=true;}
  assert(failed,'Incorrectly accepted '+description);
  evidence.push(description);
}
async function execute(timelock,governor,target,iface,method,args,label){
  const data=iface.encodeFunctionData(method,args);
  const key=id('420/arb-pre-09/'+label);
  await track('schedule:'+label,await timelock.connect(governor).schedule(key,target,0n,data,0));
  await reject('early timelock execution '+label,()=>timelock.execute.staticCall(key));
  await rpc('evm_increaseTime',[604801]);await rpc('evm_mine',[]);
  await track('execute:'+label,await timelock.execute(key));
  const op=await timelock.operations(key);
  assert.equal(op.executed,true,'Governance operation not executed '+label);
  await reject('replay executed governance '+label,()=>timelock.execute.staticCall(key));
}
async function main(){
  assert.equal(sourceManifest.address_policy.arbitration_router_status,
    'REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS');
  assert.equal(sourceManifest.artifact_identity.compiler,'Solidity 0.8.24');
  assert.equal(sourceManifest.artifact_identity.evm_version,'cancun');
  assert.equal(sourceManifest.artifact_identity.optimizer,true);
  assert.equal(sourceManifest.artifact_identity.optimizer_runs,200);
  await ready();
  const genesis=await provider.getBlock(0);
  const [governor,claimant,respondent,resolver,appealResolver,observer]=
    await Promise.all([0,1,2,3,4,5].map(n=>provider.getSigner(n)));
  const [governorAddress,claimantAddress,respondentAddress,resolverAddress,appealAddress]=
    await Promise.all([governor,claimant,respondent,resolver,appealResolver].map(s=>s.getAddress()));
  // Ephemeral Anvil Genesis fixture: copy actual compiled Timelock constructor storage
  // and immutable-bearing runtime to its already-approved canonical predeploy address.
  // This is local state seeding ONLY, never a production deployment instruction.
  const seed=await deploy('GovernanceTimelock',governor,[governorAddress],'genesis:timelock-constructor');
  const seedRegistry=await deploy('ProtocolRegistry',governor,[timelockAddress],'genesis:registry-constructor');
  await rpc('anvil_setCode',[timelockAddress,await provider.getCode(await seed.getAddress())]);
  await rpc('anvil_setStorageAt',[timelockAddress,'0x0',await provider.getStorage(await seed.getAddress(),0n)]);
  await rpc('anvil_setCode',[registryAddress,await provider.getCode(await seedRegistry.getAddress())]);
  const timelock=new Contract(timelockAddress,artifact('GovernanceTimelock').abi,governor);
  const registry=new Contract(registryAddress,artifact('ProtocolRegistry').abi,governor);
  assert.equal(await timelock.bootstrapGovernor(),governorAddress);
  assert.equal(await timelock.scheduler(),governorAddress);
  assert.equal(await timelock.G1_DELAY(),604800n);
  assert.equal(await registry.governanceTimelock(),timelockAddress);
  assert.equal(await registry.protocolVersion(),4n);
  hashes.GovernanceTimelock=await codehash(timelockAddress);
  hashes.ProtocolRegistry=await codehash(registryAddress);
  addresses.GovernanceTimelock=timelockAddress;
  addresses.ProtocolRegistry=registryAddress;
  // Three actual contract constructors; deployed addresses are learned, never frozen.
  const policies=await deploy('ArbitrationPolicyRegistry420',governor,[timelockAddress],'deploy:policies');
  const cases=await deploy('ArbitrationCaseRegistry420',governor,
    [timelockAddress,await policies.getAddress()],'deploy:cases');
  const rulings=await deploy('ArbitrationRulingRegistry420',governor,
    [await cases.getAddress()],'deploy:rulings');
  assert.equal(await policies.governanceTimelock(),timelockAddress);
  assert.equal(await cases.governanceTimelock(),timelockAddress);
  assert.equal(await cases.policies(),await policies.getAddress());
  assert.equal(await rulings.cases(),await cases.getAddress());
  await reject('unauthorized ruling binding',async()=>cases.connect(claimant).bindRulingRegistry.staticCall(await rulings.getAddress()));
  const wrong=await deploy('ArbitrationCaseRegistry420',governor,[timelockAddress,await policies.getAddress()],
    'negative:foreign-case',false);
  const foreign=await deploy('ArbitrationRulingRegistry420',governor,[await wrong.getAddress()],
    'negative:foreign-ruling',false);
  await executeExpectFailure(timelock,governor,await cases.getAddress(),cases.interface,
    'bindRulingRegistry',[await foreign.getAddress()],'invalid-binding');
  await execute(timelock,governor,await cases.getAddress(),cases.interface,'bindRulingRegistry',
    [await rulings.getAddress()],'one-time-ruling-binding');
  assert.equal(await cases.rulingRegistry(),await rulings.getAddress());
  await executeExpectFailure(timelock,governor,await cases.getAddress(),cases.interface,
    'bindRulingRegistry',[await rulings.getAddress()],'duplicate-binding');
  const router=await deploy('ArbitrationRouter420',governor,
    [await policies.getAddress(),await cases.getAddress(),await rulings.getAddress()],'deploy:router');
  for(const [method,target] of [['policies',policies],['cases',cases],['rulings',rulings]])
    assert.equal(await router[method](),await target.getAddress(),'Router immutable '+method);
  const keys=['ArbitrationPolicyRegistry420','ArbitrationCaseRegistry420',
    'ArbitrationRulingRegistry420','ArbitrationRouter420'];
  const dependencies=keys.map(k=>addresses[k]);
  const dependencyHashes=keys.map(k=>hashes[k]);
  const dependencyRoot=keccak256(AbiCoder.defaultAbiCoder().encode(
    [...keys.map(()=>'address'),...keys.map(()=>'bytes32')],[...dependencies,...dependencyHashes]));
  const metadataHash=keccak256(readFileSync(resolve(contracts,'config/arbitration/arb-pre-09-local-release-metadata.json')));
  const manifestHash=keccak256(readFileSync(manifestFile));
  const interfaceHash=keccak256(Buffer.from(JSON.stringify(artifact('ArbitrationRouter420').abi)));
  await reject('unauthorized component registration',async()=>registry.connect(observer).registerComponent.staticCall(
    cid,await router.getAddress(),[1,0,0],2));
  await execute(timelock,governor,registryAddress,registry.interface,'registerComponent',
    [cid,await router.getAddress(),[1,0,0],2],'register-component');
  const component=await registry.component(cid);
  assert.equal(component.implementation,await router.getAddress());
  assert.equal(component.runtimeCodeHash,hashes.ArbitrationRouter420);
  assert.equal(await registry.resolve(cid),await router.getAddress());
  await reject('unauthorized service publication',async()=>registry.connect(observer).publishRegisteredService.staticCall(
    sid,await router.getAddress(),metadataHash,1,true,3,manifestHash,dependencyRoot,interfaceHash));
  await execute(timelock,governor,registryAddress,registry.interface,'publishRegisteredService',
    [sid,await router.getAddress(),metadataHash,1,true,3,manifestHash,dependencyRoot,interfaceHash],
    'publish-service-v1');
  const service=await registry.getService(sid);
  const profile=await registry.getRegistrationProfile(sid,1);
  assert.equal(service.implementation,await router.getAddress());
  assert.equal(service.codeHash,hashes.ArbitrationRouter420);
  assert.equal(service.metadataHash,metadataHash);
  assert.equal(service.version,1n);
  assert.equal(service.active,true);
  assert.equal(profile.manifestHash,manifestHash);
  assert.equal(profile.dependencyRoot,dependencyRoot);
  assert.equal(profile.interfaceHash,interfaceHash);
  assert.equal(profile.componentType,3n);
  assert.equal((await registry.resolveActive(sid))[0],await router.getAddress());
  await execute(timelock,governor,await policies.getAddress(),policies.interface,'setPolicy',
    [domain,resolverAddress,appealAddress,100,100,2,true],'activate-domain-policy');
  const caseArgs=[domain,respondentAddress,origin,id('LOCAL/SALE/1'),id('LOCAL/CLAIM/1'),id('LOCAL/REMEDY/REQUEST')];
  await reject('unknown policy domain',()=>cases.connect(claimant).openCase.staticCall(
    id('UNAUTHORIZED/DOMAIN'),...caseArgs.slice(1)));
  const caseId=await cases.connect(claimant).openCase.staticCall(...caseArgs);
  await track('user:open-case',await cases.connect(claimant).openCase(...caseArgs));
  let record=await cases.getCase(caseId);
  assert.equal(record.claimant,claimantAddress);assert.equal(record.respondent,respondentAddress);
  assert.equal(record.resolver,resolverAddress);assert.equal(record.appealResolver,appealAddress);
  assert.equal(record.originComponentId,origin);assert.equal(record.round,0n);
  await reject('observer submits evidence',()=>cases.connect(observer).submitEvidence.staticCall(caseId,id('EVIL')));
  await track('user:claimant-evidence',await cases.connect(claimant).submitEvidence(caseId,id('CLAIMANT/EVIDENCE')));
  await track('user:respondent-evidence',await cases.connect(respondent).submitEvidence(caseId,id('RESPONDENT/EVIDENCE')));
  await reject('duplicate evidence commitment',()=>cases.connect(respondent).submitEvidence.staticCall(
    caseId,id('CLAIMANT/EVIDENCE')));
  await reject('wrong resolver initial ruling',()=>rulings.connect(appealResolver).submitRuling.staticCall(
    caseId,1,id('ILLEGAL'),id('ILLEGAL/REMEDY'),ZeroHash));
  await track('resolver:round-0',await rulings.connect(resolver).submitRuling(caseId,1,
    id('LOCAL/RULING/0'),id('LOCAL/REMEDY/0'),ZeroHash));
  assert.equal((await cases.getCase(caseId)).state,2n);
  await reject('ruling finalization before deadline',()=>rulings.finalizeRuling.staticCall(caseId));
  await track('user:appeal',await cases.connect(respondent).appeal(caseId));
  record=await cases.getCase(caseId);assert.equal(record.round,1n);assert.equal(record.state,1n);
  await reject('initial resolver cannot rule on appeal',()=>rulings.connect(resolver).submitRuling.staticCall(
    caseId,2,id('BAD/ROUND'),id('BAD/REMEDY'),ZeroHash));
  await track('resolver:round-1',await rulings.connect(appealResolver).submitRuling(caseId,2,
    id('LOCAL/RULING/1'),id('LOCAL/REMEDY/1'),ZeroHash));
  await rpc('evm_increaseTime',[101]);await rpc('evm_mine',[]);
  await track('user:finalize',await rulings.connect(claimant).finalizeRuling(caseId));
  assert.equal((await cases.getCase(caseId)).state,3n);
  assert.equal((await rulings.getRuling(caseId,0)).outcomeCode,1n);
  assert.equal((await rulings.getRuling(caseId,1)).outcomeCode,2n);
  await reject('finalization replay',()=>rulings.finalizeRuling.staticCall(caseId));
  await execute(timelock,governor,registryAddress,registry.interface,'deprecateService',[sid],'deprecate-service');
  await reject('deprecated service resolution',()=>registry.resolveActive(sid));
  assert.equal((await registry.getService(sid)).active,false);
  await reject('recover with incorrect revision',()=>registry.publishRegisteredService.staticCall(
    sid,await router.getAddress(),metadataHash,1,true,3,manifestHash,dependencyRoot,interfaceHash));
  await execute(timelock,governor,registryAddress,registry.interface,'publishRegisteredService',
    [sid,await router.getAddress(),metadataHash,2,true,3,manifestHash,dependencyRoot,interfaceHash],
    'recover-service-v2');
  const recovered=await registry.resolveActive(sid);
  assert.equal(recovered[0],await router.getAddress());
  assert.equal(recovered[1],2n);
  assert.equal((await registry.getServiceVersion(sid,1)).active,false);
  assert.equal((await registry.getServiceVersion(sid,2)).active,true);
  assert.equal((await registry.getRegistrationProfile(sid,2)).dependencyRoot,dependencyRoot);
  for(const key of keys)assert.equal(await codehash(addresses[key]),hashes[key],
    'Runtime bytecode drift '+key);
  const blocks=receiptOrder.map(x=>BigInt(x.blockNumber));
  assert(blocks.every((b,i)=>i===0||b>blocks[i-1]),'Deployment/action order not strictly increasing');
  const expected=['deploy:policies','deploy:cases','deploy:rulings','execute:one-time-ruling-binding',
    'deploy:router','execute:register-component','execute:publish-service-v1'];
  let last=-1;
  for(const name of expected){
    const pos=receiptOrder.findIndex(x=>x.step===name);
    assert(pos>last,'Invalid 10-stage graph ordering at '+name);
    last=pos;
  }
  const result={schema:'arb-pre-09-local-genesis-evidence-v1',production:false,
    chainId:31337,genesisHash:genesis.hash,approvedAddressModel:sourceManifest.address_policy.arbitration_router_status,
    compiler:{version:'0.8.24',evm:'cancun',optimizer:true,runs:200,viaIR:true},
    canonicalPredeploys:{governanceTimelock:timelockAddress,protocolRegistry:registryAddress},
    localGenesisFixture:'ANVIL_ONLY_REAL_RUNTIME_AND_CONSTRUCTOR_STORAGE_SEE_RUNBOOK',
    addresses,runtimeCodeHashes:hashes,
    registration:{serviceId:sid,componentId:cid,metadataHash,manifestHash,interfaceHash,dependencyRoot,
      publishedVersions:[1,2],activeVersion:2},
    caseId,caseFinalized:true,appealRound:1,negativeTests:evidence,
    transactions:receiptOrder};
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  const reproducible={schema:result.schema,compiler:result.compiler,
    canonicalPredeploys:result.canonicalPredeploys,addresses:result.addresses,
    runtimeCodeHashes:result.runtimeCodeHashes,registration:result.registration,
    steps:result.transactions.map(x=>({step:x.step,created:x.created,from:x.from,to:x.to}))};
  writeFileSync(output.replace(/\.json$/,'.reproducible.json'),
    JSON.stringify(reproducible,null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',output,chainId:31337,governance:'REAL_G1_DELAY_EXECUTED',
    transactions:receiptOrder.length,contractHashCount:Object.keys(hashes).length,
    negativeTests:evidence.length,caseFinalized:true,appealRound:1,serviceRecovered:true}));
}
async function executeExpectFailure(timelock,governor,target,iface,method,args,label){
  const data=iface.encodeFunctionData(method,args);
  const key=id('420/arb-pre-09/negative/'+label);
  await track('schedule-negative:'+label,
    await timelock.connect(governor).schedule(key,target,0n,data,0));
  await rpc('evm_increaseTime',[604801]);await rpc('evm_mine',[]);
  await reject(label,()=>timelock.execute.staticCall(key));
}
try{await main();}finally{anvil.kill('SIGTERM');provider.destroy();}
