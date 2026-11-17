import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { PostgresSql420 } from '../src/postgres.js';
import { createStakeIndexer420 } from '../src/stake-indexer.js';
import { SqlCheckpointStore420 } from '../src/recovery-store.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { descriptorsFromStakeRelease420 } from '../src/abi-manifest.js';
import { CoreProjectionConsumer420, type SqlExecutor420 } from '../src/core-projections.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import { artifacts, manifest, StakeSource420, validator } from './helpers/stake-recovery-fixture.js';

const databaseUrl=process.env.INDEXER_PG_URL;
class FaultDatabase420 extends PostgresSql420 {
 failCheckpoint=false;
 override async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{
  return super.transaction(tx=>work({query:async(sql,params)=>{
   if(this.failCheckpoint && sql.includes('insert into idx_checkpoints'))throw new Error('injected checkpoint persistence failure');
   return tx.query(sql,params);
  }}));
 }
}
async function rows(db:PostgresSql420,sql:string):Promise<Record<string,unknown>[]> {return (await db.query(sql) as {rows:Record<string,unknown>[]}).rows;}
const projectionSQL="select block_number::text, block_hash, tx_hash, log_index, event_name, fields from idx_protocol_events where chain_id=420 order by block_number,tx_index,log_index";

test('Stake durable SQL restart, interruption, finalized rollback and canonical reconstruction', {skip:!databaseUrl,timeout:60000}, async t=>{
 const admin=new PostgresSql420({connectionString:databaseUrl});
 await admin.query('drop schema if exists stake_recovery_9_3 cascade; create schema stake_recovery_9_3');await admin.close();
 let db=new FaultDatabase420({connectionString:databaseUrl,options:'-c search_path=stake_recovery_9_3'});
 t.after(async()=>db.close());
 for(const name of ['001-core-projections.sql','003-genesis-projections.sql','005-genesis-state-views.sql','007-durable-recovery.sql','008-finalized-recovery.sql','009-stake-lifecycle-recovery.sql']) {
  await db.query(await readFile(new URL(`../sql/${name}`,import.meta.url),'utf8'));
 }
 const source=new StakeSource420();source.head=1n;
 const ingest=()=>createStakeIndexer420(source,db,420n,manifest,artifacts,{finality:{mode:'head'}});
 await ingest().runOnce();
 const initial=await rows(db,projectionSQL);assert.equal(initial.length,1);
 // A real worker is killed while its protocol rows are uncommitted. Its SQL
 // connection dies; PostgreSQL must discard the entire transaction.
 const worker=fork(new URL('./helpers/stake-recovery-worker.js',import.meta.url),[],{env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
 let stderr='';worker.stderr!.on('data',chunk=>stderr+=String(chunk));
 try {
  const message=await Promise.race([once(worker,'message'),once(worker,'exit').then(()=>{throw new Error('worker exited before fault boundary: '+stderr);}),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('worker did not reach transaction boundary: '+stderr)),15000);timer.unref();})]);
  const pid=(message as [{pid:number}])[0].pid;assert.equal(pid,worker.pid);
  const exited=once(worker,'exit');worker.kill('SIGKILL');const [,signal]=await exited;assert.equal(signal,'SIGKILL');
  console.log(JSON.stringify({scenario:'Stake transaction process interruption',pid,signal,checkpoint:'1',database:'PostgreSQL'}));
 } finally {if(worker.exitCode===null && worker.signalCode===null)worker.kill('SIGKILL');}
 assert.deepEqual(await rows(db,projectionSQL),initial);
 assert.equal((await new SqlCheckpointStore420(db,420n).load())!.blockNumber,1n);
 source.head=3n;
 db.failCheckpoint=true;
 await assert.rejects(ingest().runOnce(),/checkpoint persistence failure/);
 assert.deepEqual(await rows(db,projectionSQL),initial,'decoded lifecycle and raw rows rolled back with failed checkpoint');
 assert.equal((await rows(db,'select * from idx_blocks where block_number>1')).length,0);
 db.failCheckpoint=false;
 source.failLogs=true;await assert.rejects(ingest().runOnce(),/interrupted RPC/);source.failLogs=false;
 await ingest().runOnce();
 const original=await rows(db,projectionSQL);assert.equal(original.length,3,'duplicate logs suppressed');
 assert.equal((await rows(db,'select lifecycle_state from idx_stake_state'))[0].lifecycle_state,'FAILED');
 for(let i=0;i<3;i++) {
  await db.close();db=new FaultDatabase420({connectionString:databaseUrl,options:'-c search_path=stake_recovery_9_3'});
  assert.equal((await ingest().runOnce()).processed,0);
  assert.deepEqual(await rows(db,projectionSQL),original);
 }
 // Equal-height canonical replacement retracts active/slash observations and
 // rebuilds the lifecycle from the retained registration + replacement events.
 source.fork=true;
 db.failCheckpoint=true;
 await assert.rejects(ingest().runOnce(),/checkpoint persistence failure/);
 assert.deepEqual(await rows(db,projectionSQL),original,'failed rollback metadata commit restored orphan rows and original checkpoint atomically');
 db.failCheckpoint=false;
 await assert.rejects(createStakeIndexer420(source,db,420n,manifest,artifacts,{finality:{mode:'head'},maxReorgDepth:1}).runOnce(),/max depth/);
 assert.deepEqual(await rows(db,projectionSQL),original,'over-depth rollback made no destructive changes');
 await db.query("insert into idx_blocks values (421,2,'other-chain','parent',0)");
 const recovered=await ingest().runOnce();assert.equal(recovered.recoveredReorgDepth,2);
 assert.equal((await rows(db,'select * from idx_blocks where chain_id=421')).length,1,'Stake rollback crossed chain scope');
 const replaced=await rows(db,projectionSQL);assert.notDeepEqual(replaced,original);
 assert.equal((await rows(db,'select lifecycle_state from idx_stake_state'))[0].lifecycle_state,'PENDING');
 const registry=new ProtocolDecoderRegistry420(descriptorsFromStakeRelease420(manifest,artifacts));
 const decoded=[];for(let n=1n;n<=3n;n++)decoded.push(registry.decode((await source.getLogs({fromBlock:n,toBlock:n}))[0])!);
 const reduced=reduceProtocolLifecycle420(decoded)[0];
 const sqlState=(await rows(db,'select object_key,lifecycle_state,event_name from idx_stake_state'))[0];
 assert.equal(sqlState.object_key,'validatorId:'+validator);assert.equal(sqlState.lifecycle_state,reduced.state);assert.equal(sqlState.event_name,reduced.eventName);
 const cpBefore=await new SqlCheckpointStore420(db,420n).load();
 source.finalizedFork=true;await assert.rejects(ingest().runOnce(),/finalized history/);source.finalizedFork=false;
 assert.deepEqual(await rows(db,projectionSQL),replaced);assert.deepEqual(await new SqlCheckpointStore420(db,420n).load(),cpBefore);
 source.finalized=0n;await assert.rejects(ingest().runOnce(),/finalized boundary regressed/);source.finalized=1n;
 // Direct durable rollback is also guarded, independently of the ingestor.
 const consumer=new CoreProjectionConsumer420(db,new ProtocolProjection420(db,registry),420n);
 await assert.rejects(consumer.rollbackDurably(0n,null),/finalized history/);
 source.head=4n;source.mixed=true;await assert.rejects(ingest().runOnce(),/mixed canonical block bundle/);source.mixed=false;source.head=3n;
 // A clean rebuild from the same canonical history must be byte-equivalent in
 // every retained protocol field and yield the same lifecycle state.
 await db.query('truncate idx_protocol_events,idx_logs,idx_receipts,idx_transactions,idx_blocks,idx_checkpoints,idx_canonical_history');
 await ingest().runOnce();assert.deepEqual(await rows(db,projectionSQL),replaced);
 assert.deepEqual((await rows(db,'select object_key,lifecycle_state,event_name from idx_stake_state'))[0],sqlState);
 console.log(JSON.stringify({scenario:'Stake recovery/rebuild',restarts:3,reorgDepth:2,events:replaced.length,projectionMatchesCleanRebuild:true,settlementAuthority:false}));
});
