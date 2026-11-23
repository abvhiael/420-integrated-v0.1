import {AbiCoder, Interface, id, keccak256} from 'ethers';
import type {ChainSource420,Hex,IndexerLog,LogFilter420} from './chain-source.js';
import type {Artifact420,GenesisDescriptor420} from './abi-manifest.js';
import {descriptorsFromArtifact420} from './abi-manifest.js';
import {ProtocolDecoderRegistry420} from './protocol-decoder.js';
import {ProtocolProjection420} from './protocol-projections.js';
import {CoreProjectionConsumer420,type TransactionalSql420} from './core-projections.js';
import {IndexerIngestor420,type IngestionOptions420} from './ingestor.js';
import {SqlCanonicalHistoryStore420,SqlCheckpointStore420} from './recovery-store.js';

export const ARBITRATION_INDEXER_CONTRACTS_420=[
 'ArbitrationCaseRegistry420','ArbitrationRulingRegistry420'
] as const;
export type ArbitrationIndexerContract420=typeof ARBITRATION_INDEXER_CONTRACTS_420[number];
export const ARBITRATION_INDEXER_EVENT_SIGNATURES_420:Readonly<Record<ArbitrationIndexerContract420,readonly string[]>>=Object.freeze({
 ArbitrationCaseRegistry420:[
  'CaseOpened(bytes32,bytes32,address,address,bytes32,bytes32)',
  'EvidenceCommitted(bytes32,uint8,address,bytes32)',
  'CaseRuled(bytes32,uint8,uint64)',
  'CaseAppealed(bytes32,uint8,address,uint64)',
  'CaseFinalized(bytes32,uint8)'
 ],
 ArbitrationRulingRegistry420:[
  'RulingSubmitted(bytes32,uint8,address,uint32,bytes32,bytes32,bytes32)',
  'RulingFinalized(bytes32,uint8,bytes32,bytes32)'
 ]
});
export interface ArbitrationIndexerManifest420{
 schema:'420-arbitration-artifact-descriptor-v1';
 descriptorVersion:1;protocol:'420Arbitration';protocolVersion:1;
 authority:'artifact_abi_and_verified_registry_release_only_no_live_address_claim';
 contracts:Array<{contractName:ArbitrationIndexerContract420;sourcePath:string;
  events:Array<{name:string;signature:string;inputs:Array<{name:string;type:string;indexed:boolean}>}>}>;
}
export interface ArbitrationIndexerPins420{
 chainId:bigint;genesisHash:Hex;registryAddress:Hex;registryCodeHash:Hex;
 version:number;metadataHash:Hex;manifestHash:Hex;interfaceHash:Hex;
}
export interface ArbitrationIndexerDeployment420{
 chainId:bigint;genesisHash:Hex;registryAddress:Hex;version:number;verificationBlock:bigint;
 verificationBlockHash:Hex;router:Hex;routerCodeHash:Hex;dependencyRoot:Hex;
 addresses:Readonly<Record<ArbitrationIndexerContract420,Hex>>;
 runtimeHashes:Readonly<Record<ArbitrationIndexerContract420,Hex>>;
}
const SERVICE_ID=id('420/service/arbitration/v1') as Hex;
const CANONICAL_REGISTRY='0x0000000000000000000000000000000000000434';
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const REGISTRY=new Interface([
 'function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)',
 'function resolveActive(bytes32) view returns (address,uint32)',
 'function getRegistrationProfile(bytes32,uint32) view returns (uint8,bytes32,bytes32,bytes32)'
]);
const TARGET=new Interface([
 'function policies() view returns (address)','function cases() view returns (address)',
 'function rulings() view returns (address)','function rulingRegistry() view returns (address)',
 'function governanceTimelock() view returns (address)','function protocolVersion() view returns (uint32)'
]);
function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const address=(v:unknown,label:string):Hex=>{
 check(typeof v==='string'&&ADDRESS.test(v)&&BigInt(v)!==0n,'invalid Arbitration '+label);
 return v.toLowerCase() as Hex;
};
const hash=(v:unknown,label:string):Hex=>{
 check(typeof v==='string'&&HASH.test(v)&&BigInt(v)!==0n,'invalid Arbitration '+label);
 return v.toLowerCase() as Hex;
};
async function call(source:ChainSource420,to:Hex,abi:Interface,name:string,args:unknown[],block:bigint):Promise<readonly unknown[]>{
 const raw=await source.call({to,data:abi.encodeFunctionData(name,args) as Hex},block);
 check(typeof raw==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(raw),'Arbitration RPC response malformed: '+name);
 try{return abi.decodeFunctionResult(name,raw);}catch{throw Error('Arbitration ABI response invalid: '+name);}
}
async function getter(source:ChainSource420,to:Hex,name:string,block:bigint):Promise<Hex>{
 const values=await call(source,to,TARGET,name,[],block);
 return address(String(values[0]),name);
}
async function codehash(source:ChainSource420,addr:Hex,block:bigint):Promise<Hex>{
 const code=await source.getCode(addr,block);
 check(/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&code!=='0x','missing Arbitration deployed code');
 return keccak256(code).toLowerCase() as Hex;
}
export function arbitrationDescriptorsFromManifest420(
 manifest:ArbitrationIndexerManifest420,artifacts:ReadonlyMap<string,Artifact420>,
 deployment:ArbitrationIndexerDeployment420
):GenesisDescriptor420[]{
 check(manifest.schema==='420-arbitration-artifact-descriptor-v1'&&manifest.descriptorVersion===1&&
  manifest.protocol==='420Arbitration'&&manifest.protocolVersion===1&&
  manifest.authority==='artifact_abi_and_verified_registry_release_only_no_live_address_claim',
  'Arbitration descriptor manifest version/authority mismatch');
 check(manifest.contracts.length===2,'Arbitration descriptor contract set invalid');
 const out:GenesisDescriptor420[]=[];
 const visited=new Set<string>();
 for(const entry of manifest.contracts){
  check((ARBITRATION_INDEXER_CONTRACTS_420 as readonly string[]).includes(entry.contractName)&&
   !visited.has(entry.contractName)&&
   entry.sourcePath==='contracts/src/arbitration/'+entry.contractName+'.sol',
   'Arbitration descriptor contract identity invalid');
  visited.add(entry.contractName);
  const artifact=artifacts.get(entry.contractName);
  check(artifact?.contractName===entry.contractName,'Arbitration retained ABI artifact missing');
  const address=deployment.addresses[entry.contractName];
  hash(deployment.runtimeHashes[entry.contractName],'verified runtime codehash');
  const all=descriptorsFromArtifact420('420Arbitration',
   {name:entry.contractName,address,artifact:entry.sourcePath},artifact);
  const expected=ARBITRATION_INDEXER_EVENT_SIGNATURES_420[entry.contractName];
  check(entry.events.length===expected.length,'Arbitration descriptor event count drift');
  const matched=new Set<string>();
  for(const event of entry.events){
   check(expected.includes(event.signature)&&!matched.has(event.signature)&&
    event.name===event.signature.slice(0,event.signature.indexOf('('))&&
    event.signature===event.name+'('+event.inputs.map(f=>f.type).join(',')+')',
    'Arbitration descriptor event drift: '+event.name);
   const original=artifact.abi.find(e=>(e as any).type==='event'&&(e as any).name===event.name) as any;
   check(original&&original.anonymous!==true&&JSON.stringify(original.inputs.map((f:any)=>({
    name:f.name,type:f.type,indexed:Boolean(f.indexed)
   })))===JSON.stringify(event.inputs),'Arbitration ABI event fields drift: '+event.name);
   const found=all.find(d=>d.signature===event.signature);
   check(found&&found.eventName===event.name&&found.topic0.toLowerCase()===id(event.signature).toLowerCase(),
    'Arbitration ABI event signature drift: '+event.name);
   matched.add(event.signature);out.push(found);
  }
  check(matched.size===expected.length,'Arbitration required event missing');
 }
 check(visited.size===2&&out.length===7,'Arbitration event coverage incomplete');
 return out.sort((a,b)=>a.contractAddress.localeCompare(b.contractAddress)||a.signature.localeCompare(b.signature));
}
/** Independently verify a trusted chain-specific release against real RPC
 * identities. The caller supplies frozen approved hashes, never an address
 * from an untrusted dApp, Indexer row, or unverified configuration.
 */
export async function verifyArbitrationIndexerDeployment420(
 source:ChainSource420,pins:ArbitrationIndexerPins420
):Promise<ArbitrationIndexerDeployment420>{
 check(pins.chainId>0n&&Number.isSafeInteger(pins.version)&&pins.version>0,
  'Arbitration release chain/version invalid');
 check(await source.chainId()===pins.chainId,'Arbitration release chain mismatch');
 check(address(pins.registryAddress,'registry')===CANONICAL_REGISTRY,
  'Arbitration noncanonical ProtocolRegistry');
 const genesis=await source.getBlockByNumber(0n);
 check(genesis&&genesis.number===0n&&genesis.hash.toLowerCase()===hash(pins.genesisHash,'genesis'),
  'Arbitration genesis mismatch');
 const headNumber=await source.blockNumber(),head=await source.getBlockByNumber(headNumber);
 check(head&&head.number===headNumber,'Arbitration verification block missing');
 check(await codehash(source,pins.registryAddress,headNumber)===hash(pins.registryCodeHash,'registry runtime'),
  'Arbitration Registry codehash mismatch');
 const [service,active,profile]=await Promise.all([
  call(source,pins.registryAddress,REGISTRY,'getService',[SERVICE_ID],headNumber),
  call(source,pins.registryAddress,REGISTRY,'resolveActive',[SERVICE_ID],headNumber),
  call(source,pins.registryAddress,REGISTRY,'getRegistrationProfile',[SERVICE_ID,pins.version],headNumber)
 ]);
 const router=address(String(service[0]),'router'),routerHash=hash(String(service[1]),'router hash');
 check(router===address(String(active[0]),'active router')&&
  Number(service[3])===pins.version&&Number(active[1])===pins.version&&service[5]===true&&
  hash(String(service[2]),'metadata')===hash(pins.metadataHash,'approved metadata')&&
  Number(profile[0])===3&&hash(String(profile[1]),'manifest')===hash(pins.manifestHash,'approved manifest')&&
  hash(String(profile[3]),'interface')===hash(pins.interfaceHash,'approved interface'),
  'Arbitration Registry release identity/activation mismatch');
 check(await codehash(source,router,headNumber)===routerHash,
  'Arbitration router runtime codehash mismatch');
 const policies=await getter(source,router,'policies',headNumber);
 const cases=await getter(source,router,'cases',headNumber);
 const rulings=await getter(source,router,'rulings',headNumber);
 check(new Set([router,policies,cases,rulings]).size===4,'Arbitration dependency addresses aliased');
 const caseHash=await codehash(source,cases,headNumber);
 const rulingHash=await codehash(source,rulings,headNumber);
 const policyHash=await codehash(source,policies,headNumber);
 const root=keccak256(AbiCoder.defaultAbiCoder().encode(
  ['address','address','address','address','bytes32','bytes32','bytes32','bytes32'],
  [policies,cases,rulings,router,policyHash,caseHash,rulingHash,routerHash]
 )).toLowerCase() as Hex;
 check(root===hash(String(profile[2]),'Registry dependency root'),
  'Arbitration Registry dependency root mismatch');
 for(const [owner,name,target] of [
  [cases,'policies',policies],[cases,'rulingRegistry',rulings],[rulings,'cases',cases]
 ] as const)check(await getter(source,owner,name,headNumber)===target,
  'Arbitration case/ruling immutable binding mismatch');
 for(const addr of [router,policies,cases,rulings]){
  const version=await call(source,addr,TARGET,'protocolVersion',[],headNumber);
  check(Number(version[0])===1,'Arbitration deployed contract protocol version drift');
 }
 const canonical=await source.getBlockByNumber(headNumber);
 check(canonical?.hash.toLowerCase()===head.hash.toLowerCase(),
  'Arbitration verification head reorganized');
 return Object.freeze({
  chainId:pins.chainId,genesisHash:hash(pins.genesisHash,'genesis'),
  registryAddress:pins.registryAddress,version:pins.version,
  verificationBlock:headNumber,verificationBlockHash:head.hash,
  router,routerCodeHash:routerHash,dependencyRoot:root,
  addresses:Object.freeze({ArbitrationCaseRegistry420:cases,ArbitrationRulingRegistry420:rulings}),
  runtimeHashes:Object.freeze({ArbitrationCaseRegistry420:caseHash,ArbitrationRulingRegistry420:rulingHash})
 });
}
/** Use the shared SQL ingestion/ancestry and atomic per-block checkpoints.
 * For event emitters, independently prove the transaction/receipt and the
 * exact canonical log to reject mismatched or dishonest RPC sources.
 */
export async function createArbitrationIndexer420(
 source:ChainSource420,db:TransactionalSql420,pins:ArbitrationIndexerPins420,
 manifest:ArbitrationIndexerManifest420,artifacts:ReadonlyMap<string,Artifact420>,
 options:IngestionOptions420
):Promise<IndexerIngestor420>{
 const verified=await verifyArbitrationIndexerDeployment420(source,pins);
 const descriptors=arbitrationDescriptorsFromManifest420(manifest,artifacts,verified);
 const decoder=new ProtocolDecoderRegistry420(descriptors);
 const topics=new Set(descriptors.map(d=>d.topic0.toLowerCase()));
 const canonicalLog=(a:IndexerLog,b:IndexerLog)=>!b.removed&&
  a.address.toLowerCase()===b.address.toLowerCase()&&
  a.blockNumber===b.blockNumber&&a.blockHash.toLowerCase()===b.blockHash.toLowerCase()&&
  a.transactionHash.toLowerCase()===b.transactionHash.toLowerCase()&&
  a.transactionIndex===b.transactionIndex&&a.logIndex===b.logIndex&&
  a.data.toLowerCase()===b.data.toLowerCase()&&
  JSON.stringify(a.topics.map(x=>x.toLowerCase()))===JSON.stringify(b.topics.map(x=>x.toLowerCase()));
 const pinned=new Proxy(source,{get(target,property){
  if(property==='chainId')return async()=>{
   const current=await verifyArbitrationIndexerDeployment420(target,pins);
   for(const name of ARBITRATION_INDEXER_CONTRACTS_420){
    check(current.addresses[name]===verified.addresses[name]&&
     current.runtimeHashes[name]===verified.runtimeHashes[name],
     'Arbitration deployment rotated; new descriptor qualification required');
   }
   check(current.router===verified.router&&current.dependencyRoot===verified.dependencyRoot,
    'Arbitration registered release rotated');
   return pins.chainId;
  };
  if(property==='getLogs')return async(filter:LogFilter420)=>{
   // A provider can omit logs from eth_getLogs while returning otherwise
   // authentic headers. Independently enumerate transaction receipts from each
   // canonical block; require *every* Arbitration log in the receipt to appear
   // identically in the RPC log response. This is required, not optional.
   check(typeof target.getBlockTransactionsByNumber==='function',
    'Arbitration requires full canonical transaction enumeration');
   check(filter.toBlock===filter.fromBlock,
    'Arbitration ingestion requires bounded one-block receipt reconciliation');
   const logs=await target.getLogs(filter);
   const transactions=await target.getBlockTransactionsByNumber(filter.fromBlock);
   for(const tx of transactions){
    const receipt=await target.getTransactionReceipt(tx.hash);
    check(receipt&&receipt.status===1||receipt&&receipt.status===0,
     'Arbitration canonical transaction receipt unavailable');
    if(!receipt||receipt.status!==1)continue;
    const block=await target.getBlockByNumber(tx.blockNumber);
    check(block&&block.hash.toLowerCase()===receipt.blockHash.toLowerCase()&&
     receipt.transactionHash.toLowerCase()===tx.hash.toLowerCase(),
     'Arbitration transaction receipt disagrees with canonical block');
    for(const expected of receipt.logs){
     if(!topics.has(expected.topics[0]?.toLowerCase()??''))continue;
     check(decoder.decode(expected),'unrecognized canonical Arbitration receipt event');
     check(logs.some(actual=>canonicalLog(expected,actual)),
      'Arbitration RPC omitted canonical receipt event');
    }
   }
   for(const log of logs){
    if(log.removed||!topics.has(log.topics[0]?.toLowerCase()??''))continue;
    check(decoder.decode(log),'unqualified Arbitration log emitter');
    const [tx,receipt,block]=await Promise.all([
     target.getTransactionByHash(log.transactionHash),
     target.getTransactionReceipt(log.transactionHash),
     target.getBlockByNumber(log.blockNumber)
    ]);
    check(tx&&receipt&&receipt.status===1&&block&&
     block.hash.toLowerCase()===log.blockHash.toLowerCase()&&
     tx.hash.toLowerCase()===log.transactionHash.toLowerCase()&&
     receipt.transactionHash.toLowerCase()===log.transactionHash.toLowerCase()&&
     tx.blockNumber===log.blockNumber&&receipt.blockNumber===log.blockNumber&&
     tx.blockHash.toLowerCase()===log.blockHash.toLowerCase()&&
     receipt.blockHash.toLowerCase()===log.blockHash.toLowerCase()&&
     tx.transactionIndex===log.transactionIndex&&receipt.transactionIndex===log.transactionIndex&&
     receipt.logs.some(candidate=>canonicalLog(log,candidate)),
     'Arbitration RPC transaction/receipt canonicality disagreement');
   }
   return logs;
  };
  const value=Reflect.get(target,property,target);
  return typeof value==='function'?value.bind(target):value;
 }}) as ChainSource420;
 return new IndexerIngestor420(pinned,new SqlCheckpointStore420(db,pins.chainId),
  new CoreProjectionConsumer420(db,new ProtocolProjection420(db,decoder),pins.chainId),
  options,new SqlCanonicalHistoryStore420(db,pins.chainId));
}
