import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import { aiJobState420, aiProviderState420, aiJobs420, AI_READ_SCHEMA_VERSION_420 } from '../src/ai-read-model.js';

const h=(n:number)=>`0x${n.toString(16).padStart(64,'0')}`;
const a=(n:number)=>`0x${n.toString(16).padStart(40,'0')}`;
class QueueDb implements SqlExecutor420{queue:unknown[]=[];calls:Array<{sql:string;params?:readonly unknown[]}>=[];async query(sql:string,params?:readonly unknown[]){this.calls.push({sql,params});return this.queue.shift()??{rows:[]};}}
const row=(event_name:string,fields:Record<string,unknown>,block=1)=>({event_name,fields,block_number:String(block),block_hash:h(100+block),tx_hash:h(200+block),tx_index:0,log_index:block});

test('AI job read model rebuilds AI/CMP/escrow lifecycle from canonical event history',async()=>{
 const db=new QueueDb();db.queue.push({rows:[
  row('JobCreated',{jobId:h(1),requester:a(1),modelVersionId:h(2),workloadClass:h(3),maxSpend:'100',deadline:'999'},1),
  row('FundingConfirmed',{jobId:h(1),fundingRef:h(4),amount:'80'},2),
  row('Funded',{jobId:h(1),payer:a(2),providerId:h(5),amount:'80'},3),
  row('FundingBound',{jobId:h(1),vaultRef:h(6),fundingRef:h(4),beneficiary:a(3),amount:'80'},4),
  row('ComputeMatched',{jobId:h(1),computeRequestId:h(7),computeJobId:h(8),providerId:h(5)},5),
  row('JobStatus',{jobId:h(1),previousStatus:'2',newStatus:'3'},6),
  row('ResultCommitted',{jobId:h(1),resultHash:h(9),resultManifestHash:h(10)},7),
  row('JobStatus',{jobId:h(1),previousStatus:'5',newStatus:'6'},8),
  row('JobStatus',{jobId:h(1),previousStatus:'6',newStatus:'7'},9),
  row('SettlementReferenceBound',{jobId:h(1),settlementRef:h(11),state:'2'},10)
 ]});
 const s=await aiJobState420(db,420n,h(1),{expectedChainId:420n});
 assert.equal(s?.schemaVersion,AI_READ_SCHEMA_VERSION_420);assert.equal(s?.computeJobId,h(8));assert.equal(s?.beneficiary,a(3));assert.equal(s?.status,'VERIFIED');assert.equal(s?.escrowState,'CLAIMABLE');assert.equal(s?.authoritative,false);
});

test('AI provider state is rebuildable and preserves current CMP provider reference',async()=>{
 const db=new QueueDb();db.queue.push({rows:[
  row('ProviderRegistered',{providerId:h(1),operatorAccount:a(1),settlementAccount:a(2),stakeRef:h(3),computeProviderRef:h(4)},1),
  row('ProviderMetadataUpdated',{providerId:h(1),metadataHash:h(5),revision:'2'},2),
  row('ProviderStateChanged',{providerId:h(1),previousState:'1',newState:'2',revision:'3'},3)
 ]});
 const s=await aiProviderState420(db,420n,h(1));assert.equal(s?.computeProviderRef,h(4));assert.equal(s?.state,'ACTIVE');assert.equal(s?.revision,'3');
});

test('AI read model fails closed on wrong network and private-field contamination',async()=>{
 const wrong=new QueueDb();await assert.rejects(()=>aiProviderState420(wrong,1n,h(1),{expectedChainId:420n}),/network mismatch/);
 const leak=new QueueDb();leak.queue.push({rows:[row('JobCreated',{jobId:h(1),requester:a(1),modelVersionId:h(2),workloadClass:h(3),maxSpend:'1',deadline:'9',prompt:'do not index me'},1)]});
 await assert.rejects(()=>aiJobState420(leak,420n,h(1)),/private field leakage blocked/);
});

test('AI collection reads use bounded opaque keyset pagination and chain scope',async()=>{
 const db=new QueueDb();
 db.queue.push({rows:[{object_id:h(1),block_number:'9',tx_index:1,log_index:2},{object_id:h(2),block_number:'8',tx_index:1,log_index:1}]});
 db.queue.push({rows:[row('JobCreated',{jobId:h(1),requester:a(1),modelVersionId:h(2),workloadClass:h(3),maxSpend:'1',deadline:'9'},9)]});
 const page=await aiJobs420(db,420n,{limit:1},{expectedChainId:420n});
 assert.equal(page.items.length,1);assert.ok(page.nextCursor);assert.match(db.calls[0]!.sql,/with latest/);assert.deepEqual(db.calls[0]!.params?.slice(0,2),['420','jobId']);
});

test('AI event history is queried in canonical replay order so reorg rollback/rebuild can reconstruct state',async()=>{
 const db=new QueueDb();db.queue.push({rows:[row('ProviderRegistered',{providerId:h(1),operatorAccount:a(1),settlementAccount:a(2),stakeRef:h(3),computeProviderRef:h(4)},5)]});
 await aiProviderState420(db,420n,h(1));assert.match(db.calls[0]!.sql,/order by block_number asc, tx_index asc, log_index asc/);
});

test('AI protocol projection rollback removes orphaned events and permits canonical replay',async()=>{
 class TxDb extends QueueDb implements TransactionalSql420{async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{return work(this);}}
 const db=new TxDb();const topic=h(999) as Hex;
 const projection=new ProtocolProjection420(db,new ProtocolDecoderRegistry420([{protocol:'420AI',eventName:'JobStatus',topic0:topic,fields:[{name:'jobId',kind:'bytes32',indexed:true},{name:'previousStatus',kind:'uint8',indexed:false},{name:'newStatus',kind:'uint8',indexed:false}]}]));
 const data=`0x${BigInt(5).toString(16).padStart(64,'0')}${BigInt(6).toString(16).padStart(64,'0')}` as Hex;
 const log:IndexerLog={address:a(9) as Hex,blockHash:h(90) as Hex,blockNumber:50n,transactionHash:h(91) as Hex,transactionIndex:0,logIndex:1,topics:[topic,h(1) as Hex],data};
 await projection.applyLogs(420n,[log]);await projection.rollbackTo(49n);await projection.applyLogs(420n,[{...log,blockHash:h(92) as Hex,transactionHash:h(93) as Hex}]);
 assert.equal(db.calls.filter((x)=>/insert into idx_protocol_events/.test(x.sql)).length,2);
 assert.equal(db.calls.some((x)=>/delete from idx_protocol_events where block_number > \$1/.test(x.sql)),true);
});
