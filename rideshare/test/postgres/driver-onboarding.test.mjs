import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createPostgresDriverOnboardingStore} from '../../src/postgres-driver-onboarding.mjs';
import {createDriverOnboardingService} from '../../src/driver-onboarding.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Isolated PostgreSQL required');
let pool,store,service;
const driver='driver_onboard_'+process.pid;
before(async()=>{
 pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,'liftd_qualification');
 await migrate(pool);store=createPostgresDriverOnboardingStore(pool);
 service=createDriverOnboardingService({store,verifyPrivateReceipt:async()=>true,clock:()=>1000,authenticator:{authorize:async(token,{action,resource})=>{
  if(token!=='signed'||action!=='onboarding.manage'||resource!=='account:'+driver)throw Error('denied');
  return{role:'driver',subject:driver,accountId:'driver_account',expiresAt:2000};
 }}});
});
after(async()=>{await pool?.end();});
const payload=(key,rev)=>({driverId:driver,vehicleId:'vehicle_1',commandId:key,expectedRevision:rev,documents:[{kind:'licence',privateRef:'vault_abc',expiresAt:5000}]});
test('persisted submissions, revision conflicts, replay and private read projection',async()=>{
 const a=await service.submit('signed',payload('command_1',0));assert.equal(a.revision,1);
 await assert.rejects(service.submit('signed',payload('command_1',1)),e=>e.code==='STALE_OR_DUPLICATE');
 const fresh=await service.submit('signed',payload('command_2',1));assert.equal(fresh.revision,2);
 await assert.rejects(service.submit('signed',payload('command_3',1)),e=>e.code==='STALE_OR_DUPLICATE');
 const view=await service.read('signed',driver);
 assert.equal(view.status,'REVIEW_REQUIRED');assert.equal(view.documents[0].kind,'licence');
 assert.equal(JSON.stringify(view).includes('vault_abc'),false);
});
test('fresh pool recovers private metadata with no public projection',async()=>{
 const independent=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 try{
 const row=await createPostgresDriverOnboardingStore(independent).read(driver);
 assert.equal(row.revision,2);assert.equal(row.documents[0].privateRef,'vault_abc');
 assert.equal((await independent.query('SELECT count(*)::int AS count FROM liftd.driver_onboarding_commands WHERE driver_id=$1',[driver])).rows[0].count,2);
 }finally{await independent.end();}
});
test('concurrent updates on one revision grant exactly one winner',async()=>{
 const rev=(await service.read('signed',driver)).revision;
 const outcome=await Promise.allSettled([service.submit('signed',payload('command_4',rev)),service.submit('signed',payload('command_5',rev))]);
 assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcome.filter(x=>x.status==='rejected'&&x.reason.code==='STALE_OR_DUPLICATE').length,1);
});
