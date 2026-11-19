/** Treasury REC-8: deterministic release inputs and fail-closed deployment tooling.
 * No CREATE2, auto-governance, keys, or live deployment values are embedded. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AbiCoder,Contract,Interface,ContractFactory,JsonRpcProvider,Transaction,getCreateAddress,getAddress,id,keccak256,toUtf8Bytes,ZeroAddress,ZeroHash} from 'ethers';

const repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const names=['TreasuryAuthorization420','TreasuryPolicyRegistry420','TreasuryBudgetRegistry420','TreasuryDisbursementRegistry420','TreasuryRouter420','TreasuryReleaseExecutor420'];
const [AUTH,POL,BUD,DIS,ROUTER,EXEC]=names;
const CAP='CapabilityRegistry420',TIME='GovernanceTimelock',REG='ProtocolRegistry';
const SID=id('420/service/treasury/v1'),CID=id('420/APP/420TREASURY/TREASURY_ROUTER'),CAPID=id('420/TREASURY/COMPONENT/V1');
const req=(v,m)=>{if(!v)throw Error(m)};
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const canon=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
const digest=v=>keccak256(toUtf8Bytes(canon(v)));
const sha=v=>createHash('sha256').update(v).digest('hex');
const address=v=>{const a=getAddress(v);req(a!==ZeroAddress,'zero address');return a;};
const hash=v=>{req(typeof v==='string'&&/^0x[0-9a-fA-F]{64}$/.test(v)&&v.toLowerCase()!==ZeroHash,'invalid hash');return v.toLowerCase()};
const hex=v=>{req(typeof v==='string'&&/^0x(?:[a-fA-F0-9]{2})+$/.test(v),'missing/link-unresolved bytecode');return v.toLowerCase()};
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const nonempty=o=>Object.keys(o??{}).length>0;
const abi=new AbiCoder();
const frozen={TIME:'0x0000000000000000000000000000000000000429',REG:'0x0000000000000000000000000000000000000434'};
const reserved=a=>BigInt(a)>=0x420n&&BigInt(a)<=0x4ffn;
const write=(path,v)=>writeFileSync(path,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
function artifact(root,name){
 const path=join(root,'out',name+'.sol',name+'.json'),raw=readFileSync(path),a=JSON.parse(raw);
 const creation=hex(a.bytecode.object),runtime=hex(a.deployedBytecode.object);
 req(Array.isArray(a.abi)&&a.storageLayout&&a.storageLayout.storage,'missing ABI/storage layout '+name);
 req(!nonempty(a.bytecode.linkReferences)&&!nonempty(a.deployedBytecode.linkReferences),'unresolved libraries '+name);
 const refs=a.deployedBytecode.immutableReferences??{};
 const meta=typeof a.metadata==='string'?JSON.parse(a.metadata):a.metadata;
 req(meta?.compiler?.version?.startsWith('0.8.24+')&&meta.settings?.evmVersion==='cancun'&&meta.settings.optimizer.enabled&&meta.settings.optimizer.runs===200&&meta.settings.viaIR===true,'compiler profile mismatch '+name);
 return {name,abi:a.abi,creation,runtime,immutableReferences:refs,storageLayout:a.storageLayout,
  compiler:meta.compiler.version,settings:meta.settings,sources:meta.sources,
  artifactSha256:sha(raw),abiHash:digest(a.abi),creationHash:keccak256(creation),runtimeTemplateHash:keccak256(runtime)};
}
export function materialize(root){
 const ns=json(join(repo,'contracts/config/genesis-address-namespace.json')),old=json(join(repo,'contracts/config/treasury/treasury-audit-6-release-materialization.json'));
 const genesis=json(join(repo,'contracts/config/420treasury-genesis.json')),executor=json(join(repo,'contracts/config/treasury/treasury-release-executor.json'));
 const fixed=Object.fromEntries(ns.fixedAssignments.map(x=>[x.name,x.address]));
 req(eq(fixed[TIME],frozen.TIME)&&eq(fixed[REG],frozen.REG),'frozen anchors drift');
 req(!names.some(n=>n in fixed)&&ns.registryResolved.some(x=>x.id==='treasury-router'&&x.status==='REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS'),'Treasury address reservation drift');
 const candidate=ns.activeNonPredeployReservations.find(x=>x.name===CAP);
 req(candidate?.address==='0x0000000000000000000000000000000000000447'&&candidate.status==='CANDIDATE_NOT_DEPLOYED_NOT_FROZEN','CapabilityRegistry reservation drift');
 req(genesis.new_frozen_predeploy_required===false&&executor.new_frozen_predeploy===false&&executor.new_service_id===false,'Treasury authority drift');
 req(old.address_policy.create2_policy==='NOT_ADOPTED_DO_NOT_INVENT'&&old.live_qualified===false&&executor.live_qualified===false,'deployment policy drift');
 for(const x of [old.live_testnet_evidence.deployed_addresses,old.live_testnet_evidence.runtime_code_hashes])req(!nonempty(x),'unexpected live evidence');
 for(const k of ['chain_id','genesis_hash','evidence_block','evidence_block_hash'])req(old.live_testnet_evidence[k]===null,'unexpected live '+k);
 for(const k of ['deployment_transactions','registry_transactions','constructor_binding_receipts'])req(old.live_testnet_evidence[k].length===0,'unexpected live '+k);
 for(const k of ['production_address','operator','executor_runtime_code_hash'])req(executor[k]===null,'unexpected live executor '+k);
 const anchors={};
 for(const [n,a] of [[TIME,frozen.TIME],[REG,frozen.REG]]){
  const state=json(join(repo,'contracts/config/predeploy',n+'-predeploy-state.json')),art=json(join(repo,'contracts/artifacts',n+'.json'));
  req(eq(state.address,a)&&eq(state.runtimeCodeHash,art.runtimeCodeHash)&&eq(keccak256(hex(art.deployedBytecode)),state.runtimeCodeHash),'canonical runtime artifact mismatch '+n);
  anchors[n]={address:a,codeHash:hash(state.runtimeCodeHash),abi:art.abi,runtime:art.deployedBytecode,storage:state.storage,artifactHash:digest(art)};
 }
 const artifacts=Object.fromEntries([...names,CAP].map(n=>[n,artifact(root,n)]));
 const constructorTypes=n=>new Interface(artifacts[n].abi).deploy.inputs.map(x=>x.type);
 for(const [n,count] of [[AUTH,1],[POL,1],[BUD,2],[DIS,4],[ROUTER,2],[EXEC,2],[CAP,0]])req(canon(constructorTypes(n))===canon(Array(count).fill('address')),'constructor ABI drift '+n);
 const metadata={schema:'420-treasury-release-metadata-v1',serviceId:SID,componentId:CID,capabilityComponentId:CAPID,protocolVersion:1,authority:'AUTHORIZED_EXECUTOR_COMMITMENT_ONLY',contracts:names};
 const payload={schema:'420-treasury-release-inputs-v1',metadata,anchors,capabilityCandidate:candidate,artifacts,canonicalDeployment:old.deployment_order,liveQualified:false,
  live:{chainId:null,genesisHash:null,addresses:{},transactions:[],receipts:[]}};
 return {...payload,manifestHash:digest(payload),metadataHash:digest(metadata),interfaceHash:artifacts[ROUTER].abiHash};
}
export function validateBundle(b){
 const {manifestHash,metadataHash,interfaceHash,...payload}=b;
 req(b.schema==='420-treasury-release-inputs-v1'&&eq(digest(payload),manifestHash)&&eq(digest(b.metadata),metadataHash)&&eq(digest(b.artifacts[ROUTER].abi),interfaceHash),'release bundle digest mismatch');
 req(eq(b.anchors[TIME].address,frozen.TIME)&&eq(b.anchors[REG].address,frozen.REG)&&b.liveQualified===false,'release authority mismatch');
 for(const n of [...names,CAP]){
  const a=b.artifacts[n];req(a.name===n&&eq(keccak256(hex(a.creation)),a.creationHash)&&eq(keccak256(hex(a.runtime)),a.runtimeTemplateHash)&&eq(digest(a.abi),a.abiHash),'artifact digest mismatch '+n);
 }
 return b;
}
export function makePlan(bundle,input){
 const b=validateBundle(bundle);
 const chainId=String(input.chainId);req(/^[1-9]\d*$/.test(chainId),'invalid chain ID');
 // Local rehearsal and actual chain 420 only; no alternate production chain.
 req(chainId==='420'||chainId==='31337','unsupported Treasury chain');
 const genesisHash=hash(input.genesisHash),deployer=address(input.deployer),capabilityRegistry=address(input.capabilityRegistry),operator=address(input.operator),capabilityAuthority=address(input.capabilityAuthority);
 req(Number.isSafeInteger(input.startNonce)&&input.startNonce>=0&&input.startNonce<=Number.MAX_SAFE_INTEGER-6&&Number.isSafeInteger(input.startBlock)&&input.startBlock>=0,'invalid deployment coordinates');
 const previousVersion=input.previousVersion??0;req(Number.isInteger(previousVersion)&&previousVersion>=0&&previousVersion<4294967295,'invalid publication revision');
 const previousRouter=previousVersion===0?null:address(input.previousRouter);
 const dep={};names.forEach((n,i)=>dep[n]=getCreateAddress({from:deployer,nonce:input.startNonce+i}));
 req(new Set([frozen.TIME,frozen.REG,capabilityRegistry,...Object.values(dep)].map(x=>x.toLowerCase())).size===9,'duplicate deployment binding');
 req(Object.values(dep).every(x=>!reserved(x)),'deployment collides with reserved namespace');
 const args={[AUTH]:[capabilityRegistry],[POL]:[frozen.TIME],[BUD]:[frozen.TIME,dep[POL]],[DIS]:[frozen.TIME,dep[AUTH],dep[POL],dep[BUD]],[ROUTER]:[dep[BUD],dep[DIS]],[EXEC]:[frozen.REG,operator]};
 const deployments=names.map((n,i)=>({name:n,address:dep[n],nonce:input.startNonce+i,args:args[n],data:b.artifacts[n].creation+new Interface(b.artifacts[n].abi).encodeDeploy(args[n]).slice(2)}));
 const p={schema:'420-treasury-deployment-plan-v1',manifestHash:b.manifestHash,chainId,genesisHash,deployer,capabilityRegistry,operator,capabilityAuthority,startNonce:input.startNonce,startBlock:input.startBlock,previousVersion,previousRouter,deployments};
 return {...p,planHash:digest(p)};
}
function checkedPlan(b,p){
 const expected=makePlan(b,p);req(canon(expected)===canon(p),'deployment plan mismatch');return expected;
}
async function chainCheck(rpc,p){
 req(BigInt(await rpc.send('eth_chainId',[]))===BigInt(p.chainId),'wrong deployment chain');
 const g=await rpc.send('eth_getBlockByNumber',['0x0',false]);req(eq(g?.hash,p.genesisHash),'wrong deployment genesis');
}
const quantity=n=>'0x'+BigInt(n).toString(16);
const code=(rpc,a,tag)=>rpc.send('eth_getCode',[a,tag]);
function runtimeMatch(a,actual,args){
 const template=Buffer.from(a.runtime.slice(2),'hex'),bytes=Buffer.from(hex(actual).slice(2),'hex');
 req(bytes.length===template.length,'runtime length mismatch '+a.name);
 const allowed=args.map(x=>Buffer.from(abi.encode(['address'],[x]).slice(2),'hex'));
 const occupied=new Set();
 for(const group of Object.values(a.immutableReferences)){
  let first;
  for(const ref of group){const {start,length}=ref;
   req(Number.isInteger(start)&&length===32&&start>=0&&start+length<=bytes.length,'invalid immutable reference');
   const value=bytes.subarray(start,start+length);
   req(allowed.some(x=>x.equals(value))&&(!first||first.equals(value)),'immutable runtime mismatch '+a.name);first=value;
   for(let i=start;i<start+length;i++){req(!occupied.has(i),'overlapping immutable reference');occupied.add(i);bytes[i]=template[i];}
  }
 }
 req(template.equals(bytes),'runtime bytecode mismatch '+a.name);
}
const contract=(rpc,b,n,a)=>new Contract(a,b.artifacts[n]?.abi??b.anchors[n].abi,rpc);
const read=(c,f,args,tag)=>c.getFunction(f).staticCall(...args,{blockTag:tag});
const getter=async(c,f,expected,tag)=>req(eq(await read(c,f,[],tag),expected),'dependency binding mismatch '+f);
async function verifyDeployment(rpc,b,p,d,txHash,tag){
 const [tx,receipt]=await Promise.all([rpc.send('eth_getTransactionByHash',[hash(txHash)]),rpc.send('eth_getTransactionReceipt',[txHash])]);
 req(tx&&receipt&&eq(tx.hash,txHash)&&eq(receipt.transactionHash,txHash)&&eq(tx.from,p.deployer)&&eq(receipt.from,p.deployer)&&tx.to===null&&receipt.to===null&&BigInt(tx.value)===0n&&BigInt(tx.nonce)===BigInt(d.nonce)&&eq(tx.input,d.data),'deployment transaction mismatch '+d.name);
 req(BigInt(receipt.status)===1n&&eq(receipt.contractAddress,d.address)&&eq(receipt.blockHash,tx.blockHash)&&BigInt(receipt.blockNumber)===BigInt(tx.blockNumber)&&BigInt(tx.transactionIndex)===BigInt(receipt.transactionIndex)&&BigInt(receipt.blockNumber)<=BigInt(tag)&&BigInt(receipt.blockNumber)>=BigInt(p.startBlock),'deployment receipt mismatch '+d.name);
 const block=await rpc.send('eth_getBlockByNumber',[receipt.blockNumber,false]);req(eq(block?.hash,receipt.blockHash)&&eq(block.transactions[Number(BigInt(receipt.transactionIndex))],txHash),'orphan deployment receipt');
 const actual=await code(rpc,d.address,tag);runtimeMatch(b.artifacts[d.name],actual,d.args);
 const c=contract(rpc,b,d.name,d.address);
 if(d.name!==EXEC){req(await read(c,'systemName',[],tag)===d.name&&await read(c,'protocolVersion',[],tag)===1n,'Treasury identity mismatch');}
 const props={[AUTH]:['capabilityRegistry'],[POL]:['governanceTimelock'],[BUD]:['governanceTimelock','policy'],[DIS]:['governanceTimelock','authorization','policy','budgets'],[ROUTER]:['budgets','disbursements'],[EXEC]:['registry','operator']};
 for(let i=0;i<d.args.length;i++)await getter(c,props[d.name][i],d.args[i],tag);
 return {name:d.name,address:d.address,transactionHash:txHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,runtimeCodeHash:keccak256(actual)};
}
function action(target,iface,method,args,authority,stage){return {stage,authority,target,value:'0',data:iface.encodeFunctionData(method,args)};}
export async function nextStep(rpc,b,p,journal={}){
 checkedPlan(b,p);await chainCheck(rpc,p);
 req(journal&&typeof journal==='object'&&!Array.isArray(journal)&&Object.keys(journal).every(k=>names.includes(k)),'invalid deployment journal');
 const block=await rpc.send('eth_getBlockByNumber',['latest',false]),tag=block.number;
 req(BigInt(tag)>=BigInt(p.startBlock),'deployment start block unavailable');
 const finish=async out=>{const end=await rpc.send('eth_getBlockByNumber',[tag,false]);req(eq(end?.hash,block.hash),'deployment snapshot reorganized');await chainCheck(rpc,p);return {...out,planHash:p.planHash,blockNumber:tag,blockHash:block.hash};};
 for(const n of [TIME,REG])req(eq(keccak256(await code(rpc,b.anchors[n].address,tag)),b.anchors[n].codeHash),'canonical anchor mismatch '+n);
 const registry=contract(rpc,b,REG,frozen.REG);await getter(registry,'governanceTimelock',frozen.TIME,tag);
 req(await read(registry,'systemName',[],tag)==='ProtocolRegistry'&&await read(registry,'protocolVersion',[],tag)===4n,'Registry identity mismatch');
 const caps=contract(rpc,b,CAP,p.capabilityRegistry);
 runtimeMatch(b.artifacts[CAP],await code(rpc,p.capabilityRegistry,tag),[]);
 const registrar=address(await read(caps,'componentRegistrar',[],tag));
 const managed=await read(caps,'protocolComponentManaged',[CAPID],tag),authority=await read(caps,'componentAuthority',[CAPID],tag);
 req(managed?eq(authority,p.capabilityAuthority):eq(authority,ZeroAddress),'capability component authority mismatch');
 const service=await read(registry,'getService',[SID],tag),component=await read(registry,'component',[CID],tag);
 const dep=Object.fromEntries(p.deployments.map(d=>[d.name,d.address]));
 const rev=BigInt(p.previousVersion+1),published=service.version===rev;
 if(published)req(service.active&&eq(service.implementation,dep[ROUTER]),'unexpected published service');
 else{
  req(service.version===BigInt(p.previousVersion)&&!service.active,'unexpected/active previous service; governed deprecation required');
  if(p.previousVersion>0)req(eq(service.implementation,p.previousRouter),'previous router mismatch');
 }
 const componentIsNew=eq(component.implementation,dep[ROUTER]);
 if(componentIsNew)req(component.lifecycle===2n&&component.version.major===1n&&component.version.minor===0n&&component.version.patch===0n,'new component lifecycle/version mismatch');
 else req(!published&&(p.previousVersion===0?eq(component.implementation,ZeroAddress):eq(component.implementation,p.previousRouter)&&component.lifecycle!==2n),'unexpected active/foreign component');
 const evidence=[];
 for(let i=0;i<p.deployments.length;i++){
  const d=p.deployments[i];
  if(i===4){
   const budget=contract(rpc,b,BUD,dep[BUD]),controller=await read(budget,'controller',[],tag);
   if(eq(controller,ZeroAddress)){
    req(!published&&!componentIsNew&&!names.slice(i).some(n=>journal[n]),'premature router/publication');
    return finish({...action(dep[BUD],budget.interface,'setController',[dep[DIS]],frozen.TIME,'INITIALIZE_CONTROLLER'),evidence});
   }
   req(eq(controller,dep[DIS]),'incorrect irreversible controller; corrective redeployment required');
  }
  if(!journal[d.name]){
   req(!published&&!componentIsNew&&!names.slice(i+1).some(n=>journal[n]),'nonsequential or prematurely published deployment');
   const current=BigInt(await rpc.send('eth_getTransactionCount',[p.deployer,tag])),pending=BigInt(await rpc.send('eth_getTransactionCount',[p.deployer,'pending']));
   req(await code(rpc,d.address,tag)==='0x'&&current===BigInt(d.nonce)&&pending===current,'deployment recovery required; do not retry or replace nonce');
   return finish({stage:'DEPLOY',name:d.name,expectedAddress:d.address,transaction:{chainId:p.chainId,from:p.deployer,nonce:d.nonce,to:null,value:'0',data:d.data},evidence});
  }
  evidence.push(await verifyDeployment(rpc,b,p,d,journal[d.name],tag));
 }
 req(evidence.every((e,i)=>i===0||BigInt(e.blockNumber)>BigInt(evidence[i-1].blockNumber)||BigInt(e.blockNumber)===BigInt(evidence[i-1].blockNumber)),'out of order deployment provenance');
 const root=keccak256(abi.encode(Array(6).fill('address').concat(Array(5).fill('bytes32')),
  [p.capabilityRegistry,...names.slice(0,5).map(n=>dep[n]),...evidence.slice(0,5).map(e=>e.runtimeCodeHash)]));
 const commitments={serviceId:SID,componentId:CID,capabilityComponentId:CAPID,metadataHash:b.metadataHash,manifestHash:b.manifestHash,dependencyRoot:root,interfaceHash:b.interfaceHash,revision:Number(rev),router:dep[ROUTER]};
 if(!managed){
  req(!published&&!componentIsNew,'publication without capability component');
  return finish({...action(p.capabilityRegistry,caps.interface,'registerProtocolComponent',[CAPID,p.capabilityAuthority],registrar,'REGISTER_CAPABILITY_COMPONENT'),evidence,commitments});
 }
 if(!componentIsNew)return finish({...action(frozen.REG,registry.interface,'registerComponent',[CID,dep[ROUTER],[1,0,0],2],frozen.TIME,'REGISTER_ROUTER_COMPONENT'),evidence,commitments});
 req(eq(component.runtimeCodeHash,evidence[4].runtimeCodeHash),'component runtime mismatch');
 if(!published)return finish({...action(frozen.REG,registry.interface,'publishRegisteredService',[SID,dep[ROUTER],b.metadataHash,rev,true,3,b.manifestHash,root,b.interfaceHash],frozen.TIME,'PUBLISH_SERVICE'),evidence,commitments});
 const profile=await read(registry,'getRegistrationProfile',[SID,rev],tag);
 const active=await read(registry,'resolveActive',[SID],tag);
 req(eq(service.codeHash,evidence[4].runtimeCodeHash)&&eq(service.metadataHash,b.metadataHash)&&profile.componentType===3n&&eq(profile.manifestHash,b.manifestHash)&&eq(profile.dependencyRoot,root)&&eq(profile.interfaceHash,b.interfaceHash)&&eq(active[0],dep[ROUTER])&&active[1]===rev&&eq(await read(registry,'resolve',[CID],tag),dep[ROUTER]),'published release commitment mismatch');
 return finish({stage:'COMPLETE',evidence,commitments,indexerBinding:{chainId:Number(p.chainId),genesisHash:p.genesisHash,addresses:{[POL]:dep[POL],[BUD]:dep[BUD],[DIS]:dep[DIS]}},releaseExecutor:{address:dep[EXEC],operator:p.operator,codeHash:evidence[5].runtimeCodeHash},authoritative:false,liveQualified:false});
}
// Bounded recovery only; the operator must provide a canonical review window.
// Never infer success from predicted address alone or automatically reuse a nonce.
export async function recoverDeployment(rpc,b,p,name,from,to){
 checkedPlan(b,p);await chainCheck(rpc,p);
 req(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from>=p.startBlock&&to>=from&&to-from<=2048,'invalid recovery window');
 const d=p.deployments.find(x=>x.name===name);req(d,'unknown deployment');
 let found=null;
 for(let i=from;i<=to;i++){
  const block=await rpc.send('eth_getBlockByNumber',[quantity(i),true]);req(block&&Array.isArray(block.transactions),'missing recovery block');
  for(const tx of block.transactions)if(eq(tx.from,p.deployer)&&BigInt(tx.nonce)===BigInt(d.nonce)){
   req(!found,'duplicate nonce in recovery history');
   found=await verifyDeployment(rpc,b,p,d,tx.hash,quantity(to));
  }
 }
 req(found,'no canonical deployment found in reviewed range; no automatic retry');await chainCheck(rpc,p);return found;
}
// Signed deployment submission requires exact reviewed chain, nonce, sender and creation bytes.
// Governance/registrar actions are never signed or executed by this utility.
export async function submitDeployment(rpc,b,p,journal,raw){
 const next=await nextStep(rpc,b,p,journal);req(next.stage==='DEPLOY','not a deployable stage');
 const tx=Transaction.from(raw),want=next.transaction;
 req(tx.signature&&eq(tx.from,want.from)&&tx.chainId===BigInt(want.chainId)&&tx.nonce===want.nonce&&tx.to===null&&tx.value===0n&&eq(tx.data,want.data),'signed transaction differs from reviewed deployment');
 const txHash=await rpc.send('eth_sendRawTransaction',[raw]);req(eq(txHash,tx.hash),'broadcast hash mismatch');
 return {name:next.name,transactionHash:txHash,expectedAddress:next.expectedAddress,status:'SUBMITTED_NOT_QUALIFIED'};
}
async function main(){
 const [cmd,...args]=process.argv.slice(2);
 if(cmd==='materialize'){const [root,out]=args;write(out,materialize(root));return;}
 const [bundleFile,planFile]=args;const b=json(bundleFile);
 if(cmd==='plan'){write(args[2],makePlan(b,json(planFile)));return;}
 const p=json(planFile),url=process.env.TREASURY_RPC_URL;req(url,'TREASURY_RPC_URL required');
 const rpc=new JsonRpcProvider(url,undefined,{cacheTimeout:0,batchMaxCount:1});
 try{
  let result;
  if(cmd==='next')result=await nextStep(rpc,b,p,json(args[2]));
  else if(cmd==='recover')result=await recoverDeployment(rpc,b,p,args[2],Number(args[3]),Number(args[4]));
  else if(cmd==='submit')result=await submitDeployment(rpc,b,p,json(args[2]),readFileSync(args[3],'utf8').trim());
  else throw Error('unknown command');
  console.log(JSON.stringify(result,null,2));
 }finally{rpc.destroy();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
