import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdmittedRuntime} from '../src/admitted-runtime.mjs';
const config=()=>({environment:'testnet',publicOrigin:'https://rideshare.example.org/',databaseUrl:'postgres://liftd_runtime:private-secret@postgres.example.org/liftd?sslmode=verify-full',databaseRole:'liftd_runtime',tlsMode:'trusted-terminator',secretProvider:'managed',identityKeyDigest:'a'.repeat(64),sessionKeyDigest:'b'.repeat(64),locationKeyDigest:'c'.repeat(64),releaseSha:'d'.repeat(40),enableDispatch:false,enablePayments:false,enablePassengerTraffic:false,limits:{requestBytes:1024,timeoutMs:3000}});
test('loopback admitted runtime liveness, readiness fail closed, routes denied, and shutdown',async()=>{
 let ready=false;const pool={connect:async()=>({release(){}})};
 const app=createAdmittedRuntime({config:config(),pool,port:0,readiness:async()=>ready?{ready:true}:{ready:false}});
 const addr=await app.start();const root='http://127.0.0.1:'+addr.port;
 try{
  assert.equal((await fetch(root+'/internal/live')).status,200);
  assert.equal((await fetch(root+'/internal/ready')).status,503);
  assert.equal((await fetch(root+'/v1/rideshare/trips')).status,404);
  ready=true;const response=await fetch(root+'/internal/ready');assert.equal(response.status,200);assert.equal((await response.json()).releaseSha,config().releaseSha);
  assert.equal((await fetch(root+'/internal/live',{method:'POST'})).status,404);
 }finally{await app.stop()}
});
test('no publicly bound health listener, live credentials or enabled passenger traffic admitted',()=>{
 const pool={connect:async()=>({release(){}})};
 assert.throws(()=>createAdmittedRuntime({config:config(),pool,host:'0.0.0.0',port:0}));
 assert.throws(()=>createAdmittedRuntime({config:{...config(),enablePassengerTraffic:true},pool,port:0}));
});
