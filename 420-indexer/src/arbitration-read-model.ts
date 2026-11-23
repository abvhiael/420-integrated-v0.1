// Read-only Arbitration case history from the *shared* idx_protocol_events table.
// No secondary canonical-state store or permission/settlement authority is created.
import {Interface} from 'ethers';
import type {SqlExecutor420} from './core-projections.js';
import type {ChainSource420,Hex} from './chain-source.js';
import type {ArbitrationIndexerDeployment420} from './arbitration-indexer.js';
import {decodePositionCursor420,encodePositionCursor420,normalizeLimit420,type QueryPage420,type QueryDirection420} from './query-layer.js';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const MAX_EVENTS_PER_CASE=20000;
const EVENT_NAMES=[
 'CaseOpened','EvidenceCommitted','CaseRuled','RulingSubmitted',
 'CaseAppealed','CaseFinalized','RulingFinalized'
] as const;
const CASE_NAMES=new Set(['CaseOpened','EvidenceCommitted','CaseRuled','CaseAppealed','CaseFinalized']);
const STATE_NAMES=['NONE','OPEN','RULED','FINALIZED'] as const;
type CaseState420='OPEN'|'RULED'|'FINALIZED';
export type ArbitrationCanonicality420='confirmed'|'pending'|'stale'|'reorganized';
export type ArbitrationPublicFields420=Record<string,string>;
export interface ArbitrationHistoryEntry420 {
 eventName:string;caseId:string;round:number;fields:ArbitrationPublicFields420;
 blockNumber:string;blockHash:string;transactionHash:string;
 transactionIndex:number;logIndex:number;contractAddress:string;
}
export interface ArbitrationCaseProjection420{
 schemaVersion:'420-arbitration-case-read-v1';protocol:'420Arbitration';authoritative:false;
 chainId:string;caseId:string;domainId:string;claimant:string;respondent:string;
 originComponentId:string;originObjectId:string;state:CaseState420;round:number;
 evidenceCount:number;appeals:number;outcomeCode:string|null;
 rulingHash:string|null;remedyCommitment:string|null;appealDeadline:string|null;
 lastTransactionHash:string;lastBlockNumber:string;lastBlockHash:string;
 canonicality:ArbitrationCanonicality420;indexedHead:string;observedHead:string;
}
export interface ArbitrationCaseDetail420{
 case:ArbitrationCaseProjection420|null;history:QueryPage420<ArbitrationHistoryEntry420>;
 canonicality:ArbitrationCanonicality420;authoritative:false;indexedHead:string;observedHead:string;
}
export interface ArbitrationCaseFilters420 {
 claimant?:string;respondent?:string;domainId?:string;status?:CaseState420;round?:number;
 cursor?:string;limit?:number;direction?:QueryDirection420;
}
interface SqlRow420{[field:string]:unknown;}
function rows(response:unknown):SqlRow420[]{
 if(!response||typeof response!=='object'||!Array.isArray((response as any).rows))
  throw Error('Arbitration Indexer SQL response malformed');
 return (response as any).rows;
}
function required(value:unknown,label:string):string{
 if(typeof value!=='string'||value.length===0)throw Error('Arbitration projected field missing: '+label);
 return value.toLowerCase();
}
function hex(value:unknown,label:string,kind:'hash'|'address'='hash'):string{
 const text=required(value,label),pattern=kind==='hash'?HASH:ADDRESS;
 if(!pattern.test(text)||BigInt(text)===0n)throw Error('Arbitration projected '+label+' invalid');
 return text;
}
function uint(value:unknown,label:string,max?:bigint):bigint{
 if(typeof value!=='bigint'&&typeof value!=='number'&&typeof value!=='string')
  throw Error('Arbitration projected integer missing: '+label);
 const raw=String(value);
 if(!/^\d+$/.test(raw))throw Error('Arbitration projected integer invalid: '+label);
 const n=BigInt(raw);if(max!==undefined&&n>max)throw Error('Arbitration projected integer exceeds range: '+label);
 return n;
}
function number(value:unknown,label:string,max=Number.MAX_SAFE_INTEGER):number{
 const result=uint(value,label,BigInt(max));
 return Number(result);
}
function publicFields(value:unknown):ArbitrationPublicFields420{
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw Error('Arbitration event JSON invalid');}}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Arbitration event fields malformed');
 const out:Record<string,string>={};
 for(const [k,v] of Object.entries(value)){
  if(/(plaintext|document|payload|secret|credential|private|ciphertext|accesskey)/i.test(k))
   throw Error('Arbitration Indexer confidential fields forbidden');
  if(typeof v!=='boolean'&&typeof v!=='number'&&typeof v!=='string'&&typeof v!=='bigint')
   throw Error('Arbitration unexpected event field value');
  out[k]=String(v).toLowerCase();
 }
 return out;
}
function event(row:SqlRow420,binding:ArbitrationIndexerDeployment420):ArbitrationHistoryEntry420{
 const eventName=String(row.event_name??'');
 if(!EVENT_NAMES.includes(eventName as any))throw Error('unexpected Arbitration event type');
 const contractAddress=hex(row.contract_address,'emitter','address');
 const expected=CASE_NAMES.has(eventName)?
  binding.addresses.ArbitrationCaseRegistry420:binding.addresses.ArbitrationRulingRegistry420;
 if(contractAddress!==expected)throw Error('Arbitration event wrong verified contract address');
 const fields=publicFields(row.fields);
 const caseId=hex(fields.caseId,'caseId');
 return {
  eventName,caseId,round:eventName==='CaseOpened'?0:number(fields.round,'round',3),
  fields,blockNumber:uint(row.block_number,'blockNumber').toString(),
  blockHash:hex(row.block_hash,'blockHash'),transactionHash:hex(row.tx_hash,'transactionHash'),
  transactionIndex:number(row.tx_index,'transactionIndex'),logIndex:number(row.log_index,'logIndex'),
  contractAddress
 };
}
const tuple=(e:ArbitrationHistoryEntry420)=>[BigInt(e.blockNumber),e.transactionIndex,e.logIndex] as const;
const before=(a:ArbitrationHistoryEntry420,b:ArbitrationHistoryEntry420)=>{
 const x=tuple(a),y=tuple(b);return x[0]!==y[0]?(x[0]<y[0]?-1:1):
 x[1]!==y[1]?x[1]-y[1]:x[2]-y[2];
};
const position=(e:ArbitrationHistoryEntry420)=>encodePositionCursor420({
 blockNumber:BigInt(e.blockNumber),txIndex:e.transactionIndex,logIndex:e.logIndex
});
export function replayArbitrationCase420(events:readonly ArbitrationHistoryEntry420[]):Omit<
 ArbitrationCaseProjection420,'canonicality'|'indexedHead'|'observedHead'|'chainId'>|null{
 if(!events.length)return null;
 const sorted=[...events].sort(before);
 const seen=new Map<string,string>();
 const evidenceKeys=new Set<string>();
 let state:CaseState420|null=null,round=0,appeals=0,evidenceCount=0;
 let id='',domain='',claimant='',respondent='',component='',object='';
 let outcomeCode:string|null=null,rulingHash:string|null=null,remedyCommitment:string|null=null;
 let appealDeadline:string|null=null,ruledTx:string|null=null,finalTx:string|null=null;
 let finalized=false,opened=0,rulingForRound=new Map<number,{rulingHash:string;remedyCommitment:string}>();
 let last:ArbitrationHistoryEntry420|null=null;
 for(const e of sorted){
  if(!HASH.test(e.blockHash)||!HASH.test(e.transactionHash)||!HASH.test(e.caseId)||
   !Number.isSafeInteger(e.transactionIndex)||e.transactionIndex<0||
   !Number.isSafeInteger(e.logIndex)||e.logIndex<0)throw Error('Arbitration invalid canonical event provenance');
  const key=e.blockHash+':'+e.transactionHash+':'+e.logIndex;
  const canonical=JSON.stringify(e);
  if(seen.has(key)){
   if(seen.get(key)!==canonical)throw Error('Arbitration conflicting duplicate event');
   continue;
  }
  seen.set(key,canonical);
  if(last&&before(last,e)>=0)throw Error('Arbitration event position conflict');
  if(id&&e.caseId!==id)throw Error('Arbitration cross-case substitution');
  if(e.eventName==='CaseOpened'){
   if(opened++)throw Error('Arbitration duplicate case opening');
   if(e.round!==0)throw Error('Arbitration opening round invalid');
   id=hex(e.caseId,'opened case');const f=e.fields;
   domain=hex(f.domainId,'domainId');claimant=hex(f.claimant,'claimant','address');
   respondent=hex(f.respondent,'respondent','address');
   component=hex(f.originComponentId,'originComponentId');
   object=hex(f.originObjectId,'originObjectId');
   if(claimant===respondent)throw Error('Arbitration claimant/respondent identical');
   state='OPEN';round=0;
  }else{
   if(!state||!id)throw Error('Arbitration orphan event before case opening');
   const f=e.fields;
   if(e.eventName==='EvidenceCommitted'){
    if(state!=='OPEN'||e.round!==round||
     ![claimant,respondent].includes(hex(f.submitter,'submitter','address'))||
     !hex(f.evidenceHash,'evidenceHash'))throw Error('Arbitration evidence case/round/participant invalid');
    const evidenceKey=round+':'+hex(f.evidenceHash,'evidenceHash');
    if(evidenceKeys.has(evidenceKey))throw Error('Arbitration duplicate evidence commitment in round');
    evidenceKeys.add(evidenceKey);evidenceCount++;
   }else if(e.eventName==='CaseRuled'){
    if(state!=='OPEN'||e.round!==round||ruledTx||finalTx)throw Error('Arbitration invalid ruled transition');
    appealDeadline=uint(f.appealDeadline,'appealDeadline',(1n<<64n)-1n).toString();
    ruledTx=e.transactionHash;state='RULED';
   }else if(e.eventName==='RulingSubmitted'){
    if(state!=='RULED'||e.round!==round||ruledTx!==e.transactionHash||
     rulingForRound.has(round))throw Error('Arbitration unmatched ruling/round/transaction');
    hex(f.resolver,'resolver','address');
    outcomeCode=uint(f.outcomeCode,'outcomeCode',(1n<<32n)-1n).toString();
    if(outcomeCode==='0')throw Error('Arbitration empty ruling outcome');
    rulingHash=hex(f.rulingHash,'rulingHash');
    remedyCommitment=hex(f.remedyCommitment,'remedyCommitment');
    if(typeof f.panelCommitment!=='string'||!HASH.test(f.panelCommitment))
     throw Error('Arbitration ruling panel commitment malformed');
    rulingForRound.set(round,{rulingHash,remedyCommitment});
    ruledTx=null;
   }else if(e.eventName==='CaseAppealed'){
    if(state!=='RULED'||ruledTx||finalTx||e.round!==round+1||e.round>3||
     !rulingForRound.has(round)||![claimant,respondent].includes(hex(f.appellant,'appellant','address')))
     throw Error('Arbitration invalid appeal transition');
    uint(f.evidenceDeadline,'evidenceDeadline',(1n<<64n)-1n);
    round++;appeals++;state='OPEN';appealDeadline=null;outcomeCode=null;rulingHash=null;remedyCommitment=null;
   }else if(e.eventName==='CaseFinalized'){
    if(state!=='RULED'||e.round!==round||ruledTx||finalTx||
     !rulingForRound.has(round))throw Error('Arbitration invalid finalization transition');
    state='FINALIZED';finalTx=e.transactionHash;
   }else if(e.eventName==='RulingFinalized'){
    const ruling=rulingForRound.get(round);
    if(state!=='FINALIZED'||e.round!==round||finalTx!==e.transactionHash||
     !ruling||hex(f.rulingHash,'final ruling')!==ruling.rulingHash||
     hex(f.remedyCommitment,'final remedy')!==ruling.remedyCommitment||finalized)
     throw Error('Arbitration mismatched finalized ruling');
    finalTx=null;finalized=true;
   }
  }
  last=e;
 }
 if(!opened||!state||!last||ruledTx||finalTx||state==='FINALIZED'&&!finalized)
  throw Error('Arbitration incomplete canonical case/ruling history');
 return {schemaVersion:'420-arbitration-case-read-v1',protocol:'420Arbitration',authoritative:false,
  caseId:id,domainId:domain,claimant,respondent,originComponentId:component,originObjectId:object,
  state,round,evidenceCount,appeals,outcomeCode,rulingHash,remedyCommitment,appealDeadline,
  lastTransactionHash:last.transactionHash,lastBlockNumber:last.blockNumber,lastBlockHash:last.blockHash};
}
const CANONICAL_ABI=new Interface([
 'function caseState(bytes32) view returns (uint8)',
 'function caseRound(bytes32) view returns (uint8)'
]);
export class ArbitrationHistoryReadModel420 {
 constructor(readonly db:SqlExecutor420,readonly source:ChainSource420,
  readonly binding:ArbitrationIndexerDeployment420){}
 private async checkpoint(){
  const r=rows(await this.db.query('select block_number,block_hash,finalized_number,finalized_hash from idx_checkpoints where chain_id=$1',
   [this.binding.chainId.toString()]));
  if(!r.length)return null;
  const n=uint(r[0]!.block_number,'checkpoint block'),hashValue=hex(r[0]!.block_hash,'checkpoint hash');
  const canonical=await this.source.getBlockByNumber(n);
  const head=await this.source.blockNumber();
  const status:ArbitrationCanonicality420=!canonical||canonical.hash.toLowerCase()!==hashValue?'reorganized':
   head>n+64n?'stale':head>n||r[0]!.finalized_number===null||r[0]!.finalized_number===undefined||uint(r[0]!.finalized_number,'finalized')<n?'pending':'confirmed';
  return {number:n,hash:hashValue,observedHead:head,status,
   finalized:r[0]!.finalized_number===null?null:
    r[0]!.finalized_number===undefined?null:uint(r[0]!.finalized_number,'finalized number')};
 }
 private async stable(snap:NonNullable<Awaited<ReturnType<ArbitrationHistoryReadModel420['checkpoint']>>>){
  const local=rows(await this.db.query('select block_number,block_hash from idx_checkpoints where chain_id=$1',
   [this.binding.chainId.toString()]))[0];
  const remote=await this.source.getBlockByNumber(snap.number);
  if(!local||uint(local.block_number,'checkpoint height')!==snap.number||
   String(local.block_hash).toLowerCase()!==snap.hash||
   !remote||remote.hash.toLowerCase()!==snap.hash)
   throw Error('Arbitration read interrupted by chain reorganization or checkpoint advance');
 }
 private async verifiedState(state:ReturnType<typeof replayArbitrationCase420>,
  block:bigint):Promise<void>{
  if(!state)return;
  const checkCall=async(name:'caseState'|'caseRound')=>{
   const raw=await this.source.call({to:this.binding.addresses.ArbitrationCaseRegistry420,
    data:CANONICAL_ABI.encodeFunctionData(name,[state.caseId]) as Hex},block);
   return BigInt(CANONICAL_ABI.decodeFunctionResult(name,raw)[0]);
  };
  const [observedState,observedRound]=await Promise.all([checkCall('caseState'),checkCall('caseRound')]);
  if(observedState!==BigInt(STATE_NAMES.indexOf(state.state))||observedRound!==BigInt(state.round))
   throw Error('Arbitration projection disagrees with canonical contract state');
 }
 private async raw(caseId:string):Promise<ArbitrationHistoryEntry420[]>{
  const id=hex(caseId,'caseId');
  const r=rows(await this.db.query(
   `select e.* from idx_protocol_events e
    join idx_blocks b on b.chain_id=e.chain_id and b.block_number=e.block_number and b.block_hash=e.block_hash
    where e.chain_id=$1 and e.protocol='420Arbitration' and lower(e.fields->>'caseId')=$2
    and e.contract_address in ($3,$4)
    order by e.block_number asc,e.tx_index asc,e.log_index asc limit $5`,
   [this.binding.chainId.toString(),id,
    this.binding.addresses.ArbitrationCaseRegistry420,
    this.binding.addresses.ArbitrationRulingRegistry420,MAX_EVENTS_PER_CASE+1]));
  if(r.length>MAX_EVENTS_PER_CASE)throw Error('Arbitration history exceeds safe single-case reconstruction bound');
  const events=r.map(row=>event(row,this.binding));
  if(events.some(e=>e.caseId!==id))throw Error('Arbitration case ID corrupted in projection');
  return events;
 }
 async case(caseId:string):Promise<ArbitrationCaseProjection420|null>{
  const snap=await this.checkpoint();
  if(!snap||snap.status==='reorganized')return null;
  const events=await this.raw(caseId);
  if(!events.length){await this.stable(snap);return null;}
  const result=replayArbitrationCase420(events);
  await this.verifiedState(result,snap.number);
  await this.stable(snap);
  return result?{...result,chainId:this.binding.chainId.toString(),
   canonicality:snap.status,indexedHead:snap.number.toString(),observedHead:snap.observedHead.toString()}:null;
 }
 async history(caseId:string,request:{cursor?:string;limit?:number;direction?:QueryDirection420}={}):
  Promise<ArbitrationCaseDetail420>{
  const snap=await this.checkpoint();
  if(!snap||snap.status==='reorganized')return {
   case:null,history:{items:[],nextCursor:null},canonicality:snap?.status??'pending',
   authoritative:false,indexedHead:snap?.number.toString()??'0',
   observedHead:snap?.observedHead.toString()??'0'
  };
  const c=await this.case(caseId);
  if(!c){await this.stable(snap);return {
   case:null,history:{items:[],nextCursor:null},canonicality:snap.status,authoritative:false,
   indexedHead:snap.number.toString(),observedHead:snap.observedHead.toString()
  };}
  const direction=request.direction??'asc',limit=normalizeLimit420(request.limit);
  if(direction!=='asc'&&direction!=='desc')throw Error('Arbitration history ordering invalid');
  const all=await this.raw(caseId);
  if(request.cursor){
   const cursor=decodePositionCursor420(request.cursor);
   const compare=(e:ArbitrationHistoryEntry420)=>{
    const n=BigInt(e.blockNumber);
    return n===cursor.blockNumber?e.transactionIndex===cursor.txIndex?
     e.logIndex-cursor.logIndex:e.transactionIndex-cursor.txIndex:
     n<cursor.blockNumber?-1:1;
   };
   const filtered=all.filter(e=>direction==='asc'?compare(e)>0:compare(e)<0);
   const ordered=direction==='asc'?filtered:filtered.reverse();
   const items=ordered.slice(0,limit);
   await this.stable(snap);
   return {case:c,history:{items,nextCursor:ordered.length>limit&&items.length?
    position(items[items.length-1]!):null},canonicality:snap.status,authoritative:false,
    indexedHead:snap.number.toString(),observedHead:snap.observedHead.toString()};
  }
  const ordered=direction==='asc'?all:all.reverse();
  const items=ordered.slice(0,limit);
  await this.stable(snap);
  return {case:c,history:{items,nextCursor:ordered.length>limit&&items.length?
   position(items[items.length-1]!):null},canonicality:snap.status,authoritative:false,
   indexedHead:snap.number.toString(),observedHead:snap.observedHead.toString()};
 }
 async cases(filters:ArbitrationCaseFilters420={}):Promise<QueryPage420<ArbitrationCaseProjection420>>{
  const snap=await this.checkpoint();
  if(!snap||snap.status==='reorganized')return {items:[],nextCursor:null};
  const limit=normalizeLimit420(filters.limit);
  const dir=filters.direction??'desc';
  if(dir!=='asc'&&dir!=='desc')throw Error('Arbitration case ordering invalid');
  const params:unknown[]=[this.binding.chainId.toString(),
   this.binding.addresses.ArbitrationCaseRegistry420];
  const predicates=["e.chain_id=$1","e.protocol='420Arbitration'",
   "e.event_name='CaseOpened'","e.contract_address=$2"];
  for(const [name,kind] of [['claimant','address'],['respondent','address'],['domainId','hash']] as const){
   const value=filters[name];if(value){
    params.push(hex(value,name,kind));predicates.push(`lower(e.fields->>'${name}')=$${params.length}`);
   }
  }
  if(filters.round!==undefined){
   if(!Number.isInteger(filters.round)||filters.round<0||filters.round>3)
    throw Error('Arbitration round filter invalid');
  }
  if(filters.status!==undefined&&!['OPEN','RULED','FINALIZED'].includes(filters.status))
   throw Error('Arbitration status filter invalid');
  if(filters.cursor){
   const c=decodePositionCursor420(filters.cursor);
   params.push(c.blockNumber.toString(),c.txIndex,c.logIndex);
   predicates.push(`(e.block_number,e.tx_index,e.log_index) ${dir==='asc'?'>':'<'}
     ($${params.length-2},$${params.length-1},$${params.length})`);
  }
  // Page source case openings rather than post-filtered states. A page can be
  // empty with a nextCursor when all candidates fail status/round filters.
  params.push(limit+1);
  const r=rows(await this.db.query(`select e.* from idx_protocol_events e
    join idx_blocks b on b.chain_id=e.chain_id and b.block_number=e.block_number and b.block_hash=e.block_hash
    where ${predicates.join(' and ')}
    order by e.block_number ${dir},e.tx_index ${dir},e.log_index ${dir}
    limit $${params.length}`,params));
  const page=r.slice(0,limit).map(row=>event(row,this.binding));
  const results:ArbitrationCaseProjection420[]=[];
  for(const e of page){
   const item=await this.case(e.caseId);
   if(!item)throw Error('Arbitration indexed case opening missing canonical history');
   if(filters.round!==undefined&&item.round!==filters.round)continue;
   if(filters.status!==undefined&&item.state!==filters.status)continue;
   results.push(item);
  }
  await this.stable(snap);
  return {items:results,nextCursor:r.length>limit&&page.length?position(page[page.length-1]!):null};
 }
}
