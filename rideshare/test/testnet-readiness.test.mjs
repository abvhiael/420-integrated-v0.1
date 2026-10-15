import test from 'node:test';import assert from 'node:assert/strict';
import {buildReadinessServer,readinessPayload} from '../src/testnet-readiness-server.mjs';
test('readiness is explicitly blocked for all five external gates',()=>{
 const v=readinessPayload();assert.equal(v.dispatchEnabled,false);assert.equal(v.productionBookingEnabled,false);
 assert.equal(Object.values(v.acceptance).filter(x=>x==='NOT_ACCEPTED').length,5);
});
test('health is non-operational, readiness is 503 and all protected API paths remain absent',async()=>{
 const server=buildReadinessServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const origin='http://127.0.0.1:'+server.address().port;
 const health=await fetch(origin+'/health');assert.equal(health.status,200);
 const ready=await fetch(origin+'/readiness');assert.equal(ready.status,503);
 assert.equal((await ready.json()).paymentsEnabled,false);
 for(const route of ['/v1/rideshare/availability','/v1/rideshare/trips','/v1/rideshare/drivers/driver_x/onboarding']){
 const r=await fetch(origin+route);assert.equal(r.status,404);}
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('database readiness validates exact isolated DB and mandatory schema without exposing credentials',async()=>{
 const pool={query:async sql=>sql.includes('FROM liftd.migrations ORDER BY version')?{rows:[]}: {rows:[{db:'liftd_testnet',migrations:9}]}};
 const server=buildReadinessServer({pool});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{const res=await fetch('http://127.0.0.1:'+server.address().port+'/database');
 assert.equal(res.status,503);assert.equal(JSON.stringify(await res.json()).includes('postgres://'),false);
 }finally{await new Promise(ok=>server.close(ok));}
});
