import {AbiCoder,Interface,id,keccak256} from 'ethers';
import type {ChainSource420,Hex,IndexerLog,IndexerTransaction,IndexerReceipt,IndexerBlock,LogFilter420} from '../../src/chain-source.js';
import type {ArbitrationIndexerPins420,ArbitrationIndexerManifest420} from '../../src/arbitration-indexer.js';
import type {Artifact420} from '../../src/abi-manifest.js';
import {readFileSync} from 'node:fs';

const h=(n:number):Hex=>('0x'+n.toString(16).padStart(64,'0')) as Hex;
const a=(n:number):Hex=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
export const ARB_CASE_ID_420=h(500);
export const ARB_CLAIMANT_420=a(100),ARB_RESPONDENT_420=a(101);
export const ARB_CASES_420=a(201),ARB_RULINGS_420=a(202),ARB_POLICIES_420=a(203),ARB_ROUTER_420=a(204);
const registry=a(0x434);
const CODE=new Map<string,Hex>([
 [registry,'0x6001'],[ARB_ROUTER_420,'0x6002'],[ARB_POLICIES_420,'0x6003'],
 [ARB_CASES_420,'0x6004'],[ARB_RULINGS_420,'0x6005']
]);
const hash=(address:Hex):Hex=>keccak256(CODE.get(address)!) as Hex;
const root=keccak256(AbiCoder.defaultAbiCoder().encode(
 ['address','address','address','address','bytes32','bytes32','bytes32','bytes32'],
 [ARB_POLICIES_420,ARB_CASES_420,ARB_RULINGS_420,ARB_ROUTER_420,
  hash(ARB_POLICIES_420),hash(ARB_CASES_420),hash(ARB_RULINGS_420),hash(ARB_ROUTER_420)]
)) as Hex;
export const ARB_PINS_420:ArbitrationIndexerPins420={
 chainId:420n,genesisHash:h(1),registryAddress:registry,registryCodeHash:hash(registry),
 version:1,metadataHash:h(900),manifestHash:h(901),interfaceHash:h(902)
};
export const ARB_MANIFEST_420=JSON.parse(readFileSync(
 new URL('../../descriptors/arbitration420-v1.json',import.meta.url),'utf8')) as ArbitrationIndexerManifest420;
export const ARB_ARTIFACTS_420=new Map<string,Artifact420>(ARB_MANIFEST_420.contracts.map(c=>[
 c.contractName,{contractName:c.contractName,
  abi:c.events.map(e=>({type:'event' as const,name:e.name,inputs:e.inputs.map(i=>({...i}))}))}
]));
const REGISTRY_ABI=new Interface([
 'function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)',
 'function resolveActive(bytes32) view returns (address,uint32)',
 'function getRegistrationProfile(bytes32,uint32) view returns (uint8,bytes32,bytes32,bytes32)'
]);
const TARGET_ABI=new Interface([
 'function policies() view returns (address)','function cases() view returns (address)',
 'function rulings() view returns (address)','function rulingRegistry() view returns (address)',
 'function protocolVersion() view returns (uint32)','function caseState(bytes32) view returns (uint8)',
 'function caseRound(bytes32) view returns (uint8)'
]);
interface EventDatum420{name:string;fields:Record<string,string>;block:number;tx:number;log:number;}
const base={caseId:ARB_CASE_ID_420};
function canonicalEvents420(fork=false):EventDatum420[]{
 const rulHash=fork?h(600):h(17),remedy=fork?h(601):h(18);
 return [
  {name:'CaseOpened',fields:{...base,domainId:h(10),claimant:ARB_CLAIMANT_420,
   respondent:ARB_RESPONDENT_420,originComponentId:h(11),originObjectId:h(12)},block:1,tx:1,log:0},
  {name:'EvidenceCommitted',fields:{...base,round:'0',submitter:ARB_CLAIMANT_420,evidenceHash:h(13)},block:2,tx:2,log:0},
  {name:'CaseRuled',fields:{...base,round:'0',appealDeadline:'1000'},block:3,tx:3,log:0},
  {name:'RulingSubmitted',fields:{...base,round:'0',resolver:a(102),outcomeCode:'1',
   rulingHash:h(14),remedyCommitment:h(15),panelCommitment:h(0)},block:3,tx:3,log:1},
  {name:'CaseAppealed',fields:{...base,round:'1',appellant:ARB_RESPONDENT_420,evidenceDeadline:'1200'},block:4,tx:4,log:0},
  {name:'EvidenceCommitted',fields:{...base,round:'1',submitter:ARB_RESPONDENT_420,evidenceHash:h(16)},block:5,tx:5,log:0},
  {name:'CaseRuled',fields:{...base,round:'1',appealDeadline:'1600'},block:6,tx:6,log:0},
  {name:'RulingSubmitted',fields:{...base,round:'1',resolver:a(103),outcomeCode:'2',
   rulingHash:rulHash,remedyCommitment:remedy,panelCommitment:h(0)},block:6,tx:6,log:1},
  {name:'CaseFinalized',fields:{...base,round:'1'},block:7,tx:7,log:0},
  {name:'RulingFinalized',fields:{...base,round:'1',rulingHash:rulHash,remedyCommitment:remedy},block:7,tx:7,log:1}
 ];
}
export class ArbitrationChainFixture420 implements ChainSource420{
 readonly sourceId='arbitration-canonical-fixture';
 head=7n;fork=false;duplicate=false;interruptAt:number|null=null;
 wrongEmitter=false;wrongVersion=false;wrongReceipt=false;missingLogsAt:number|null=null;
 wrongGenesis=false;wrongRegistryCode=false;wrongBinding=false;rpcDisagree=false;
 finalized:bigint|null=null;
 readonly events=new Map<string,Interface>(ARB_MANIFEST_420.contracts.flatMap(c=>
  c.events.map(e=>[e.name,new Interface([{type:'event',name:e.name,inputs:e.inputs}]) ])));
 chainId():Promise<bigint>{return Promise.resolve(420n);}
 blockNumber():Promise<bigint>{return Promise.resolve(this.head);}
 finalizedBlockNumber():Promise<bigint>{return Promise.resolve(this.finalized??0n);}
 blockHash(n:number):Hex{return n===0?(this.wrongGenesis?h(99):h(1)):h(1000+n+(this.fork&&n>=6?1000:0));}
 getBlockByNumber(n:bigint):Promise<IndexerBlock|null>{
  if(n<0n||n>this.head)return Promise.resolve(null);
  const number=Number(n);
  return Promise.resolve({number:n,hash:this.blockHash(number),
   parentHash:number===0?h(0):this.blockHash(number-1),timestamp:BigInt(100+number)});
 }
 async getBlockByHash(hash:Hex):Promise<IndexerBlock|null>{
  for(let n=0n;n<=this.head;n++){const b=await this.getBlockByNumber(n);if(b?.hash===hash)return b;}
  return null;
 }
 rawLogs(block:number):IndexerLog[]{
  return canonicalEvents420(this.fork).filter(e=>e.block===block).map(e=>{
   const iface=this.events.get(e.name)!,frag=iface.getEvent(e.name)!;
   const spec=ARB_MANIFEST_420.contracts.flatMap(c=>c.events).find(x=>x.name===e.name)!;
   const encoded=iface.encodeEventLog(frag,spec.inputs.map(i=>e.fields[i.name]));
   const owner=['RulingSubmitted','RulingFinalized'].includes(e.name)?ARB_RULINGS_420:ARB_CASES_420;
   return {address:this.wrongEmitter?a(888):owner,blockNumber:BigInt(block),
    blockHash:this.blockHash(block),transactionHash:h(2000+block),
    transactionIndex:0,logIndex:e.log,topics:encoded.topics as Hex[],data:encoded.data as Hex};
  });
 }
 async getLogs(filter:LogFilter420):Promise<IndexerLog[]>{
  const out:IndexerLog[]=[];
  for(let n=filter.fromBlock;n<=filter.toBlock;n++){
   if(this.interruptAt===Number(n))throw Error('injected interrupted Arbitration RPC batch');
   if(this.missingLogsAt===Number(n))continue;
   out.push(...this.rawLogs(Number(n)));
  }
  return this.duplicate?[...out,...out]:out;
 }
 private transaction(n:number):IndexerTransaction{
  return {hash:h(2000+n),blockHash:this.blockHash(n),blockNumber:BigInt(n),
   transactionIndex:0,from:ARB_CLAIMANT_420,to:ARB_CASES_420,input:'0x' as Hex,value:0n};
 }
 getBlockTransactionsByNumber(n:bigint):Promise<IndexerTransaction[]>{
  return Promise.resolve(n>0n&&n<=7n?[this.transaction(Number(n))]:[]);
 }
 getTransactionByHash(hash:Hex):Promise<IndexerTransaction|null>{
  const n=Number(BigInt(hash))-2000;
  return Promise.resolve(n>=1&&n<=7?this.transaction(n):null);
 }
 getTransactionReceipt(hash:Hex):Promise<IndexerReceipt|null>{
  const n=Number(BigInt(hash))-2000;
  if(n<1||n>7)return Promise.resolve(null);
  const tx=this.transaction(n);
  return Promise.resolve({transactionHash:tx.hash,blockHash:tx.blockHash,
   blockNumber:tx.blockNumber,transactionIndex:0,status:1,contractAddress:null,
   logs:this.wrongReceipt?[]:this.rawLogs(n)});
 }
 getCode(address:Hex,_blockNumber?:bigint):Promise<Hex>{
  if(this.wrongRegistryCode&&address===registry)return Promise.resolve('0x6009');
  return Promise.resolve(CODE.get(address)??'0x');
 }
 async call(request:{to:Hex;data:Hex},blockNumber?:bigint):Promise<Hex>{
  const {to,data}=request,iface=to===registry?REGISTRY_ABI:TARGET_ABI;
  const parsed=iface.parseTransaction({data});
  if(!parsed)throw Error('unknown fixture contract call');
  const n=blockNumber??this.head;
  if(this.rpcDisagree&&n>=6n&&to===ARB_CASES_420&&parsed.name==='caseState')
   return iface.encodeFunctionResult(parsed.name,[1]) as Hex;
  const values:(string|number|boolean|bigint)[]=[];
  switch(parsed.name){
   case 'getService':values.push(ARB_ROUTER_420,hash(ARB_ROUTER_420),ARB_PINS_420.metadataHash,
    this.wrongVersion?2:1,0,true);break;
   case 'resolveActive':values.push(ARB_ROUTER_420,this.wrongVersion?2:1);break;
   case 'getRegistrationProfile':values.push(3,ARB_PINS_420.manifestHash,root,ARB_PINS_420.interfaceHash);break;
   case 'policies':values.push(ARB_POLICIES_420);break;
   case 'cases':values.push(this.wrongBinding?a(600):ARB_CASES_420);break;
   case 'rulings':case 'rulingRegistry':values.push(ARB_RULINGS_420);break;
   case 'protocolVersion':values.push(this.wrongVersion?2:1);break;
   case 'caseState':values.push(n>=7n?3:n>=6n?2:n>=4n?1:n>=3n?2:1);break;
   case 'caseRound':values.push(n>=4n?1:0);break;
   default:throw Error('fixture unsupported ABI call '+parsed.name);
  }
  return iface.encodeFunctionResult(parsed.name,values) as Hex;
 }
}
