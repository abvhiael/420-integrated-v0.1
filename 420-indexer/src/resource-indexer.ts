import { readFile } from 'node:fs/promises';
import { Interface, AbiCoder, id, keccak256 } from 'ethers';
import { descriptorsFromArtifact420, type Artifact420 } from './abi-manifest.js';
import type { ChainSource420, Hex, IndexerLog, LogFilter420 } from './chain-source.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';

export const RESOURCE_EVENT_CONTRACTS_420 = [
 'ResourceProviderCollateral420','ResourceProviderRegistry420','ResourceSessionRegistry420',
 'StorageAgreementRegistry420','StorageCapacityRegistry420','StorageCommitmentRegistry420','StorageSettlementRegistry420'
] as const;
type EventContract = typeof RESOURCE_EVENT_CONTRACTS_420[number];
const GRAPH = [
 'CapabilityRegistry420','GovernanceTimelock','ResourceAuthorization420','ResourcePolicyRegistry420',
 'ResourceProviderRegistry420','ResourceProviderCollateral420','VaultRegistry420','VaultAccounting420',
 'AssetVault420','ResourceNodeRegistry420','ResourceOfferRegistry420','ResourceSessionRegistry420',
 'ResourceReceiptRegistry420','ResourceRouter420','StorageProofSchemeRegistry420','StorageCapacityRegistry420',
 'StorageCommitmentRegistry420','StorageProofRegistry420','StorageAgreementRegistry420',
 'StorageObjectManifestRegistry420','StorageSettlementRegistry420'
] as const;
type GraphContract = typeof GRAPH[number];
const REGISTRY = '0x0000000000000000000000000000000000000434' as Hex;
const SERVICE = id('420/service/resource-protocol/v1');
const ABI = new Interface([
 'function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)',
 'function resolveActive(bytes32) view returns (address,uint32)',
 'function getRegistrationProfile(bytes32,uint32) view returns (uint8,bytes32,bytes32,bytes32)',
 ...['nodes','providers','collateral','policy','offers','authorization','capabilityRegistry','governanceTimelock',
 'vault','registry','accounting','sessions','schemes','commitments','capacity','agreements','proofs','settlementController']
 .map(n=>'function '+n+'() view returns (address)'),
 'function collateralCodeHash() view returns (bytes32)'
]);
export interface ResourceIndexerPins420 {
 chainId: bigint; genesisHash: Hex; registryCodeHash: Hex;
 deploymentBlock: bigint; deploymentBlockHash: Hex;
 addresses: Readonly<Record<GraphContract,Hex>>;
 runtimeHashes: Readonly<Record<GraphContract,Hex>>;
}
function check(ok:unknown,message:string): asserts ok { if(!ok)throw Error('Resource: '+message); }
const eq=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const valid=(v:unknown,n:number)=>typeof v==='string'&&new RegExp('^0x[0-9a-fA-F]{'+n+'}$').test(v)&&BigInt(v)!==0n;
export async function resourceEventArtifacts420():Promise<ReadonlyMap<string,Artifact420>>{
 const raw=JSON.parse(await readFile(new URL('../descriptors/resource-8a2.json',import.meta.url),'utf8'));
 check(raw.schema==='420-resource-8a2-event-abi-v1'&&raw.qualified==='6837f137229ff0d9496d2d74d1cb0bea50680de5','ABI provenance');
 check(Object.keys(raw.contracts).length===RESOURCE_EVENT_CONTRACTS_420.length,'ABI contract count');
 const artifacts=new Map<string,Artifact420>();
 for(const n of RESOURCE_EVENT_CONTRACTS_420){const a=raw.contracts[n];check(a?.contractName===n&&Array.isArray(a.abi),'ABI missing '+n);artifacts.set(n,a);}
 return artifacts;
}
export async function verifyResourceIndexerDeployment420(source:ChainSource420,pins:ResourceIndexerPins420){
 check(pins.chainId>0n&&pins.deploymentBlock>=0n&&valid(pins.genesisHash,64)&&valid(pins.deploymentBlockHash,64)&&valid(pins.registryCodeHash,64),'invalid release pins');
 check(await source.chainId()===pins.chainId,'chain mismatch');
 const genesis=await source.getBlockByNumber(0n),anchor=await source.getBlockByNumber(pins.deploymentBlock);
 check(genesis?.number===0n&&eq(genesis.hash,pins.genesisHash)&&anchor?.number===pins.deploymentBlock&&eq(anchor.hash,pins.deploymentBlockHash),'genesis/deployment mismatch');
 const block=await source.blockNumber(),head=await source.getBlockByNumber(block);
 check(head?.number===block&&block>=pins.deploymentBlock,'verification head missing');
 const addresses=GRAPH.map(n=>pins.addresses[n]);
 check(addresses.every(a=>valid(a,40))&&new Set(addresses.map(a=>a.toLowerCase())).size===GRAPH.length,'invalid/aliased graph');
 check(eq(pins.addresses.GovernanceTimelock,'0x0000000000000000000000000000000000000429'),'noncanonical governance');
 async function code(a:Hex,expected:Hex,at:bigint){const raw=await source.getCode(a,at);check(/^0x(?:[0-9a-f]{2})+$/i.test(raw)&&valid(expected,64)&&eq(keccak256(raw),expected),'runtime mismatch '+a);}
 async function call(a:Hex,n:string,args:unknown[]=[],at=block){const raw=await source.call({to:a,data:ABI.encodeFunctionData(n,args) as Hex},at);return ABI.decodeFunctionResult(n,raw);}
 const hashes=GRAPH.map(n=>pins.runtimeHashes[n]);
 for(const at of [pins.deploymentBlock,block]){
 await code(REGISTRY,pins.registryCodeHash,at);
 await Promise.all(GRAPH.map(n=>code(pins.addresses[n],pins.runtimeHashes[n],at)));
 const [service,active,profile]=await Promise.all([call(REGISTRY,'getService',[SERVICE],at),call(REGISTRY,'resolveActive',[SERVICE],at),call(REGISTRY,'getRegistrationProfile',[SERVICE,1],at)]);
 const root=keccak256(AbiCoder.defaultAbiCoder().encode(
 [...GRAPH.map(()=> 'address'),...GRAPH.slice(2).map(()=> 'bytes32')],[...addresses,...hashes.slice(2)]));
 check(eq(service[0],pins.addresses.ResourceRouter420)&&eq(service[1],pins.runtimeHashes.ResourceRouter420)&&eq(service[2],id('420/RESOURCE/RELEASE/METADATA/V1'))&&service[3]===1n&&service[5]===true&&eq(active[0],service[0])&&active[1]===1n&&profile[0]===3n&&eq(profile[1],id('420/RESOURCE/AUDIT-8/DEPLOYMENT-PACKAGE/V1'))&&eq(profile[2],root)&&eq(profile[3],id('420/RESOURCE/RESOURCE_ROUTER/INTERFACE/V1')),'Registry release commitment mismatch');
 const edges:[GraphContract,string,GraphContract][]=[
 ['ResourceRouter420','nodes','ResourceNodeRegistry420'],['ResourceRouter420','policy','ResourcePolicyRegistry420'],['ResourceRouter420','offers','ResourceOfferRegistry420'],
 ['ResourceNodeRegistry420','providers','ResourceProviderRegistry420'],['ResourceProviderRegistry420','collateral','ResourceProviderCollateral420'],
 ['ResourceProviderCollateral420','providers','ResourceProviderRegistry420'],['ResourceProviderCollateral420','vault','AssetVault420'],
 ['ResourceProviderCollateral420','registry','VaultRegistry420'],['ResourceProviderCollateral420','accounting','VaultAccounting420'],
 ['ResourceSessionRegistry420','offers','ResourceOfferRegistry420'],['StorageCapacityRegistry420','providers','ResourceProviderRegistry420'],
 ['StorageCommitmentRegistry420','providers','ResourceProviderRegistry420'],['StorageAgreementRegistry420','providers','ResourceProviderRegistry420'],
 ['StorageAgreementRegistry420','commitments','StorageCommitmentRegistry420'],['StorageAgreementRegistry420','capacity','StorageCapacityRegistry420'],
 ['StorageAgreementRegistry420','settlementController','StorageSettlementRegistry420'],['StorageSettlementRegistry420','agreements','StorageAgreementRegistry420'],
 ['StorageSettlementRegistry420','proofs','StorageProofRegistry420']];
 for(const [a,getter,b] of edges)check(eq((await call(pins.addresses[a],getter,[],at))[0],pins.addresses[b]),'binding mismatch '+a+'.'+getter);
 check(eq((await call(pins.addresses.ResourceProviderRegistry420,'collateralCodeHash',[],at))[0],pins.runtimeHashes.ResourceProviderCollateral420),'collateral code binding mismatch');
 }
 check(eq((await source.getBlockByNumber(block))?.hash,head.hash)&&eq((await source.getBlockByNumber(pins.deploymentBlock))?.hash,pins.deploymentBlockHash),'verification reorganization');
 return pins.chainId;
}
const sameLog=(a:IndexerLog,b:IndexerLog)=>!b.removed&&a.blockNumber===b.blockNumber&&eq(a.blockHash,b.blockHash)&&eq(a.transactionHash,b.transactionHash)&&a.transactionIndex===b.transactionIndex&&a.logIndex===b.logIndex&&eq(a.address,b.address)&&eq(a.data,b.data)&&a.topics.length===b.topics.length&&a.topics.every((t,i)=>eq(t,b.topics[i]));
export async function createResourceIndexer420(source:ChainSource420,db:TransactionalSql420,pins:ResourceIndexerPins420,options:IngestionOptions420):Promise<IndexerIngestor420>{
 // Copy caller-owned objects so the verified deployment cannot change underneath ingestion.
 pins={...pins,addresses:{...pins.addresses},runtimeHashes:{...pins.runtimeHashes}};
 await verifyResourceIndexerDeployment420(source,pins);
 const artifacts=await resourceEventArtifacts420();
 const descriptors=RESOURCE_EVENT_CONTRACTS_420.flatMap(name=>descriptorsFromArtifact420('420Resource',{name,address:pins.addresses[name],artifact:name},artifacts.get(name)!));
 check(descriptors.length===44,'event coverage drift');
 const decoder=new ProtocolDecoderRegistry420(descriptors);
 const pairs=new Set(descriptors.map(d=>d.contractAddress.toLowerCase()+':'+d.topic0.toLowerCase()));
 const relevant=(l:IndexerLog)=>pairs.has(l.address.toLowerCase()+':'+(l.topics[0]?.toLowerCase()??''));
 const pinned=new Proxy(source,{get(target,property){
  if(property==='chainId')return ()=>verifyResourceIndexerDeployment420(target,pins);
  if(property==='getNativeLogs')return target.getNativeLogs?async(block:Parameters<NonNullable<ChainSource420['getNativeLogs']>>[0])=>(await target.getNativeLogs!(block)).filter(l=>!relevant(l)):undefined;
  if(property==='getLogs')return async(filter:LogFilter420)=>{
   check(filter.fromBlock===filter.toBlock&&typeof target.getBlockTransactionsByNumber==='function','complete bounded receipt enumeration required');
   const logs=await target.getLogs(filter),block=await target.getBlockByNumber(filter.fromBlock);
   check(block&&block.number===filter.fromBlock,'canonical block unavailable');
   const txs=await target.getBlockTransactionsByNumber(filter.fromBlock);
   const expected:IndexerLog[]=[];
   for(const tx of txs){
    const receipt=await target.getTransactionReceipt(tx.hash);
    check(receipt&&tx.blockNumber===block.number&&eq(tx.blockHash,block.hash)&&receipt.blockNumber===block.number&&eq(receipt.blockHash,block.hash)&&eq(receipt.transactionHash,tx.hash)&&receipt.transactionIndex===tx.transactionIndex&&(receipt.status===0||receipt.status===1),'transaction receipt provenance mismatch');
    for(const log of receipt.logs.filter(relevant)){
     check(receipt.status===1&&!log.removed&&log.blockNumber===block.number&&eq(log.blockHash,block.hash)&&eq(log.transactionHash,tx.hash)&&log.transactionIndex===tx.transactionIndex&&log.blockNumber>=pins.deploymentBlock,'invalid receipt event provenance');
     check(decoder.decode(log),'malformed receipt event');
     check(logs.some(actual=>sameLog(log,actual)),'RPC omitted canonical receipt event');expected.push(log);
    }
   }
   for(const log of logs.filter(relevant)){if(log.removed)continue;check(decoder.decode(log)&&expected.some(e=>sameLog(log,e)),'RPC fabricated canonical event');}
   check(eq((await target.getBlockByNumber(block.number))?.hash,block.hash),'block reorganized during receipt verification');
   return logs;
  };
  const v=Reflect.get(target,property,target);return typeof v==='function'?v.bind(target):v;
 }}) as ChainSource420;
 return new IndexerIngestor420(pinned,new SqlCheckpointStore420(db,pins.chainId),new CoreProjectionConsumer420(db,new ProtocolProjection420(db,decoder),pins.chainId),{...options,startBlock:options.startBlock??pins.deploymentBlock},new SqlCanonicalHistoryStore420(db,pins.chainId));
}
