import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderGuard,createRecoveryQueue,createRecoveryWorker} from '../src/reliability.mjs';
test('provider guard times out, opens circuit, then safely recovers',async()=>{
 let now=100, calls=0;
 const guard=createProviderGuard(async(_input,signal)=>{calls++;if(calls<=2)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));return 'ok'}, {timeoutMs:10,failures:2,cooldownMs:100,clock:()=>now});
 await assert.rejects(()=>guard('a'));
 await assert.rejects(()=>guard('a'));
 await assert.rejects(()=>guard('a'),e=>e.code==='PROVIDER_CIRCUIT_OPEN');
 assert.equal(calls,2);now+=101;assert.equal(await guard('a'),'ok');
});
test('invalid queue/worker configuration rejected before database access',async()=>{
 assert.throws(()=>createRecoveryQueue({connect:()=>{}},{leaseSeconds:0}));
 const queue=createRecoveryQueue({connect:()=>{}});
 await assert.rejects(()=>queue.claim('../worker'),e=>e.code==='QUEUE_WORKER_INVALID');
 await assert.rejects(()=>queue.enqueue({jobId:'a',subjectId:'b',kind:'admin_override'}),e=>e.code==='QUEUE_REQUEST_INVALID');
});

test('admitted worker invokes only allowlisted handler and acknowledges fenced completion',async()=>{
 let done=null,observed=null;
 const queue={claim:async()=>({job_id:'j1',kind:'availability_sweep',subject_id:'driver_1',payload:{action:'check'},lease_token:'a'.repeat(32)}),finish:async result=>{done=result;return result.ok?'complete':'queued'}};
 const handlers={dispatch_reconcile:async()=>{},availability_sweep:async job=>{observed=job},provider_recheck:async()=>{}};
 const worker=createRecoveryWorker(queue,{workerId:'worker_1',handlers});
 assert.deepEqual(await worker.runOnce(),{jobId:'j1',state:'complete'});
 assert.equal(observed.subjectId,'driver_1');assert.equal(done.ok,true);assert.equal(done.workerId,'worker_1');
 assert.throws(()=>createRecoveryWorker(queue,{workerId:'worker_1',handlers:{availability_sweep:()=>{}}}),e=>e.code==='RECOVERY_WORKER_CONFIGURATION_INVALID');
});
test('failed worker operation persists bounded retry and does not acknowledge success',async()=>{
 let finished;
 const queue={claim:async()=>({job_id:'j2',kind:'provider_recheck',subject_id:'trip_2',payload:{},lease_token:'b'.repeat(32)}),finish:async args=>{finished=args;return 'queued'}};
 const handlers={dispatch_reconcile:async()=>{},availability_sweep:async()=>{},provider_recheck:async()=>{throw Object.assign(Error('offline'),{code:'PROVIDER_UNAVAILABLE'})}};
 const result=await createRecoveryWorker(queue,{workerId:'worker_2',handlers}).runOnce();
 assert.deepEqual(result,{jobId:'j2',state:'queued'});assert.equal(finished.ok,false);assert.equal(finished.errorCode,'PROVIDER_UNAVAILABLE');
});
