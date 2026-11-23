import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PostgresSql420} from '../src/postgres.js';
import type {SqlExecutor420} from '../src/core-projections.js';
import {CoreProjectionConsumer420} from '../src/core-projections.js';
import {ProtocolProjection420} from '../src/protocol-projections.js';
import {ProtocolDecoderRegistry420} from '../src/protocol-decoder.js';
import {SqlCanonicalHistoryStore420,SqlCheckpointStore420} from '../src/recovery-store.js';
import {IndexerIngestor420} from '../src/ingestor.js';
import {ArbitrationHistoryReadModel420} from '../src/arbitration-read-model.js';
import {arbitrationDescriptorsFromManifest420,createArbitrationIndexer420,
 verifyArbitrationIndexerDeployment420} from '../src/arbitration-indexer.js';
import {IndexerQueryService420} from '../src/query-service.js';
import {IndexerPublicApiAdapter420} from '../src/api-surface.js';
import {routeIndexerHttp420} from '../src/http-transport.js';
import {ArbitrationChainFixture420,ARB_CASE_ID_420,ARB_CLAIMANT_420,ARB_RESPONDENT_420,
 ARB_PINS_420,ARB_MANIFEST_420,ARB_ARTIFACTS_420} from './helpers/arbitration-chain-fixture.js';

const databaseUrl=process.env.INDEXER_PG_URL;
class FaultDb420 extends PostgresSql420{
  interrupt=false;
  override async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{
    return super.transaction(async tx=>work({query:async(sql,params)=>{
      if(this.interrupt&&sql.includes('insert into idx_checkpoints'))
       throw Error('injected Arbitration checkpoint persistence interruption');
      return tx.query(sql,params);
    }}));
  }
}
async function rows(db:PostgresSql420,sql:string,params:unknown[]=[]):Promise<Record<string,unknown>[]>{
 return (await db.query(sql,params) as {rows:Record<string,unknown>[]}).rows;
}
const protocolRows=(db:PostgresSql420)=>rows(db,`select
  chain_id::text,block_number::text,block_hash,tx_hash,tx_index,log_index,
  contract_address,event_name,fields from idx_protocol_events
  where chain_id=420 order by block_number,tx_index,log_index`);
async function setup(t:import('node:test').TestContext){
 const admin=new PostgresSql420({connectionString:databaseUrl});
 await admin.query('drop schema if exists arbitration_pre06 cascade; create schema arbitration_pre06');
 await admin.close();
 let db=new FaultDb420({connectionString:databaseUrl,options:'-c search_path=arbitration_pre06'});
 t.after(async()=>{await db.close();});
 for(const name of [
   '001-core-projections.sql','003-genesis-projections.sql',
   '007-durable-recovery.sql','008-finalized-recovery.sql'
 ]){
  await db.query(await readFile(new URL('../sql/'+name,import.meta.url),'utf8'));
 }
 const source=new ArbitrationChainFixture420();
 const deployment=await verifyArbitrationIndexerDeployment420(source,ARB_PINS_420);
 const descriptor=arbitrationDescriptorsFromManifest420(ARB_MANIFEST_420,ARB_ARTIFACTS_420,deployment);
 const start=async()=>createArbitrationIndexer420(source,db,ARB_PINS_420,
  ARB_MANIFEST_420,ARB_ARTIFACTS_420,{
   finality:{mode:'head'},startBlock:1n,maxBlocksPerRun:100,maxReorgDepth:6
  });
 const model=()=>new ArbitrationHistoryReadModel420(db,source,deployment);
 const checkpoint=async()=>new SqlCheckpointStore420(db,420n).load();
 return {db,source,deployment,descriptor,start,model,checkpoint};
}
test('Arbitration Registry/deployment identity verified before event ingestion',async()=>{
 const source=new ArbitrationChainFixture420();
 const verified=await verifyArbitrationIndexerDeployment420(source,ARB_PINS_420);
 assert.equal(verified.addresses.ArbitrationCaseRegistry420.toLowerCase(),'0x00000000000000000000000000000000000000c9');
 assert.equal(verified.addresses.ArbitrationRulingRegistry420.toLowerCase(),'0x00000000000000000000000000000000000000ca');
 for(const key of ['wrongVersion','wrongBinding','wrongRegistryCode','wrongGenesis'] as const){
  const malicious=new ArbitrationChainFixture420();
  malicious[key]=true;
  await assert.rejects(verifyArbitrationIndexerDeployment420(malicious,ARB_PINS_420),
   /mismatch|drift|invalid|noncanonical|aliased|missing Arbitration deployed code/);
 }
 await assert.rejects(verifyArbitrationIndexerDeployment420(source,{...ARB_PINS_420,chainId:421n}),
  /chain mismatch/);
 await assert.rejects(verifyArbitrationIndexerDeployment420(source,{...ARB_PINS_420,version:2}),
  /mismatch/);
});
test('shared PostgreSQL fresh ingestion, duplicate suppression, atomic interrupted batch, restart and API history', 
 {skip:!databaseUrl,timeout:90000},async t=>{
 const {db,source,deployment,start,model,checkpoint}=await setup(t);
 source.duplicate=true;source.head=3n;
 const run=await (await start()).runOnce();
 assert.equal(run.processed,3);
 assert.equal((await protocolRows(db)).length,4,'duplicate eth_getLogs suppressed');
 const state=await model().case(ARB_CASE_ID_420);
 assert.equal(state?.state,'RULED');assert.equal(state?.round,0);
 assert.equal(state?.canonicality,'pending');
 assert.equal(state?.authoritative,false);
 assert.equal((await checkpoint())?.blockNumber,3n);

 source.head=7n;db.interrupt=true;
 await assert.rejects((await start()).runOnce(),/checkpoint persistence interruption/);
 assert.equal((await checkpoint())?.blockNumber,3n,'checkpoint and block rows atomic');
 assert.equal((await protocolRows(db)).length,4,'interrupted batch published no orphan evidence');
 db.interrupt=false;
 source.interruptAt=5;
 await assert.rejects((await start()).runOnce(),/interrupted Arbitration RPC batch/);
 assert.equal((await checkpoint())?.blockNumber,4n,'previous completed block retained');
 source.interruptAt=null;
 const resumed=await (await start()).runOnce();
 assert.equal(resumed.processed,3);
 assert.equal((await checkpoint())?.blockNumber,7n);
 assert.equal((await protocolRows(db)).length,10);
 assert.equal((await (await start()).runOnce()).processed,0,'restart idempotent');

 const detail=await model().history(ARB_CASE_ID_420,{limit:3});
 assert.equal(detail.case?.state,'FINALIZED');
 assert.equal(detail.case?.round,1);
 assert.equal(detail.case?.appeals,1);
 assert.equal(detail.case?.evidenceCount,2);
 assert.equal(detail.history.items.length,3);
 assert(detail.history.nextCursor);
 const page2=await model().history(ARB_CASE_ID_420,{limit:3,cursor:detail.history.nextCursor!});
 assert.equal(page2.history.items.length,3);
 assert.notEqual(detail.history.items[0]?.transactionHash,page2.history.items[0]?.transactionHash);

 const list=await model().cases({claimant:ARB_CLAIMANT_420,domainId:detail.case!.domainId,limit:1});
 assert.equal(list.items.length,1);
 assert.equal((await model().cases({respondent:ARB_RESPONDENT_420,status:'OPEN'})).items.length,0);
 await assert.rejects(model().cases({round:4}),/round filter/);
 await assert.rejects(model().history(ARB_CASE_ID_420,{limit:201}),/limit must be/);
 await assert.rejects(model().case('0xbad'),/caseId invalid/);

 const api=new IndexerPublicApiAdapter420(new IndexerQueryService420(db),{mode:'head'},
  {arbitration:{source,deployment}});
 assert.equal(api.arbitrationAvailable(),true);
 const listing=await routeIndexerHttp420(api,'GET',
  'http://indexer/v1/arbitration/cases?chainId=420&limit=1&claimant='+ARB_CLAIMANT_420);
 assert.equal(listing.status,200);
 const dto=listing.body as any;
 assert.equal(dto.data.items[0].authoritative,false);
 const history=await routeIndexerHttp420(api,'GET',
  'http://indexer/v1/arbitration/cases/'+ARB_CASE_ID_420+'/history?chainId=420&limit=2');
 assert.equal(history.status,200);
 assert.equal((history.body as any).data.history.items.length,2);
 const invalid=await routeIndexerHttp420(api,'GET',
  'http://indexer/v1/arbitration/cases?chainId=420&limit=201');
 assert.equal(invalid.status,400);
 const unconfigured=new IndexerPublicApiAdapter420(new IndexerQueryService420(db));
 assert.equal((await routeIndexerHttp420(unconfigured,'GET',
  'http://indexer/v1/arbitration/cases?chainId=420')).status,503);
 assert.throws(()=>api.arbitrationCase(421n,ARB_CASE_ID_420),/chain does not match/);
 assert.equal((await protocolRows(db)).length,10,'API read does not change canonical projection');
});
test('reorganization rollback, safe visibility, fully deterministic replay, RPC disagreement and missing events',
 {skip:!databaseUrl,timeout:90000},async t=>{
 const {db,source,start,model,checkpoint}=await setup(t);
 await (await start()).runOnce();
 const original=await protocolRows(db);
 assert.equal(original.length,10);
 source.fork=true;
 const reorg=await model().history(ARB_CASE_ID_420);
 assert.equal(reorg.canonicality,'reorganized');
 assert.equal(reorg.case,null);
 assert.deepEqual(reorg.history.items,[]);
 const recovered=await (await start()).runOnce();
 assert.equal(recovered.recoveredReorgDepth,2);
 const replay=await protocolRows(db);
 assert.notDeepEqual(replay,original);
 assert.equal(replay.length,10);
 assert.equal((await model().case(ARB_CASE_ID_420))?.rulingHash,
  '0x'+(600).toString(16).padStart(64,'0'));
 assert.equal((await checkpoint())?.blockNumber,7n);

 // Rebuild from canonical genesis using the same shared durable consumer.
 const decoder=new ProtocolDecoderRegistry420(arbitrationDescriptorsFromManifest420(
  ARB_MANIFEST_420,ARB_ARTIFACTS_420,
  await verifyArbitrationIndexerDeployment420(source,ARB_PINS_420)));
 const projection=new CoreProjectionConsumer420(db,new ProtocolProjection420(db,decoder),420n);
 await projection.rollbackDurably(null,null);
 assert.equal((await protocolRows(db)).length,0);
 await (await start()).runOnce();
 assert.deepEqual(await protocolRows(db),replay,'full canonical rebuild differs from fork recovery');

 source.rpcDisagree=true;
 await assert.rejects(model().case(ARB_CASE_ID_420),/disagrees with canonical contract state/);
 source.rpcDisagree=false;

 // A fabricated empty eth_getLogs response cannot suppress receipt-proven events.
 // The shared Indexer may durably roll back the former canonical fork to its
 // common ancestor, but must not commit either unverified replacement block.
 source.fork=false;
 source.missingLogsAt=6;source.fork=true;
 await assert.rejects((await start()).runOnce(),/omitted canonical receipt event/);
 assert.equal((await checkpoint())?.blockNumber,5n);
 const ancestor=await protocolRows(db);
 assert.equal(ancestor.length,6,'no partial unverified replacement-block events');
 source.missingLogsAt=null;
 source.wrongReceipt=true;
 await assert.rejects((await start()).runOnce(),/RPC transaction\\/receipt canonicality disagreement|omitted canonical receipt/);
 assert.equal((await checkpoint())?.blockNumber,5n);
 assert.deepEqual(await protocolRows(db),ancestor,'RPC disagreement cannot change durable canonical ancestor');
});
