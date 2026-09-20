import test from 'node:test';
import assert from 'node:assert/strict';
import {readWithRecovery,retryDelay,recoveryKey} from '../core/reliability.js';
const account='0x'+'1'.repeat(40);
test('BG-19.13 bounded deterministic backoff',()=>{
 assert.equal(retryDelay(0),250);assert.equal(retryDelay(3),2000);
 assert.throws(()=>retryDelay(5),/invalid retry/);
});
test('BG-19.13 transient read succeeds within retry limit',async()=>{
 let calls=0;const delays=[];
 const result=await readWithRecovery({read:async()=>{if(++calls<3)throw Object.assign(new Error('offline'),{code:'NETWORK_UNAVAILABLE'});return {items:[]};},wait:async(ms)=>delays.push(ms)});
 assert.equal(result.status,'ready');assert.equal(result.attempts,3);assert.deepEqual(delays,[250,500]);
});
test('BG-19.13 refuses to retry nonretryable failure or leak exception content',async()=>{
 let calls=0;const result=await readWithRecovery({read:async()=>{calls++;throw Object.assign(new Error('private message body'),{code:'ACCESS_DENIED'});}});
 assert.equal(result.status,'degraded');assert.equal(result.reason,'READ_UNAVAILABLE');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/private message/);
});
test('BG-19.13 never publishes response after route, account or session changed',async()=>{
 let current=true;const result=await readWithRecovery({read:async()=>{current=false;return {secret:'stale'};},isCurrent:()=>current});
 assert.equal(result.status,'stale');assert.equal(result.value,null);
 const first=recoveryKey({route:'/games',account,chainId:'0x66a44',sessionEpoch:1});
 const second=recoveryKey({route:'/games',account,chainId:'0x66a44',sessionEpoch:2});
 assert.notEqual(first,second);assert.throws(()=>recoveryKey({route:'https://evil.example',account,chainId:'0x66a44',sessionEpoch:1}));
});
test('BG-19.13 exhausted read retries degrade with fixed reason',async()=>{
 let calls=0;const result=await readWithRecovery({read:async()=>{calls++;throw Object.assign(new Error('offline'),{code:'SERVICE_UNAVAILABLE'});},wait:async()=>{},maxRetries:2});
 assert.equal(result.status,'degraded');assert.equal(calls,3);
});
test('BG-19.13 aborted read never displays stale result',async()=>{
 const controller=new AbortController();const result=await readWithRecovery({signal:controller.signal,read:async()=>{controller.abort();return 'stale';}});
 assert.equal(result.status,'stale');assert.equal(result.value,null);
});
