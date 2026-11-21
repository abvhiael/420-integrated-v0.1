import test from 'node:test';
import assert from 'node:assert/strict';
import { EventFragment, Interface, id, keccak256 } from 'ethers';
import type { Hex, ChainSource420, IndexerLog } from '../src/chain-source.js';
import type { Artifact420 } from '../src/abi-manifest.js';
import { verifyLaunchpadIndexerDeployment420, launchpadIndexerDescriptors420 } from '../src/launchpad-indexer.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';

const a=(n:number):Hex => ('0x'+n.toString(16).padStart(40,'0')) as Hex;
const h=(n:number):Hex => ('0x'+n.toString(16).padStart(64,'0')) as Hex;
const R=a(0x434),ROUTER=a(0x1001),SALES=a(0x1002),ALLOC=a(0x1003),PROJECTS=a(0x1004),CROWD=a(0x1005);
const genesis=h(12),code='0x6001' as Hex,codeHash=keccak256(code);
const registryAbi=new Interface([
  'function resolveActive(bytes32) view returns (address,uint32)',
  'function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)',
  'function sales() view returns (address)',
  'function allocations() view returns (address)',
  'function projects() view returns (address)',
  'function crowdfundingIntegration() view returns (address)'
]);
const eventSignatures:Record<string,string[]>={
  LaunchpadProjectRegistry420:['event ProjectRegistered(bytes32 indexed projectId,address indexed controller,address indexed saleAsset,bytes32 metadataHash,bytes32 issuanceCommitment)'],
  LaunchpadSaleRegistry420:[
    'event SaleCreated(bytes32 indexed saleId,bytes32 indexed projectId,address paymentAsset,uint128 softCap,uint128 hardCap,uint64 startsAt,uint64 endsAt)',
    'event SaleStateChanged(bytes32 indexed saleId,uint8 state)'],
  LaunchpadAllocationRegistry420:[
    'event ContributionRecorded(bytes32 indexed saleId,address indexed participant,uint128 amount,bytes32 paymentCommitment)',
    'event AllocationClaimed(bytes32 indexed saleId,address indexed participant,uint128 tokenAmount,bytes32 deliveryCommitment)',
    'event RefundRecorded(bytes32 indexed saleId,address indexed participant,uint128 amount,bytes32 refundCommitment)'],
  LaunchpadCrowdfundingIntegration420:[
    'event ContributionSettlementBound(bytes32 indexed saleId,address indexed participant,bytes32 indexed paymentId,bytes32 profileId,uint128 amount,bytes32 receiptHash)',
    'event DeliveryEvidenceBound(bytes32 indexed saleId,address indexed participant,bytes32 indexed deliveryCommitment,uint128 tokenAmount)',
    'event DisputeLinked(bytes32 indexed saleId,address indexed participant,bytes32 indexed caseId)',
    'event DisputeOutcomePublished(bytes32 indexed saleId,address indexed participant,bytes32 indexed caseId,uint32 outcomeCode,bytes32 rulingHash,bytes32 remedyCommitment)',
    'event ReputationEvidencePublished(bytes32 indexed evidenceRef,bytes32 indexed saleId,bytes32 indexed projectId,address participant,bytes32 participantProfileId,bytes32 interactionKind)',
    'event NotificationPublished(bytes32 indexed eventId,bytes32 indexed saleId,address indexed participant,bytes32 eventType,bytes32 sourceRef)']
};
function artifacts():ReadonlyMap<string,Artifact420>{
  return new Map(Object.entries(eventSignatures).map(([contractName,signatures])=>{
    const abi=new Interface(signatures).fragments
      .filter((fragment):fragment is EventFragment=>fragment.type==='event')
      .map(event=>({type:'event' as const,name:event.name,inputs:event.inputs.map(x=>({name:x.name,type:x.type,indexed:x.indexed}))}));
    return [contractName,{contractName,abi}];
  }));
}
function fakeSource():ChainSource420{
  const s={
    sourceId:'launchpad-local-evm',
    chainId:async()=>420n,
    getBlockByNumber:async(n:bigint)=>n===0n?{number:0n,hash:genesis,parentHash:h(0),timestamp:0n}:null,
    getCode:async(_address:Hex)=>code,
    call:async(request:{to:Hex;data:Hex}):Promise<Hex>=>{
      const method=registryAbi.parseTransaction({data:request.data});
      if(!method)throw Error('unknown Registry getter');
      const {name}=method;
      let result:unknown[];
      if(request.to.toLowerCase()===R){
        if(name==='resolveActive')result=[ROUTER,1];
        else if(name==='getService')result=[ROUTER,codeHash,h(2),1,42,true];
        else throw Error('unknown Registry call');
      }else{
        const getters:Record<string,Record<string,Hex>>={
          [ROUTER]:{sales:SALES,allocations:ALLOC},
          [SALES]:{projects:PROJECTS},
          [ALLOC]:{sales:SALES,crowdfundingIntegration:CROWD},
          [CROWD]:{sales:SALES,allocations:ALLOC,projects:PROJECTS}
        };
        const answer=getters[request.to.toLowerCase()]?.[name];
        if(!answer)throw Error('unknown component getter');
        result=[answer];
      }
      return registryAbi.encodeFunctionResult(name,result) as Hex;
    }
  };
  return s as unknown as ChainSource420;
}
const makeLog=(name:string,values:unknown[]):IndexerLog=>{
  const abi=new Interface(eventSignatures.LaunchpadCrowdfundingIntegration420);
  const event=abi.getEvent(name);
  if(!event)throw Error('unknown event');
  const encoded=abi.encodeEventLog(event,values);
  return {address:CROWD,blockHash:h(31),blockNumber:4n,transactionHash:h(41),
    transactionIndex:0,logIndex:1,topics:encoded.topics as Hex[],data:encoded.data as Hex};
};
class RecordingDb implements TransactionalSql420{
  queries:Array<{sql:string;params?:readonly unknown[]}>= [];
  async query(sql:string,params?:readonly unknown[]):Promise<unknown>{this.queries.push({sql,params});return undefined;}
  async transaction<T>(run:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{return run(this);}
}
test('real Registry ABI resolution pins the Launchpad graph, code hashes and all emitted event contracts',async()=>{
  const source=fakeSource();
  const verified=await verifyLaunchpadIndexerDeployment420(source,420n,genesis,R);
  assert.equal(verified.addresses.LaunchpadSaleRegistry420,SALES);
  assert.equal(verified.addresses.LaunchpadCrowdfundingIntegration420,CROWD);
  assert.equal(verified.routerCodeHash,codeHash);
  const d=launchpadIndexerDescriptors420(verified,artifacts());
  assert.equal(d.every(x=>x.contractAddress&&x.protocol==='420Launchpad'),true);
  assert.equal(new Set(d.map(x=>x.contractName)).size,4);
  for(const name of ['NotificationPublished','ReputationEvidencePublished','ContributionRecorded','SaleCreated','DisputeOutcomePublished'])
    assert.ok(d.some(x=>x.eventName===name),name);
  assert.throws(()=>launchpadIndexerDescriptors420(verified,new Map()),/artifact missing/);
  const changed=artifacts(),bad=changed.get('LaunchpadCrowdfundingIntegration420')!;
  const remove=bad.abi.filter(x=>(x as {name?:string}).name!=='NotificationPublished');
  const withDrift=new Map(changed);withDrift.set('LaunchpadCrowdfundingIntegration420',{contractName:bad.contractName,abi:remove});
  assert.throws(()=>launchpadIndexerDescriptors420(verified,withDrift),/artifact event drift/);
});
test('Launchpad ABI decoder and shared 420Indexer protocol projection produce canonical Notifications and Reputation evidence',async()=>{
  const deployment=await verifyLaunchpadIndexerDeployment420(fakeSource(),420n,genesis,R);
  const decoders=new ProtocolDecoderRegistry420(launchpadIndexerDescriptors420(deployment,artifacts()));
  const sale=h(91),profile=h(92),participant=a(777);
  const notification=makeLog('NotificationPublished',[h(90),sale,participant,h(3),h(4)]);
  const reputation=makeLog('ReputationEvidencePublished',[h(4),sale,h(5),participant,profile,h(6)]);
  reputation.logIndex=2;
  const decoded=decoders.decode(notification);
  assert.equal(decoded?.protocol,'420Launchpad');
  assert.equal(decoded?.fields.saleId,sale);
  assert.equal(decoded?.fields.participant,participant);
  assert.equal(decoded?.fields.eventType,h(3));
  const rep=decoders.decode(reputation);
  assert.equal(rep?.fields.participantProfileId,profile);
  assert.equal(rep?.fields.interactionKind,h(6));
  const db=new RecordingDb();
  const projected=await new ProtocolProjection420(db,decoders).applyLogs(420n,[notification,reputation]);
  assert.equal(projected,2);
  assert.equal(db.queries.length,2);
  assert.equal(db.queries[0]?.params?.[7],'420Launchpad');
  assert.equal(db.queries[1]?.params?.[8],'ReputationEvidencePublished');
  for(const altered of [
    {...notification,address:a(9999)},
    {...notification,topics:notification.topics.slice(0,-1)},
    {...notification,topics:[...notification.topics,h(5)]},
    {...notification,blockHash:'0xdeadbeef' as Hex},
    {...notification,data:'0x1' as Hex}
  ])assert.throws(()=>decoders.decode(altered),/mismatch|malformed/);
  assert.equal(decoders.decode({...notification,removed:true}),null);
});
test('cross-chain, substituted Registry graph and mismatched router bytecode fail before Launchpad indexing',async()=>{
  const source=fakeSource();
  await assert.rejects(()=>verifyLaunchpadIndexerDeployment420(source,421n,genesis,R),/chain mismatch/);
  await assert.rejects(()=>verifyLaunchpadIndexerDeployment420(source,420n,h(88),R),/genesis mismatch/);
  const badCode={...source,getCode:async(addr:Hex)=>addr===ROUTER?'0x6002' as Hex:code};
  await assert.rejects(()=>verifyLaunchpadIndexerDeployment420(badCode,420n,genesis,R),/codehash differs/);
  const changed={...source,call:async(request:{to:Hex;data:Hex})=>{
    const name=registryAbi.parseTransaction({data:request.data})?.name;
    if(request.to===CROWD&&name==='allocations')return registryAbi.encodeFunctionResult('allocations',[a(8080)]) as Hex;
    return source.call(request);
  }};
  await assert.rejects(()=>verifyLaunchpadIndexerDeployment420(changed,420n,genesis,R),/dependency graph mismatch/);
});
