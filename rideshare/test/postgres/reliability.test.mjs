import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createRecoveryQueue} from '../../src/reliability.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'real isolated PostgreSQL required');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
let worker,queue;
before(async()=>{
 const db=await owner.query('SELECT current_database() AS name');
 assert.equal(db.rows[0].name,'liftd_qualification');
 await migrate(owner);
 await owner.query("CREATE ROLE liftd_recovery_worker LOGIN PASSWORD 'worker_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION");
 await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_recovery_worker');
 await owner.query('GRANT SELECT,INSERT,UPDATE ON liftd.recovery_jobs TO liftd_recovery_worker');
 const url=new URL(process.env.LIFTD_DATABASE_URL);url.username='liftd_recovery_worker';url.password='worker_fixture';
 worker=createDatabasePool({connectionString:url.href});queue=createRecoveryQueue(worker,{leaseSeconds:5,maxAttempts:2});
});
after(async()=>{await worker?.end();await owner.end()});
test('two isolated worker connections claim one job exactly once; token fences completion',async()=>{
 await queue.enqueue({jobId:'recovery_parallel',kind:'availability_sweep',subjectId:'driver_parallel'});
 await queue.enqueue({jobId:'recovery_parallel',kind:'availability_sweep',subjectId:'driver_parallel'});
 await assert.rejects(()=>queue.enqueue({jobId:'recovery_parallel',kind:'provider_recheck',subjectId:'driver_parallel'}),e=>e.code==='QUEUE_IDEMPOTENCY_CONFLICT');
 const claims=await Promise.all([queue.claim('worker_a'),queue.claim('worker_b')]);
 assert.equal(claims.filter(Boolean).length,1);
 const job=claims.find(Boolean);
 await assert.rejects(()=>queue.finish({jobId:job.job_id,workerId:'worker_bogus',token:job.lease_token,ok:true}),e=>e.code==='QUEUE_STALE_LEASE');
 assert.equal(await queue.finish({jobId:job.job_id,workerId:claims[0]?'worker_a':'worker_b',token:job.lease_token,ok:true}),'complete');
 assert.equal(await queue.claim('worker_c'),null);
 await assert.rejects(()=>worker.query('DELETE FROM liftd.trips'),e=>e.code==='42501');
});
test('worker crash lease expiry is recovered once and prior token cannot commit',async()=>{
 await queue.enqueue({jobId:'recovery_crash',kind:'provider_recheck',subjectId:'driver_crash'});
 const first=await queue.claim('worker_crash');
 await owner.query("UPDATE liftd.recovery_jobs SET lease_until=now()-interval '1 second' WHERE job_id='recovery_crash'");
 const claimed=await queue.claim('worker_recovery');
 assert.equal(claimed.job_id,'recovery_crash');
 assert.equal(claimed.attempts,2);
 await assert.rejects(()=>queue.finish({jobId:first.job_id,workerId:'worker_crash',token:first.lease_token,ok:true}),e=>e.code==='QUEUE_STALE_LEASE');
 assert.equal(await queue.finish({jobId:claimed.job_id,workerId:'worker_recovery',token:claimed.lease_token,ok:false}),'dead');
 assert.equal(await queue.claim('worker_later'),null);
});
test('bounded parallel claim load has no duplicate admission',async()=>{
 for(let n=0;n<30;n++)await queue.enqueue({jobId:'load_'+n,kind:'dispatch_reconcile',subjectId:'trip_load_'+n});
 const claims=await Promise.all(Array.from({length:50},(_,i)=>queue.claim('load_worker_'+i)));
 const admitted=claims.filter(Boolean);assert.equal(admitted.length,30);
 assert.equal(new Set(admitted.map(x=>x.job_id)).size,30);
 await Promise.all(admitted.map(async (x,i)=>queue.finish({jobId:x.job_id,workerId:'load_worker_'+claims.indexOf(x),token:x.lease_token,ok:true})));
 assert.equal((await owner.query("SELECT count(*)::int n FROM liftd.recovery_jobs WHERE state='complete' AND job_id LIKE 'load_%'")).rows[0].n,30);
});

test('repeated worker crashes reach dead-letter without a third lease',async()=>{
 await queue.enqueue({jobId:'recovery_dead_crash',kind:'provider_recheck',subjectId:'driver_dead'});
 const first=await queue.claim('worker_dead1');assert.equal(first.attempts,1);
 await owner.query("UPDATE liftd.recovery_jobs SET lease_until=now()-interval '1 second' WHERE job_id='recovery_dead_crash'");
 const second=await queue.claim('worker_dead2');assert.equal(second.attempts,2);
 await owner.query("UPDATE liftd.recovery_jobs SET lease_until=now()-interval '1 second' WHERE job_id='recovery_dead_crash'");
 assert.equal(await queue.claim('worker_dead3'),null);
 const state=(await owner.query("SELECT state,lease_token,attempts FROM liftd.recovery_jobs WHERE job_id='recovery_dead_crash'")).rows[0];
 assert.equal(state.state,'dead');assert.equal(state.lease_token,null);assert.equal(state.attempts,2);
});
