import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createPostgresRiderPreferenceStore} from '../../src/postgres-rider-preferences.mjs';
import {createRiderPreferenceService} from '../../src/rider-preferences.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Isolated PostgreSQL required; no skips');
let pool,store,service;const account='prefs_'+process.pid+'_'+Date.now();
const makeAuth=()=>async(token,{action,resource})=>
 token==='active'&&action==='account.preferences'&&resource==='account:'+account?
 {role:'rider',subject:account,accountId:account,action,resource}:null;
before(async()=>{
 pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,'liftd_qualification');
 await migrate(pool);store=createPostgresRiderPreferenceStore(pool);
 service=createRiderPreferenceService({store,authorize:makeAuth()});
});
after(async()=>{await pool?.end();});
test('real PostgreSQL writes preserve opt-in defaults, revisions, consent and privacy erase',async()=>{
 assert.equal((await service.read('active',account)).revision,0);
 const a=await service.update('active',account,{expectedRevision:0,preferences:{contactMethod:'email',tripNotifications:true}});
 assert.equal(a.revision,1);
 const fresh=await service.update('active',account,{expectedRevision:1,preferences:{marketingConsent:true,largeText:true}});
 assert.equal(fresh.revision,2);
 await assert.rejects(service.update('active',account,{expectedRevision:1,preferences:{marketingConsent:false}}),e=>e.code==='STALE_REVISION');
 assert.equal((await service.read('active',account)).preferences.marketingConsent,true);
 assert.deepEqual(await service.erase('active',account),{deleted:true});
 const erased=await service.read('active',account);
 assert.equal(erased.revision,3);assert.equal(erased.preferences.marketingConsent,false);
 assert.equal(erased.preferences.tripNotifications,false);
 await assert.rejects(service.update('active',account,{expectedRevision:0,preferences:{marketingConsent:true}}),e=>e.code==='STALE_REVISION');
});
test('concurrent compare-and-swap permits exactly one writer',async()=>{
 const current=await service.read('active',account);
 const attempts=await Promise.allSettled([
   service.update('active',account,{expectedRevision:current.revision,preferences:{largeText:true}}),
   service.update('active',account,{expectedRevision:current.revision,preferences:{reducedMotion:true}})
 ]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(attempts.filter(x=>x.status==='rejected'&&x.reason.code==='STALE_REVISION').length,1);
});
test('independent pool can recover preferences; revoked and foreign requests are denied',async()=>{
 const other=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 try{
   const persisted=await createPostgresRiderPreferenceStore(other).read(account);
   assert.equal(persisted.revision,4);
   await assert.rejects(service.read('revoked',account),e=>e.code==='FORBIDDEN');
   await assert.rejects(service.read('active','other'),e=>e.code==='FORBIDDEN');
   const count=await other.query('SELECT count(*)::int AS total FROM liftd.rider_preferences WHERE account_id=$1',[account]);
   assert.equal(count.rows[0].total,1);
 }finally{await other.end();}
});
