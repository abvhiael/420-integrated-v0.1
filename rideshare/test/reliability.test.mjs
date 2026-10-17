import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderGuard,createRecoveryQueue} from '../src/reliability.mjs';
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
