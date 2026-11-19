import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync} from 'node:fs';
import {JsonRpcProvider,Contract,ContractFactory,Wallet,ZeroAddress,id,keccak256} from 'ethers';
import {materialize,makePlan,nextStep,recoverDeployment,recoverGovernance,submitDeployment,validateBundle} from './deployment.mjs';
import {createTreasuryClient420} from '../../wallet/web/core/treasury-client.js';

const rpc=new JsonRpcProvider(process.env.TREASURY_RPC_URL,undefined,{cacheTimeout:0,batchMaxCount:1});
rpc.pollingInterval=50;
const bundle=materialize(process.env.TREASURY_ROOT);
const TIME='0x0000000000000000000000000000000000000429',REG='0x0000000000000000000000000000000000000434',GOV='0x0000000000000000000000000000000000000437';
const SID=id('420/service/treasury/v1'),CID=id('420/APP/420TREASURY/TREASURY_ROUTER');
const receipt=async promise=>{const r=await (await promise).wait();assert.equal(r.status,1);return r;};
const onchain=(name,a)=>new Contract(a,bundle.artifacts[name]?.abi??bundle.anchors[name].abi,rpc);
const nonce=async a=>Number(BigInt(await rpc.send('eth_getTransactionCount',[a,'latest'])));
const block=async()=>Number(BigInt(await rpc.send('eth_blockNumber',[])));
const reject=async(fn,pattern)=>assert.rejects(fn,pattern);
const record=(r,stage)=>({stage,transactionHash:r.hash,blockHash:r.blockHash,blockNumber:r.blockNumber,from:r.from,to:r.to});
const journal={},governanceReceipts=[];
let deployer,operator,registrar,caps,gov,timelock,registry,plan;
let seq=0;
const artifact=bundle.artifacts.CapabilityRegistry420;
const evidenceFile=process.env.TREASURY_EVIDENCE;
async function setup(){
 assert.equal(await rpc.send('eth_chainId',[]),'0x7a69');
 for(const [name,a] of Object.entries(bundle.anchors)){
  await rpc.send('anvil_setCode',[a.address,a.runtime]);
  for(const [slot,value] of Object.entries(a.storage))await rpc.send('anvil_setStorageAt',[a.address,slot,value]);
  assert.equal(keccak256(await rpc.send('eth_getCode',[a.address,'latest'])),a.codeHash,name);
 }
 await rpc.send('anvil_impersonateAccount',[GOV]);await rpc.send('anvil_setBalance',[GOV,'0x3635c9adc5dea00000']);
 gov=new (await import('ethers')).JsonRpcSigner(rpc,GOV);
 timelock=onchain('GovernanceTimelock',TIME);registry=onchain('ProtocolRegistry',REG);
 assert.equal((await timelock.scheduler()).toLowerCase(),GOV.toLowerCase());
 // Public Anvil test fixture key only; never a release key.
 deployer=new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',rpc);
 registrar=await rpc.getSigner(1);operator=await rpc.getSigner(2);
 caps=await new ContractFactory(artifact.abi,artifact.creation,registrar).deploy();await caps.waitForDeployment();
 const g=await rpc.send('eth_getBlockByNumber',['0x0',false]);
 plan=makePlan(bundle,{chainId:31337,genesisHash:g.hash,deployer:deployer.address,capabilityRegistry:caps.target,operator:operator.address,capabilityAuthority:TIME,startNonce:await nonce(deployer.address),startBlock:await block()});
}
async function next(p=plan,j=journal){return nextStep(rpc,bundle,p,j);}
async function signDeploy(step,overrides={}){
 const tx=step.transaction;
 return deployer.signTransaction({type:0,chainId:BigInt(tx.chainId),nonce:tx.nonce,to:null,value:0n,data:tx.data,gasLimit:12000000n,gasPrice:2000000000n,...overrides});
}
async function deploy(p=plan,j=journal,save=true){
 const step=await next(p,j);assert.equal(step.stage,'DEPLOY');
 const raw=await signDeploy(step);
 const submitted=await submitDeployment(rpc,bundle,p,j,raw);
 const r=await rpc.waitForTransaction(submitted.transactionHash);assert.equal(r.status,1);
 assert.equal(r.contractAddress.toLowerCase(),step.expectedAddress.toLowerCase());
 if(save)j[step.name]=r.hash;
 return {step,r};
}
async function govern(step,p=plan,j=journal,check=true,save=true){
 assert.equal(step.authority.toLowerCase(),TIME.toLowerCase());
 if(check)assert.deepEqual((await next(p,j)).data,step.data);
 const op=id('REC8-local-operation-'+(++seq));
 const schedule=await receipt(timelock.connect(gov).schedule(op,step.target,0,step.data,1));
 await reject(()=>timelock.connect(registrar).execute.staticCall(op),/timelocked|revert/i);
 await rpc.send('evm_increaseTime',[14*86400]);await rpc.send('evm_mine',[]);
 if(check)assert.equal((await next(p,j)).data,step.data);
 const r=await receipt(timelock.connect(registrar).execute(op));
 governanceReceipts.push(record(schedule,step.stage+':scheduled'),record(r,step.stage+':executed'));
 if(check&&save&&['INITIALIZE_CONTROLLER','REGISTER_ROUTER_COMPONENT','PUBLISH_SERVICE'].includes(step.stage))j[step.stage]=r.hash;
 return r;
}
async function capRegister(step,p=plan,j=journal){
 assert.equal((await next(p,j)).stage,'REGISTER_CAPABILITY_COMPONENT');
 assert.equal(step.authority.toLowerCase(),registrar.address.toLowerCase());
 const r=await receipt(registrar.sendTransaction({to:step.target,data:step.data,value:0}));
 governanceReceipts.push(record(r,step.stage));
}
const allDeployments=async(p,j)=>{for(let i=0;i<4;i++)await deploy(p,j);const init=await next(p,j);assert.equal(init.stage,'INITIALIZE_CONTROLLER');await govern(init,p,j);await deploy(p,j);await deploy(p,j);};

test('Treasury REC-8 actual local deployment and recovery',async t=>{
 try{
 await setup();
 await t.test('release bundle reproducible, inventory and canonical anchors',async()=>{
  assert.deepEqual(materialize(process.env.TREASURY_ROOT_SECOND),bundle);
  assert.equal(Object.keys(bundle.artifacts).length,7);
  assert.equal(bundle.liveQualified,false);assert.deepEqual(bundle.live,{chainId:null,genesisHash:null,addresses:{},transactions:[],receipts:[]});
  const changed=structuredClone(bundle);changed.artifacts.TreasuryRouter420.creation='0x1234';assert.throws(()=>validateBundle(changed),/digest mismatch/);
  await reject(()=>nextStep(rpc,bundle,makePlan(bundle,{...plan,genesisHash:id('wrong genesis')}),{}),/wrong deployment genesis/);
  await reject(()=>nextStep(rpc,bundle,{...plan,operator:registrar.address},{}),/plan mismatch/);
 });
 await t.test('signed CREATE, lost result recovery, wrong data and no blind retry',async()=>{
  const step=await next();await reject(async()=>submitDeployment(rpc,bundle,plan,journal,await signDeploy(step,{data:'0x6000'})),/differs/);
  const {r}=await deploy(plan,journal,false);
  await reject(()=>next(),/recovery required/);
  const recovered=await recoverDeployment(rpc,bundle,plan,step.name,r.blockNumber,r.blockNumber);assert.equal(recovered.transactionHash,r.hash);
  journal[step.name]=recovered.transactionHash;
  const forged={...journal,[step.name]:id('missing tx')};await reject(()=>next(plan,forged),/deployment transaction mismatch/);
  await deploy();await deploy();await deploy();
 });
 await t.test('governed one-time initialization, reject wrong dependency and premature router',async()=>{
  const init=await next();assert.equal(init.stage,'INITIALIZE_CONTROLLER');
  const d=Object.fromEntries(plan.deployments.map(x=>[x.name,x.address]));
  const bud=onchain('TreasuryBudgetRegistry420',d.TreasuryBudgetRegistry420);
  await reject(()=>bud.connect(registrar).setController.staticCall(d.TreasuryDisbursementRegistry420),/revert|Unauthorized/i);
  const snapshot=await rpc.send('evm_snapshot',[]);
  const wrong={...init,data:bud.interface.encodeFunctionData('setController',[registrar.address])};
  await govern(wrong,plan,journal,false);await reject(()=>next(),/incorrect irreversible controller/);
  assert.equal(await rpc.send('evm_revert',[snapshot]),true);governanceReceipts.splice(-2);
  await reject(()=>next(plan,{...journal,TreasuryRouter420:id('premature')}),/premature router/);
  const initReceipt=await govern(init,plan,journal,true,false);
  await reject(()=>next(),/governed receipt recovery required/);
  journal.INITIALIZE_CONTROLLER=(await recoverGovernance(rpc,bundle,plan,journal,'INITIALIZE_CONTROLLER',initReceipt.blockNumber,initReceipt.blockNumber)).transactionHash;
  await reject(()=>bud.connect(gov).setController.staticCall(registrar.address),/revert|Unauthorized/i);
  await deploy();await deploy();
  const step=await next();assert.equal(step.stage,'REGISTER_CAPABILITY_COMPONENT');
  const bad=structuredClone(plan);bad.deployments[4].args[0]=registrar.address;await reject(()=>next(bad),/plan mismatch/);
  const router=d.TreasuryRouter420,snap=await rpc.send('evm_snapshot',[]);
  await rpc.send('anvil_setCode',[router,'0x60006000f3']);await reject(()=>next(),/runtime length mismatch/);
  assert.equal(await rpc.send('evm_revert',[snap]),true);
 });
 await t.test('fail closed while incomplete, governed registration and exact commitments',async()=>{
  const start=await next();assert.equal(start.stage,'REGISTER_CAPABILITY_COMPONENT');
  assert.equal((await registry.getService(SID)).version,0n);
  const wallet=createTreasuryClient420({provider:{request:(m,p)=>rpc.send(m,p)},chainId:'0x7a69',registryCodeHash:bundle.anchors.ProtocolRegistry.codeHash});
  await reject(()=>wallet.discover(),/inactive|zero Treasury address/);
  await capRegister(start);
  const component=await next();assert.equal(component.stage,'REGISTER_ROUTER_COMPONENT');
  await govern(component);
  assert.equal((await registry.getService(SID)).version,0n);
  await reject(()=>wallet.discover(),/inactive|zero Treasury address/);
  const publish=await next();assert.equal(publish.stage,'PUBLISH_SERVICE');
  await reject(()=>registry.connect(registrar).publishRegisteredService.staticCall(SID,publish.commitments.router,bundle.metadataHash,1,true,3,bundle.manifestHash,publish.commitments.dependencyRoot,bundle.interfaceHash),/revert|Unauthorized/i);
  const publication=await govern(publish,plan,journal,true,false);
  await reject(()=>next(),/governed receipt recovery required/);
  journal.PUBLISH_SERVICE=(await recoverGovernance(rpc,bundle,plan,journal,'PUBLISH_SERVICE',publication.blockNumber,publication.blockNumber)).transactionHash;
  const complete=await next();assert.equal(complete.stage,'COMPLETE');
  assert.equal(complete.commitments.dependencyRoot,publish.commitments.dependencyRoot);
  assert.equal(complete.commitments.manifestHash,bundle.manifestHash);
  assert.equal(complete.commitments.interfaceHash,bundle.interfaceHash);
  assert.equal(complete.liveQualified,false);
  const discovered=await wallet.discover();assert.equal(discovered.router.toLowerCase(),complete.commitments.router.toLowerCase());
  assert.equal(discovered.budgets.toLowerCase(),complete.indexerBinding.addresses.TreasuryBudgetRegistry420.toLowerCase());
  assert.equal((await next()).stage,'COMPLETE');
  writeFileSync(evidenceFile,JSON.stringify({schema:'420-treasury-rec8-local-rehearsal-v1',chainContext:'LOCAL_ANVIL_ONLY',genesisHash:plan.genesisHash,release:complete,governanceReceipts},null,2)+'\n');
  console.log('REC8_LOCAL_RELEASE='+JSON.stringify({manifestHash:bundle.manifestHash,metadataHash:bundle.metadataHash,interfaceHash:bundle.interfaceHash,dependencyRoot:complete.commitments.dependencyRoot,deployments:complete.evidence,governanceReceipts}));
 });
 await t.test('corrective redeployment requires governed prior deprecation and new revision',async()=>{
  const first=await next();
  const replacement=makePlan(bundle,{...plan,startNonce:await nonce(deployer.address),startBlock:await block(),previousVersion:1,previousRouter:first.commitments.router});
  const j={};
  await reject(()=>next(replacement,j),/active previous service/);
  const dep={stage:'DEPRECATE_SERVICE',authority:TIME,target:REG,data:registry.interface.encodeFunctionData('deprecateService',[SID])};
  await govern(dep,plan,journal,false);
  await reject(()=>next(replacement,j),/active\/foreign component/);
  const pause={stage:'PAUSE_COMPONENT',authority:TIME,target:REG,data:registry.interface.encodeFunctionData('setComponentLifecycle',[CID,3])};
  await govern(pause,plan,journal,false);
  await allDeployments(replacement,j);
  const component=await next(replacement,j);assert.equal(component.stage,'REGISTER_ROUTER_COMPONENT');
  await govern(component,replacement,j);
  const publish=await next(replacement,j);assert.equal(publish.stage,'PUBLISH_SERVICE');assert.equal(publish.commitments.revision,2);
  await govern(publish,replacement,j);
  const second=await next(replacement,j);assert.equal(second.stage,'COMPLETE');
  assert.notEqual(second.commitments.router,first.commitments.router);
  assert.equal((await registry.getServiceVersion(SID,1)).implementation.toLowerCase(),first.commitments.router.toLowerCase());
  assert.equal((await registry.getServiceVersion(SID,1)).active,false);
  assert.equal((await registry.currentVersion(SID)),2n);
  const out=JSON.parse(readFileSync(evidenceFile));out.correctiveRelease=second;out.governanceReceipts=governanceReceipts;
  writeFileSync(evidenceFile,JSON.stringify(out,null,2)+'\n');
  console.log('REC8_CORRECTIVE_RELEASE='+JSON.stringify({revision:2,router:second.commitments.router,deployments:second.evidence,governanceReceipts:governanceReceipts.slice(-8)}));
 });
 }finally{rpc.destroy();}
});