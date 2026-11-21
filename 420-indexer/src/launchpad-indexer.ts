import { Interface, id, keccak256 } from 'ethers';
import type { ChainSource420, Hex, IndexerLog, LogFilter420 } from './chain-source.js';
import type { Artifact420, GenesisDescriptor420 } from './abi-manifest.js';
import { descriptorsFromArtifact420 } from './abi-manifest.js';
import { ProtocolDecoderRegistry420 } from './protocol-decoder.js';
import { ProtocolProjection420 } from './protocol-projections.js';
import { CoreProjectionConsumer420, type TransactionalSql420 } from './core-projections.js';
import { IndexerIngestor420, type IngestionOptions420 } from './ingestor.js';
import { SqlCanonicalHistoryStore420, SqlCheckpointStore420 } from './recovery-store.js';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const SERVICE_ID=id('420/service/launchpad/v1') as Hex;
const ABI=new Interface([
  'function resolveActive(bytes32) view returns (address,uint32)',
  'function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)',
  'function sales() view returns (address)',
  'function allocations() view returns (address)',
  'function projects() view returns (address)',
  'function crowdfundingIntegration() view returns (address)'
]);
export const LAUNCHPAD_INDEXER_CONTRACTS_420=[
  'LaunchpadProjectRegistry420','LaunchpadSaleRegistry420',
  'LaunchpadAllocationRegistry420','LaunchpadCrowdfundingIntegration420'
] as const;
export type LaunchpadIndexerContract420=typeof LAUNCHPAD_INDEXER_CONTRACTS_420[number];

const REQUIRED_EVENTS:Readonly<Record<LaunchpadIndexerContract420,readonly string[]>>={
  LaunchpadProjectRegistry420:['ProjectRegistered(bytes32,address,address,bytes32,bytes32)'],
  LaunchpadSaleRegistry420:['SaleCreated(bytes32,bytes32,address,uint128,uint128,uint64,uint64)','SaleStateChanged(bytes32,uint8)'],
  LaunchpadAllocationRegistry420:[
    'ContributionRecorded(bytes32,address,uint128,bytes32)',
    'AllocationClaimed(bytes32,address,uint128,bytes32)',
    'RefundRecorded(bytes32,address,uint128,bytes32)'],
  LaunchpadCrowdfundingIntegration420:[
    'ContributionSettlementBound(bytes32,address,bytes32,bytes32,uint128,bytes32)',
    'DeliveryEvidenceBound(bytes32,address,bytes32,uint128)',
    'DisputeLinked(bytes32,address,bytes32)',
    'DisputeOutcomePublished(bytes32,address,bytes32,uint32,bytes32,bytes32)',
    'ReputationEvidencePublished(bytes32,bytes32,bytes32,address,bytes32,bytes32)',
    'NotificationPublished(bytes32,bytes32,address,bytes32,bytes32)']
};
export interface LaunchpadVerifiedDeployment420 {
  chainId:bigint;genesisHash:Hex;registryAddress:Hex;
  launchpadRouterAddress:Hex;
  addresses:Readonly<Record<LaunchpadIndexerContract420,Hex>>;
  runtimeHashes:Readonly<Record<LaunchpadIndexerContract420,Hex>>;
  routerCodeHash:Hex;
}
const nonzero=(v:string)=>ADDRESS.test(v)&&!/^0x0{40}$/i.test(v);
async function read(source:ChainSource420,to:Hex,signature:string,args:unknown[]=[]):Promise<readonly unknown[]>{
  const data=ABI.encodeFunctionData(signature,args) as Hex;
  const raw=await source.call({to,data});
  if(typeof raw!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(raw))
    throw Error('malformed Registry or Launchpad chain call');
  return ABI.decodeFunctionResult(signature,raw);
}
async function addressGetter(source:ChainSource420,to:Hex,name:string):Promise<Hex>{
  const [value]=await read(source,to,name);
  const address=String(value).toLowerCase() as Hex;
  if(!nonzero(address))throw Error('unresolved Launchpad Registry dependency: '+name);
  return address;
}
function assertChainHash(value:string,name:string):Hex{
  if(!HASH.test(value)||/^0x0{64}$/i.test(value))throw Error('invalid '+name);
  return value.toLowerCase() as Hex;
}

/**
 * Resolve the complete current Launchpad graph from ProtocolRegistry, not an
 * invented Genesis predeploy. All four event emitters and router must exist
 * and be runtime-code verified. Discovery grants no wallet or settlement authority.
 */
export async function verifyLaunchpadIndexerDeployment420(
  source:ChainSource420,chainId:bigint,genesisHash:Hex,registryAddress:Hex
):Promise<LaunchpadVerifiedDeployment420>{
  if(chainId<=0n||await source.chainId()!==chainId)throw Error('Launchpad indexer chain mismatch');
  const genesis=await source.getBlockByNumber(0n);
  if(!genesis||genesis.number!==0n||genesis.hash.toLowerCase()!==assertChainHash(genesisHash,'Launchpad genesis hash'))
    throw Error('Launchpad indexer genesis mismatch');
  if(!nonzero(registryAddress))throw Error('invalid Launchpad ProtocolRegistry address');
  const [[router,version],[publishedRouter,publishedHash, ,publishedVersion, ,active]]=await Promise.all([
    read(source,registryAddress,'resolveActive',[SERVICE_ID]),
    read(source,registryAddress,'getService',[SERVICE_ID])
  ]);
  const routerAddress=String(router).toLowerCase() as Hex;
  const advertisedHash=assertChainHash(String(publishedHash),'published Launchpad router codehash');
  if(!nonzero(routerAddress)||routerAddress!==String(publishedRouter).toLowerCase()||
    Number(version)<1||Number(version)!==Number(publishedVersion)||active!==true)
    throw Error('inactive or substituted Launchpad Registry service');
  const sales=await addressGetter(source,routerAddress,'sales');
  const allocations=await addressGetter(source,routerAddress,'allocations');
  const [projects,allocationSales,crowdfunding]=await Promise.all([
    addressGetter(source,sales,'projects'),addressGetter(source,allocations,'sales'),
    addressGetter(source,allocations,'crowdfundingIntegration')]);
  const [crowdSales,crowdAllocations,crowdProjects]=await Promise.all([
    addressGetter(source,crowdfunding,'sales'),addressGetter(source,crowdfunding,'allocations'),
    addressGetter(source,crowdfunding,'projects')]);
  if(new Set([routerAddress,sales,allocations,projects,crowdfunding]).size!==5||
    allocationSales!==sales||crowdSales!==sales||crowdAllocations!==allocations||crowdProjects!==projects)
    throw Error('Launchpad Registry dependency graph mismatch');
  const addresses:Record<LaunchpadIndexerContract420,Hex>={
    LaunchpadProjectRegistry420:projects,LaunchpadSaleRegistry420:sales,
    LaunchpadAllocationRegistry420:allocations,LaunchpadCrowdfundingIntegration420:crowdfunding
  };
  const runtimeHashes={} as Record<LaunchpadIndexerContract420,Hex>;
  let routerCodeHash:Hex='0x' as Hex;
  for(const [name,addr] of [['router',routerAddress],...Object.entries(addresses)] as [string,Hex][]){
    const code=await source.getCode(addr);
    if(!/^0x(?:[0-9a-fA-F]{2})+$/.test(code))throw Error('missing Launchpad runtime bytecode: '+name);
    const hash=keccak256(code).toLowerCase() as Hex;
    if(name==='router'){routerCodeHash=hash;if(hash!==advertisedHash)throw Error('Launchpad router codehash differs from Registry');}
    else runtimeHashes[name as LaunchpadIndexerContract420]=hash;
  }
  return {chainId,genesisHash,registryAddress,launchpadRouterAddress:routerAddress,
    addresses,runtimeHashes,routerCodeHash};
}
export function launchpadIndexerDescriptors420(
  deployment:LaunchpadVerifiedDeployment420,
  artifacts:ReadonlyMap<string,Artifact420>
):GenesisDescriptor420[]{
  const descriptors:GenesisDescriptor420[]=[];
  for(const name of LAUNCHPAD_INDEXER_CONTRACTS_420){
    const artifact=artifacts.get(name);
    if(!artifact||artifact.contractName!==name)throw Error('required Launchpad event artifact missing: '+name);
    const address=deployment.addresses[name];
    if(!nonzero(address)||!HASH.test(deployment.runtimeHashes[name]))
      throw Error('unverified Launchpad descriptor deployment: '+name);
    const found=descriptorsFromArtifact420('420Launchpad',{name,address,artifact:name},artifact);
    const signatures=new Set(found.map(d=>d.signature));
    for(const signature of REQUIRED_EVENTS[name])
      if(!signatures.has(signature))throw Error('Launchpad artifact event drift: '+signature);
    descriptors.push(...found);
  }
  return descriptors;
}

/** Create the shared 420Indexer durable protocol read model, including
 * restart/reorg rollback and strict receipt inclusion. External Notifications,
 * Reputation and Explorer remain non-authoritative consumers of its events.
 */
export async function createLaunchpadIndexer420(
  source:ChainSource420,db:TransactionalSql420,chainId:bigint,genesisHash:Hex,
  registryAddress:Hex,artifacts:ReadonlyMap<string,Artifact420>,options:IngestionOptions420
):Promise<IndexerIngestor420>{
  const verified=await verifyLaunchpadIndexerDeployment420(source,chainId,genesisHash,registryAddress);
  const descriptors=launchpadIndexerDescriptors420(verified,artifacts);
  const decoders=new ProtocolDecoderRegistry420(descriptors);
  const known=new Set(descriptors.map(d=>d.topic0.toLowerCase()));
  const equals=(a:IndexerLog,b:IndexerLog)=>!b.removed&&a.blockNumber===b.blockNumber&&
    a.blockHash.toLowerCase()===b.blockHash.toLowerCase()&&a.transactionHash.toLowerCase()===b.transactionHash.toLowerCase()&&
    a.transactionIndex===b.transactionIndex&&a.logIndex===b.logIndex&&a.address.toLowerCase()===b.address.toLowerCase()&&
    a.data.toLowerCase()===b.data.toLowerCase()&&JSON.stringify(a.topics.map(x=>x.toLowerCase()))===JSON.stringify(b.topics.map(x=>x.toLowerCase()));
  const pinned=new Proxy(source,{get(target,property){
    if(property==='chainId')return async()=>{
      const current=await verifyLaunchpadIndexerDeployment420(target,chainId,genesisHash,registryAddress);
      for(const name of LAUNCHPAD_INDEXER_CONTRACTS_420)
        if(current.addresses[name]!==verified.addresses[name]||
          current.runtimeHashes[name]!==verified.runtimeHashes[name])throw Error('Launchpad descriptor Registry rotation');
      if(current.routerCodeHash!==verified.routerCodeHash)throw Error('Launchpad router Registry rotation');
      return chainId;
    };
    if(property==='getLogs')return async (filter:LogFilter420)=>{
      const logs=await target.getLogs(filter);
      for(const log of logs){
        if(log.removed||!known.has(log.topics[0]?.toLowerCase()??''))continue;
        decoders.decode(log);
        const [tx,receipt]=await Promise.all([
          target.getTransactionByHash(log.transactionHash),target.getTransactionReceipt(log.transactionHash)]);
        if(!tx||!receipt||receipt.status!==1||
          tx.hash.toLowerCase()!==log.transactionHash.toLowerCase()||
          receipt.transactionHash.toLowerCase()!==log.transactionHash.toLowerCase()||
          tx.blockNumber!==log.blockNumber||receipt.blockNumber!==log.blockNumber||
          tx.blockHash.toLowerCase()!==log.blockHash.toLowerCase()||
          receipt.blockHash.toLowerCase()!==log.blockHash.toLowerCase()||
          tx.transactionIndex!==log.transactionIndex||receipt.transactionIndex!==log.transactionIndex||
          !receipt.logs.some(candidate=>equals(log,candidate)))
          throw Error('Launchpad event transaction or receipt provenance mismatch');
      }
      return logs;
    };
    const value=Reflect.get(target,property,target);
    return typeof value==='function'?value.bind(target):value;
  }});
  return new IndexerIngestor420(pinned,new SqlCheckpointStore420(db,chainId),
    new CoreProjectionConsumer420(db,new ProtocolProjection420(db,decoders),chainId),
    options,new SqlCanonicalHistoryStore420(db,chainId));
}
