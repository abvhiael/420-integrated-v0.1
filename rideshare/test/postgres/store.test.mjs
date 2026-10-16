import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createDatabasePool, createPostgresTripStore, migrate} from '../../src/postgres-store.mjs';
import {createTrip, transitionTrip} from '../../src/trip.mjs';
import {createTripService} from '../../src/service.mjs';
import {createHttpHandler} from '../../src/http.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL, 'Real PostgreSQL URL required; this suite must not skip');
const owner = createDatabasePool({connectionString: process.env.LIFTD_DATABASE_URL});
let pool, store, runtimeConnection; let counter = 0;
const nextId = () => `pg_${process.pid}_${++counter}`;
const guard = async () => {};
const actor = {subject: 'rider_1', role: 'rider'};
const make = id => createTrip({id, routeRef: 'route_1'}, actor);
const create = (id, commandId = nextId(), producer = async () => make(id)) => store.execute({actorId: actor.subject,
  commandId, tripId: id, action: 'create', request: {id, routeRef: 'route_1'}, guard}, producer);
const mutate = (id, commandId, action, revision, extra = {}, customGuard = guard) => store.execute({actorId: action === 'cancel' ? actor.subject : 'driver_1',
  commandId, tripId: id, action, request: {action, expectedRevision: revision, ...extra}, guard: customGuard}, async old =>
  transitionTrip(old, {action, expectedRevision: revision, ...extra}, action === 'assign' ? {subject: 'driver_1', role: 'dispatcher'} :
    action === 'cancel' ? actor : {subject: old.driverId, role: 'driver'}, {now: 100, paused: false,
      admission: {tripId: id, driverId: extra.driverId ?? old.driverId, vehicleId: extra.vehicleId ?? old.vehicleId, routeRef: 'route_1', allowed: true, expiresAt: 200}}));
before(async () => {
  const name = await owner.query('SELECT current_database() AS name');
  assert.equal(name.rows[0].name, 'liftd_qualification', 'Only isolated qualification database permitted');
  await Promise.all([migrate(owner), migrate(owner)]);
  await owner.query("CREATE ROLE liftd_runtime LOGIN PASSWORD 'liftd_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE");
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_runtime');
  await owner.query('GRANT SELECT ON liftd.migrations,liftd.trips,liftd.events,liftd.commands TO liftd_runtime');
  await owner.query('GRANT INSERT,UPDATE ON liftd.trips TO liftd_runtime');
  await owner.query('GRANT INSERT ON liftd.events,liftd.commands,liftd.operator_audit TO liftd_runtime');
  await owner.query('GRANT SELECT ON liftd.operator_audit TO liftd_runtime');
  const url = new URL(process.env.LIFTD_DATABASE_URL); url.username = 'liftd_runtime'; url.password = 'liftd_fixture';
  runtimeConnection = url.href;
  pool = createDatabasePool({connectionString: runtimeConnection}); store = createPostgresTripStore(pool);
});
after(async () => {await pool?.end(); await owner.end();});
test('ordered concurrent migrations are checksum-verified and runtime is a non-owner role', async () => {
  await migrate(owner);
  const expectedVersions = [
    '001_trip_store.sql', '002_private_locations.sql', '003_dispatch.sql',
    '004_quotes.sql', '005_payments.sql', '006_safety.sql',
    '007_rider_preferences.sql', '008_driver_onboarding.sql', '009_driver_offers.sql',
    '010_operator_audit.sql'
  ];
  const applied = (await owner.query('SELECT version,checksum FROM liftd.migrations ORDER BY version')).rows;
  assert.deepEqual(applied.map(row => row.version), expectedVersions,
    'All nine migrations must be applied once in canonical version order');
  for (const row of applied) {
    const source = readFileSync(new URL(`../../migrations/${row.version}`, import.meta.url), 'utf8');
    assert.equal(row.checksum, createHash('sha256').update(source).digest('hex'),
      `Migration checksum must match committed SQL: ${row.version}`);
  }
  const role = await pool.query('SELECT current_user AS name,rolsuper FROM pg_roles WHERE rolname=current_user');
  assert.equal(role.rows[0].rolsuper, false); assert.equal(role.rows[0].name, 'liftd_runtime');
  await assert.rejects(() => pool.query("UPDATE liftd.migrations SET checksum='bad'"), e => e.code === '42501');
  await assert.rejects(() => pool.query("UPDATE liftd.operator_audit SET result='READ'"), e => e.code === '42501');
  await assert.rejects(() => pool.query('DELETE FROM liftd.operator_audit'), e => e.code === '42501');
});
test('atomic create persists trip/event/command and exact retry returns original result', async () => {
  const id = nextId(), commandId = nextId();
  const first = await create(id, commandId); const again = await create(id, commandId);
  assert.deepEqual(first, again); assert.equal((await store.history(id)).length, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM liftd.commands WHERE trip_id=$1', [id])).rows[0].n, 1);
});
test('concurrent duplicate creates commit exactly once', async () => {
  const id = nextId(), commandId = nextId();
  const results = await Promise.all(Array.from({length: 8}, () => create(id, commandId)));
  assert.ok(results.every(t => t.revision === 0)); assert.equal((await store.history(id)).length, 1);
});
test('same key with different payload and different key with same trip reject safely', async () => {
  const id = nextId(), key = nextId(); await create(id, key);
  await assert.rejects(() => store.execute({actorId: actor.subject, commandId: key, tripId: id, action: 'create', request: {id, routeRef: 'changed'}, guard}, async () => make(id)), e => e.code === 'IDEMPOTENCY_CONFLICT');
  await assert.rejects(() => create(id), e => e.code === 'TRIP_ALREADY_EXISTS');
  assert.equal((await store.history(id)).length, 1);
});
test('concurrent revisions serialize and stale commands cannot advance twice', async () => {
  const id = nextId(); await create(id);
  const results = await Promise.allSettled([mutate(id,nextId(),'cancel',0), mutate(id,nextId(),'cancel',0)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.get(id)).revision, 1); assert.equal((await store.history(id)).length, 2);
});
test('driver and vehicle active uniqueness is database enforced and exits release capacity', async () => {
  const first = nextId(), second = nextId(); await create(first); await create(second);
  const assignment = {driverId: nextId(), vehicleId: nextId()};
  await mutate(first,nextId(),'assign',0,assignment);
  await assert.rejects(() => mutate(second,nextId(),'assign',0,assignment), e => e.code === 'UNIQUENESS_CONFLICT');
  await assert.rejects(() => mutate(second,nextId(),'assign',0,{driverId:nextId(),vehicleId:assignment.vehicleId}), e => e.code === 'UNIQUENESS_CONFLICT');
  await assert.rejects(() => mutate(second,nextId(),'assign',0,{driverId:assignment.driverId,vehicleId:nextId()}), e => e.code === 'UNIQUENESS_CONFLICT');
  assert.equal((await store.history(second)).length, 1);
  await mutate(first,nextId(),'cancel',1);
  assert.equal((await mutate(second,nextId(),'assign',0,assignment)).state, 'ASSIGNED');
  await mutate(second,nextId(),'cancel',1);
});
test('assignment race across different trips has one winner and no orphan events/commands', async () => {
  const a = nextId(), b = nextId(); await create(a); await create(b);
  const assignment = {driverId: nextId(), vehicleId: nextId()};
  const results = await Promise.allSettled([mutate(a,nextId(),'assign',0,assignment), mutate(b,nextId(),'assign',0,assignment)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
  assert.equal((await store.history(a)).length + (await store.history(b)).length,3);
  const winner = (await store.get(a)).state === 'ASSIGNED' ? a : b; await mutate(winner,nextId(),'cancel',1);
});
test('producer failure and expired authorization rollback all writes', async () => {
  const id = nextId();
  await assert.rejects(() => create(id,nextId(),async () => {throw Error('producer failure');}));
  assert.equal(await store.get(id), undefined);
  await create(id); let checks = 0;
  await assert.rejects(() => mutate(id,nextId(),'cancel',0,{},async () => {if (++checks === 3) throw Error('revoked');}));
  assert.equal((await store.get(id)).revision,0); assert.equal((await store.history(id)).length,1);
});
test('database append-only guards and immutable trip fields resist direct tampering', async () => {
  const id = nextId(); await create(id);
  await assert.rejects(() => owner.query('UPDATE liftd.events SET action=$1 WHERE trip_id=$2', ['cancel',id]), e => e.code === '23514');
  await assert.rejects(() => owner.query('DELETE FROM liftd.commands WHERE trip_id=$1', [id]), e => e.code === '23514');
  await assert.rejects(() => owner.query('DELETE FROM liftd.trips WHERE trip_id=$1', [id]), e => e.code === '23514');
  const wrong = {...await store.get(id), riderId: 'other', state: 'CANCELLED', revision: 1};
  await assert.rejects(() => owner.query('UPDATE liftd.trips SET snapshot=$1,revision=1 WHERE trip_id=$2', [wrong,id]), e => e.code === '23514');
  assert.equal((await store.history(id)).length,1);
});
test('missing command key fails before database writes', async () => {
  const id = nextId(); await assert.rejects(() => create(id, ''), e => e.code === 'INVALID_REQUEST');
  assert.equal(await store.get(id),undefined);
});
test('migration tampering fails both migration and runtime readiness', async () => {
  const original = (await owner.query('SELECT version,checksum FROM liftd.migrations ORDER BY version')).rows;
  try {
    await owner.query("UPDATE liftd.migrations SET checksum='tampered'");
    await assert.rejects(() => migrate(owner),e => e.code === 'MIGRATION_CHECKSUM_MISMATCH');
    await assert.rejects(() => store.get(nextId()),e => e.code === 'MIGRATION_CHECKSUM_MISMATCH');
  } finally {for(const row of original)await owner.query('UPDATE liftd.migrations SET checksum=$1 WHERE version=$2',[row.checksum,row.version]);}
});
test('new application process recovers committed trip and verified history', async () => {
  const id = nextId(); await create(id); await mutate(id,nextId(),'cancel',0);
  const output = await new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[new URL('./restart-worker.mjs',import.meta.url).pathname,id],{env:{...process.env,LIFTD_DATABASE_URL:runtimeConnection}});
    let stdout='',stderr=''; child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
    child.on('error',reject);child.on('exit',code=>code===0?resolve(stdout):reject(Error(stderr)));
  });
  assert.deepEqual(JSON.parse(output),{revision:1,state:'CANCELLED',events:2});
});
test('uncommitted transaction rollback leaves no trip after client disconnect', async () => {
  const id = nextId(), client = await owner.connect();
  await client.query('BEGIN'); await client.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,0,$2)',[id,make(id)]);
  client.release(true);
  assert.equal(await store.get(id),undefined);
});
test('protected HTTP mutations require durable idempotency keys and reauthorize retries', async () => {
  let revoked = false, checks=0;
  const authenticator = {async authorize() {checks++; if(revoked) throw Error('revoked'); return {subject:actor.subject,accountId:'account_1',role:'rider',expiresAt:200};}};
  const service = createTripService({authenticator,store,clock:()=>100}); const handler=createHttpHandler(service);
  const id=nextId(),key=nextId();
  const request = include => new Request('https://liftd.example/v1/rideshare/trips',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer a.b.c',...(include?{'idempotency-key':key}:{})},body:JSON.stringify({id,routeRef:'route_1',riderId:actor.subject})});
  assert.equal((await handler(request(false))).status,400);
  assert.equal((await handler(request(true))).status,201);
  assert.equal((await handler(request(true))).status,201);
  revoked=true; assert.equal((await handler(request(true))).status,503);
  assert.ok(checks>=7);assert.equal((await store.history(id)).length,1);
});
test('event-write failure rolls back an already-written trip and same key can safely retry', async () => {
  const id=nextId(),key=nextId();
  const constraint=(await owner.query("SELECT format('ALTER TABLE liftd.events ADD CONSTRAINT liftd_test_event_failure CHECK (trip_id <> %L) NOT VALID',$1::text) AS sql",[id])).rows[0].sql;
  await owner.query(constraint);
  try {
    await assert.rejects(() => create(id,key),e=>e.code==='INVALID_STORE_TRANSITION');
    assert.equal(await store.get(id),undefined);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM liftd.commands WHERE actor_id=$1 AND command_id=$2',[actor.subject,key])).rows[0].n,0);
  } finally {await owner.query('ALTER TABLE liftd.events DROP CONSTRAINT liftd_test_event_failure');}
  assert.equal((await create(id,key)).state,'REQUESTED');
  assert.equal((await store.history(id)).length,1);
});
test('complete durable trip lifecycle preserves contiguous history and releases assignment', async () => {
  const id=nextId(); await create(id);
  const assignment={driverId:nextId(),vehicleId:nextId()};
  await mutate(id,nextId(),'assign',0,assignment);
  await mutate(id,nextId(),'arrive',1);
  await mutate(id,nextId(),'start',2);
  await mutate(id,nextId(),'complete',3);
  assert.deepEqual((await store.history(id)).map(e=>e.snapshot.state),['REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED']);
  await assert.rejects(() => mutate(id,nextId(),'cancel',4),e=>e.code==='TERMINAL_TRIP');
  const other=nextId();await create(other);await mutate(other,nextId(),'assign',0,assignment);await mutate(other,nextId(),'cancel',1);
});
