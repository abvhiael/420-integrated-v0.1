import test,{before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {fixture,generateRoots} from './dispatch-fixture.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real PostgreSQL mandatory');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL}),pairs=generateRoots(),controls={now:100,encryptionKey:Buffer.alloc(32,7).toString('base64')};
let pool,app,url;const temporary=mkdtempSync(join(tmpdir(),'liftd-dispatch-'));
const match=(trip,key)=>app.transition('operator','operator_dispatch',trip,'match',0,key);
const cancel=async trip=>{const t=await app.tripStore.get(trip);return app.transition('rider','rider_dispatch',trip,'cancel',t.revision);};
before(async()=>{
  assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name,'liftd_qualification');await migrate(owner);
  await owner.query("CREATE ROLE liftd_dispatch_runtime LOGIN PASSWORD 'dispatch_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE");
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_dispatch_runtime');
  await owner.query('GRANT SELECT ON ALL TABLES IN SCHEMA liftd TO liftd_dispatch_runtime');
  await owner.query('GRANT INSERT,UPDATE ON liftd.trips,liftd.private_locations,liftd.driver_availability,liftd.assignment_leases TO liftd_dispatch_runtime');
  await owner.query('GRANT INSERT ON liftd.events,liftd.commands,liftd.availability_commands TO liftd_dispatch_runtime');
  const connection=new URL(process.env.LIFTD_DATABASE_URL);connection.username='liftd_dispatch_runtime';connection.password='dispatch_fixture';url=connection.href;
  pool=createDatabasePool({connectionString:url});app=fixture(pool,pairs,controls);
});
afterEach(async()=>{
  controls.now=100;controls.paused=false;controls.revokedDrivers=[];controls.revokedSessions=[];controls.suspendedDrivers=[];controls.capacities={};controls.outage=undefined;
  for(const t of (await pool.query("SELECT snapshot FROM liftd.trips WHERE trip_id LIKE 'dispatch_%' AND state IN ('ASSIGNED','ARRIVED','IN_PROGRESS')")).rows.map(r=>r.snapshot)) {
    if(t.state==='IN_PROGRESS')await app.transition('driver',t.driverId,t.id,'complete',t.revision);else await cancel(t.id);
  }
  for(const row of (await pool.query('SELECT driver_id,vehicle_id FROM liftd.driver_availability WHERE online')).rows)await app.online(row.driver_id,row.vehicle_id,false);
});
after(async()=>{rmSync(temporary,{recursive:true,force:true});await pool?.end();await owner.end();});
test('authenticated availability is own-account, CAS/idempotent, bounded and protected over HTTP',async()=>{
  const input={driverId:'driver_a',vehicleId:'vehicle_a',online:true,expectedRevision:0,commandId:app.cid()},token=app.token('driver','driver_a');
  const first=await app.dispatchAdapter.setAvailability(token,input);assert.equal(first.expiresAt,220);
  assert.deepEqual(await app.dispatchAdapter.setAvailability(token,input),first);
  await assert.rejects(()=>app.dispatchAdapter.setAvailability(token,{...input,online:false}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  await assert.rejects(()=>app.dispatchAdapter.setAvailability(app.token('driver','driver_other'),{...input,commandId:app.cid()}),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>app.dispatchAdapter.setAvailability(app.token('rider','rider_dispatch'),{...input,commandId:app.cid()}));
  const response=await app.handler(new Request('https://liftd.example/v1/rideshare/availability',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({...input,commandId:app.cid(),expectedRevision:1,online:false})}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).online,false);
});
test('matching is deterministic and uses independently verified capacity, transport and driver session',async()=>{
  controls.capacities={vehicle_a:1};controls.revokedDrivers=['driver_b'];
  for(const d of ['a','b','c','d'])await app.online(`driver_${d}`,`vehicle_${d}`);
  controls.revokedSessions=['driver_c'];
  await app.create('dispatch_rank',2);await match('dispatch_rank');
  assert.equal((await app.tripStore.get('dispatch_rank')).driverId,'driver_d');
  await assert.rejects(()=>app.service.transition(app.token('operator','operator_dispatch','dispatch_rank'),'dispatch_rank',{action:'assign',expectedRevision:1,driverId:'driver_b',vehicleId:'vehicle_b',commandId:app.cid()}),e=>e.code==='SERVER_MATCH_REQUIRED');
});
test('two independent processes racing for one available driver commit exactly one assignment',async()=>{
  await app.online('driver_race','vehicle_race');await app.create('dispatch_race_a');await app.create('dispatch_race_b');
  const path=join(temporary,'worker.json');writeFileSync(path,JSON.stringify({url,pairs,controls}),{mode:0o600});
  const worker=trip=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['rideshare/test/postgres/dispatch-worker.mjs',path,trip,app.cid()],{stdio:['ignore','pipe','pipe']});let output='',error='';
    child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>error+=v);child.on('error',reject);child.on('close',code=>code?reject(Error(error)):resolve(JSON.parse(output)));
  });
  const results=await Promise.all([worker('dispatch_race_a'),worker('dispatch_race_b')]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).code,'NO_ELIGIBLE_DRIVER');
  assert.equal((await pool.query("SELECT count(*)::int n FROM liftd.assignment_leases WHERE trip_id IN ('dispatch_race_a','dispatch_race_b')")).rows[0].n,1);
  assert.equal((await app.tripStore.history('dispatch_race_a')).length+(await app.tripStore.history('dispatch_race_b')).length,3);
});
test('simultaneous same-command dispatch retries persist one lease/event and stale revisions fail',async()=>{
  await app.online('driver_retry','vehicle_retry');await app.create('dispatch_retry');const key=app.cid();
  const results=await Promise.all(Array.from({length:6},()=>match('dispatch_retry',key)));assert.ok(results.every(r=>r.revision===1));
  assert.equal((await app.tripStore.history('dispatch_retry')).length,2);
  await assert.rejects(()=>match('dispatch_retry'),e=>['INVALID_TRANSITION','STALE_REVISION'].includes(e.code));
  await assert.rejects(()=>app.service.transition(app.token('operator','operator_dispatch','dispatch_retry'),'dispatch_retry',{action:'match',expectedRevision:1,commandId:key}),e=>e.code==='IDEMPOTENCY_CONFLICT');
});
test('expired assignment cannot arrive; operator expiry works while paused and releases capacity atomically',async()=>{
  await app.online('driver_expiry','vehicle_expiry');await app.create('dispatch_expiry');const key=app.cid();await match('dispatch_expiry',key);
  await assert.rejects(()=>app.transition('operator','operator_dispatch','dispatch_expiry','expire',1),e=>e.code==='ASSIGNMENT_NOT_EXPIRED');
  controls.now=130;
  await assert.rejects(()=>app.transition('driver','driver_expiry','dispatch_expiry','arrive',1),e=>e.code==='ASSIGNMENT_EXPIRED');
  controls.paused=true;
  await app.transition('operator','operator_dispatch','dispatch_expiry','expire',1);
  assert.equal((await app.tripStore.get('dispatch_expiry')).state,'CANCELLED');
  assert.equal((await pool.query("SELECT state FROM liftd.assignment_leases WHERE trip_id='dispatch_expiry'")).rows[0].state,'CLOSED');
  controls.paused=false;await match('dispatch_expiry',key);assert.equal((await app.tripStore.get('dispatch_expiry')).state,'CANCELLED');
  await app.create('dispatch_released');await match('dispatch_released');
  assert.equal((await app.tripStore.get('dispatch_released')).driverId,'driver_expiry');
});
test('arrival accepts before timeout; offline preserves assigned trip and later start/completion remain valid',async()=>{
  await app.online('driver_accepted','vehicle_accepted');await app.create('dispatch_accepted');await match('dispatch_accepted');
  await app.online('driver_accepted','vehicle_accepted',false);
  controls.now=129;await app.transition('driver','driver_accepted','dispatch_accepted','arrive',1);
  controls.now=160;
  await assert.rejects(()=>app.transition('operator','operator_dispatch','dispatch_accepted','expire',2),e=>e.code==='ASSIGNMENT_NOT_EXPIRED');
  await app.transition('driver','driver_accepted','dispatch_accepted','start',2);controls.paused=true;
  await app.transition('driver','driver_accepted','dispatch_accepted','complete',3);
  assert.equal((await pool.query("SELECT state FROM liftd.assignment_leases WHERE trip_id='dispatch_accepted'")).rows[0].state,'CLOSED');
});
test('capacity and transport are rechecked after dispatch; revocation blocks arrival/start but preserves cancellation',async()=>{
  await app.online('driver_capacity','vehicle_capacity');await app.create('dispatch_capacity',3);await match('dispatch_capacity');
  controls.capacities={vehicle_capacity:2};
  await assert.rejects(()=>app.transition('driver','driver_capacity','dispatch_capacity','arrive',1),e=>e.code==='VEHICLE_INELIGIBLE');
  controls.capacities={};await app.transition('driver','driver_capacity','dispatch_capacity','arrive',1);
  controls.revokedDrivers=['driver_capacity'];
  await assert.rejects(()=>app.transition('driver','driver_capacity','dispatch_capacity','start',2),e=>e.code==='TRANSPORT_INELIGIBLE');
  controls.paused=true;await cancel('dispatch_capacity');
});
test('event insertion failure rolls back lease/trip/command; unchanged command can retry',async()=>{
  await app.online('driver_rollback','vehicle_rollback');await app.create('dispatch_rollback');const key=app.cid();
  await owner.query("ALTER TABLE liftd.events ADD CONSTRAINT dispatch_test_failure CHECK(trip_id<>'dispatch_rollback' OR action<>'assign')");
  try{await assert.rejects(()=>match('dispatch_rollback',key));}finally{await owner.query('ALTER TABLE liftd.events DROP CONSTRAINT dispatch_test_failure');}
  assert.equal((await app.tripStore.get('dispatch_rollback')).state,'REQUESTED');
  assert.equal((await pool.query("SELECT count(*)::int n FROM liftd.assignment_leases WHERE trip_id='dispatch_rollback'")).rows[0].n,0);
  assert.equal((await app.tripStore.history('dispatch_rollback')).length,1);await match('dispatch_rollback',key);
});
test('stale presence, missing authorities and pause deny matching without state writes',async()=>{
  await app.online('driver_stale','vehicle_stale');await app.create('dispatch_stale');controls.now=220;
  await assert.rejects(()=>match('dispatch_stale'),e=>e.code==='NO_ELIGIBLE_DRIVER');
  controls.now=100;controls.outage=3;
  await assert.rejects(()=>match('dispatch_stale'),e=>e.code==='REGISTRY_AUTHORITY_UNAVAILABLE');
  controls.outage=undefined;controls.paused=true;
  await assert.rejects(()=>match('dispatch_stale'),e=>e.code==='SERVICE_PAUSED');
  await app.online('driver_stale','vehicle_stale',false);
  await assert.rejects(()=>app.online('driver_stale','vehicle_stale',true),e=>e.code==='SERVICE_PAUSED');
  assert.equal((await app.tripStore.history('dispatch_stale')).length,1);
});
test('availability races have one CAS winner; busy vehicle changes and direct ledger/lease tampering fail',async()=>{
  const first=await app.online('driver_guard','vehicle_guard');const token=app.token('driver','driver_guard');
  const results=await Promise.allSettled([true,false].map(online=>app.dispatchAdapter.setAvailability(token,{driverId:'driver_guard',vehicleId:'vehicle_guard',expectedRevision:first.revision,online,commandId:app.cid()})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'STALE_REVISION');
  await app.online('driver_guard','vehicle_guard');await app.create('dispatch_guard');await match('dispatch_guard');
  await assert.rejects(()=>app.online('driver_guard','vehicle_other'),e=>e.code==='DRIVER_BUSY');
  await assert.rejects(()=>owner.query("UPDATE liftd.assignment_leases SET expires_at=9999 WHERE trip_id='dispatch_guard'"),e=>e.code==='23514');
  await assert.rejects(()=>owner.query("DELETE FROM liftd.assignment_leases WHERE trip_id='dispatch_guard'"),e=>e.code==='23514');
  await assert.rejects(()=>owner.query("UPDATE liftd.availability_commands SET result='{}' WHERE driver_id='driver_guard'"),e=>e.code==='23514');
  await assert.rejects(()=>owner.query("UPDATE liftd.driver_availability SET account_id='other',revision=revision+1 WHERE driver_id='driver_guard'"),e=>e.code==='23514');
  await cancel('dispatch_guard');
  await assert.rejects(()=>owner.query("UPDATE liftd.assignment_leases SET state='PENDING' WHERE trip_id='dispatch_guard'"),e=>e.code==='23514');
});
