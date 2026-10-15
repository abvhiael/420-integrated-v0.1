import test,{before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {generateRoots} from './dispatch-fixture.mjs';
import {quoteFixture} from './quote-fixture.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real PostgreSQL mandatory');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL}),pairs=[...generateRoots(),...generateRoots().slice(0,3)],controls={now:100,quotes:true,encryptionKey:Buffer.alloc(32,9).toString('base64')};
let pool,app;
before(async()=>{
  assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name,'liftd_qualification');await migrate(owner);
  await owner.query("CREATE ROLE liftd_quote_runtime LOGIN PASSWORD 'quote_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE");
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_quote_runtime');await owner.query('GRANT SELECT ON ALL TABLES IN SCHEMA liftd TO liftd_quote_runtime');
  await owner.query('GRANT INSERT,UPDATE ON liftd.trips,liftd.private_locations,liftd.driver_availability,liftd.assignment_leases TO liftd_quote_runtime');
  await owner.query('GRANT INSERT ON liftd.events,liftd.commands,liftd.availability_commands,liftd.fare_quotes,liftd.quote_consents,liftd.quote_commands,liftd.trip_quotes,liftd.trip_viability,liftd.cancellation_assessments,liftd.subsidy_bindings TO liftd_quote_runtime');
  const url=new URL(process.env.LIFTD_DATABASE_URL);url.username='liftd_quote_runtime';url.password='quote_fixture';pool=createDatabasePool({connectionString:url.href});app=quoteFixture(pool,pairs,controls);
});
afterEach(async()=>{
  for(const key of Object.keys(controls))if(!['now','quotes','encryptionKey'].includes(key))delete controls[key];controls.now=100;
  for(const t of (await pool.query("SELECT snapshot FROM liftd.trips WHERE trip_id LIKE 'fare_%' AND state IN ('ASSIGNED','ARRIVED','IN_PROGRESS')")).rows.map(r=>r.snapshot)) {
    if(t.state==='IN_PROGRESS')await app.transition('driver',t.driverId,t.id,'complete',t.revision);else await app.transition('rider','rider_fare',t.id,'cancel',t.revision);
  }
  for(const row of (await pool.query('SELECT driver_id,vehicle_id FROM liftd.driver_availability WHERE online')).rows)await app.online(row.driver_id,row.vehicle_id,false);
});
after(async()=>{await pool?.end();await owner.end();});
test('actual signed fare/Location/session adapters issue immutable CAD quotes with separately disclosed charges',async()=>{
  controls.minimumFareCents=1200;controls.taxes=[{code:'tax',amountCents:60}];controls.passThrough=[{code:'trip',amountCents:25}];
  const {token,quote}=await app.prepare('fare_quote');assert.equal(quote.amounts.transportationCents,1200);assert.equal(quote.amounts.totalCents,1285);assert.equal(quote.expiresAt,130);
  assert.equal(quote.cancellationPolicy.preTripRiderFeeCents,0);assert.equal(JSON.stringify(quote).includes('49.282731'),false);
  assert.deepEqual(await app.quoteService.get(token,quote.quoteId),quote);
  await assert.rejects(()=>owner.query('UPDATE liftd.fare_quotes SET expires_at=9999 WHERE quote_id=$1',[quote.quoteId]),e=>e.code==='23514');
  await assert.rejects(()=>owner.query('DELETE FROM liftd.fare_quotes WHERE quote_id=$1',[quote.quoteId]),e=>e.code==='23514');
});
test('consent must bind the exact owner account, hash, CAD price and affirmative choice',async()=>{
  const {token,quote}=await app.prepare('fare_consent');
  for(const patch of [{accepted:false},{currency:'USD'},{totalCents:quote.amounts.totalCents+1},{quoteHash:'a'.repeat(64)},{riderId:'rider_other'}])await assert.rejects(()=>app.consent(token,quote,patch));
  await assert.rejects(()=>app.consent(app.token('rider','rider_other','fare_consent'),quote,{riderId:'rider_other'}),e=>e.code==='QUOTE_SCOPE_DENIED');
  const result=await app.consent(token,quote);assert.equal(result.accepted,true);
  await assert.rejects(()=>owner.query('UPDATE liftd.quote_consents SET accepted_at=999 WHERE quote_id=$1',[quote.quoteId]),e=>e.code==='23514');
});
test('trip creation requires live accepted quote; absence, cross-route and quote reuse rollback all trip writes',async()=>{
  const a=await app.prepare('fare_bind');const input={id:'fare_bind',riderId:'rider_fare',routeRef:a.route.routeRef,quoteId:a.quote.quoteId,commandId:app.cid()};
  await assert.rejects(()=>app.service.create(a.token,input),e=>e.code==='EXPLICIT_CONSENT_REQUIRED');assert.equal(await app.tripStore.get('fare_bind'),undefined);
  await app.consent(a.token,a.quote);await app.service.create(a.token,input);
  const b=await app.prepare('fare_bind_wrong');await app.consent(b.token,b.quote);
  await assert.rejects(()=>app.service.create(b.token,{id:'fare_bind_wrong',riderId:'rider_fare',routeRef:b.route.routeRef,quoteId:a.quote.quoteId,commandId:app.cid()}),e=>e.code==='QUOTE_SCOPE_DENIED');
  assert.equal(await app.tripStore.get('fare_bind_wrong'),undefined);
  await assert.rejects(()=>app.service.create(b.token,{id:'fare_reuse',riderId:'rider_fare',routeRef:a.route.routeRef,quoteId:a.quote.quoteId,commandId:app.cid()}));
});
test('exact quote deadline denies acceptance and binding; historical issue retries never renew expiry',async()=>{
  const {token,route,quote}=await app.prepare('fare_expired');await app.consent(token,quote);controls.now=130;
  await assert.rejects(()=>app.consent(app.token('rider','rider_fare','fare_expired'),quote),e=>e.code==='QUOTE_EXPIRED');
  await assert.rejects(()=>app.service.create(app.token('rider','rider_fare','fare_expired'),{id:'fare_expired',riderId:'rider_fare',routeRef:route.routeRef,quoteId:quote.quoteId,commandId:app.cid()}),e=>e.code==='QUOTE_EXPIRED');
  assert.equal(await app.tripStore.get('fare_expired'),undefined);
  assert.equal((await app.quoteService.get(app.token('rider','rider_fare','fare_expired'),quote.quoteId)).expiresAt,130);
});
test('parallel same-key issue/consent retries persist once; changed request cannot reuse the command',async()=>{
  const a=await app.prepare('fare_retry'),key=app.cid(),request={riderId:'rider_fare',routeRef:a.route.routeRef,commandId:key};
  const quotes=await Promise.all(Array.from({length:5},()=>app.quoteService.issue(a.token,request)));assert.ok(quotes.every(q=>q.quoteId===quotes[0].quoteId));
  const consentKey=app.cid();const results=await Promise.all(Array.from({length:5},()=>app.consent(a.token,quotes[0],{commandId:consentKey})));assert.ok(results.every(r=>r.quoteHash===quotes[0].quoteHash));
  await assert.rejects(()=>app.consent(a.token,quotes[0],{commandId:consentKey,totalCents:99}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  const row=(await pool.query('SELECT count(*)::int n FROM liftd.quote_consents WHERE quote_id=$1',[quotes[0].quoteId])).rows[0];assert.equal(row.n,1);
  controls.now=131;const retry=await app.quoteService.issue(app.token('rider','rider_fare','fare_retry'),request);assert.equal(retry.expiresAt,quotes[0].expiresAt);
});
test('long pickup cannot assign without independently reserved platform subsidy; funding revocation prevents start',async()=>{
  await app.online('driver_long','vehicle_long');await app.create('fare_long');controls.pickupMeters=50000;controls.pickupSeconds=3600;
  await assert.rejects(()=>app.transition('operator','operator_fare','fare_long','match',0),e=>e.code==='NO_ELIGIBLE_DRIVER');
  assert.equal((await app.tripStore.get('fare_long')).state,'REQUESTED');assert.equal((await pool.query("SELECT count(*)::int n FROM liftd.assignment_leases WHERE trip_id='fare_long'")).rows[0].n,0);
  controls.subsidyReserved=true;controls.subsidyCents=10000;await app.transition('operator','operator_fare','fare_long','match',0);
  const v=(await pool.query("SELECT payload FROM liftd.trip_viability WHERE trip_id='fare_long'")).rows[0].payload;assert.ok(v.requiredSubsidyCents>0);assert.equal(v.fundingRef,'funding_fare_long');
  await app.transition('driver','driver_long','fare_long','arrive',1);controls.subsidyReserved=false;
  await assert.rejects(()=>app.transition('driver','driver_long','fare_long','start',2),e=>e.code==='PICKUP_NOT_VIABLE');
  await app.transition('rider','rider_fare','fare_long','cancel',2);
  const assessment=(await pool.query("SELECT payload FROM liftd.cancellation_assessments WHERE trip_id='fare_long'")).rows[0].payload;assert.equal(assessment.riderFeeCents,0);assert.equal(assessment.driverEarnedObligations,'preserved');
});
test('accepted fare survives quote expiry and traffic estimate changes; new statutory floor blocks new risk without repricing',async()=>{
  await app.online('driver_fixed','vehicle_fixed');const {quote}=await app.create('fare_fixed');controls.now=140;controls.routeDurationSeconds=900;
  await app.transition('operator','operator_fare','fare_fixed','match',0);
  controls.minimumFareCents=quote.amounts.transportationCents+100;
  await assert.rejects(()=>app.transition('driver','driver_fixed','fare_fixed','arrive',1),e=>e.code==='QUOTE_RULES_CHANGED');
  const stored=await app.quoteService.get(app.token('rider','rider_fare','fare_fixed'),quote.quoteId);assert.equal(stored.amounts.totalCents,quote.amounts.totalCents);
  controls.minimumFareCents=1000;await app.transition('driver','driver_fixed','fare_fixed','arrive',1);await app.transition('driver','driver_fixed','fare_fixed','start',2);
  await assert.rejects(()=>app.transition('rider','rider_fare','fare_fixed','cancel',3),e=>e.code==='ACTIVE_TRIP_REQUIRES_SAFETY_RESOLUTION');
  controls.paused=true;await app.transition('driver','driver_fixed','fare_fixed','complete',3);
});
test('paused pre-trip cancellation and assignment expiry record immutable zero rider fees exactly once',async()=>{
  await app.online('driver_cancel','vehicle_cancel');await app.create('fare_cancel');await app.transition('operator','operator_fare','fare_cancel','match',0);controls.paused=true;
  const key=app.cid();await app.transition('rider','rider_fare','fare_cancel','cancel',1,key);await app.transition('rider','rider_fare','fare_cancel','cancel',1,key);
  assert.equal((await pool.query("SELECT count(*)::int n FROM liftd.cancellation_assessments WHERE trip_id='fare_cancel'")).rows[0].n,1);
  controls.paused=false;await app.create('fare_timeout');await app.transition('operator','operator_fare','fare_timeout','match',0);controls.now=130;controls.paused=true;
  await app.transition('operator','operator_fare','fare_timeout','expire',1);
  assert.equal((await pool.query("SELECT payload FROM liftd.cancellation_assessments WHERE trip_id='fare_timeout'")).rows[0].payload.riderFeeCents,0);
  await assert.rejects(()=>owner.query("UPDATE liftd.cancellation_assessments SET payload='{}' WHERE trip_id='fare_timeout'"),e=>e.code==='23514');
});
test('quote binding insertion failure rolls back already-written trip and private binding; safe same-key retry succeeds',async()=>{
  const {token,quote,route}=await app.prepare('fare_rollback');await app.consent(token,quote);
  await owner.query("ALTER TABLE liftd.trip_quotes ADD CONSTRAINT fare_test_failure CHECK(trip_id<>'fare_rollback')");
  const input={id:'fare_rollback',riderId:'rider_fare',routeRef:route.routeRef,quoteId:quote.quoteId,commandId:app.cid()};
  try{await assert.rejects(()=>app.service.create(token,input));}finally{await owner.query('ALTER TABLE liftd.trip_quotes DROP CONSTRAINT fare_test_failure');}
  assert.equal(await app.tripStore.get('fare_rollback'),undefined);
  assert.equal((await pool.query('SELECT trip_id FROM liftd.private_locations WHERE route_ref=$1',[route.routeRef])).rows[0].trip_id,null);await app.service.create(token,input);
});
test('signed rule/provider outages, forged bindings and session revocation fail closed',async()=>{
  controls.outage=6;await assert.rejects(()=>app.prepare('fare_outage'),e=>e.code==='FARE_RULES_UNAVAILABLE');controls.outage=undefined;
  controls.rulesPatch={currency:'USD'};await assert.rejects(()=>app.prepare('fare_currency'),e=>e.code==='INVALID_FARE_RULES');controls.rulesPatch={};
  const a=await app.prepare('fare_revoked');controls.revokedSessions=['rider_fare'];await assert.rejects(()=>app.consent(a.token,a.quote),e=>e.code==='SESSION_REVOKED');
});
test('protected HTTP exposes quotes/consent only to owner and preserves no-store and explicit-price checks',async()=>{
  const {token,quote}=await app.prepare('fare_http');
  const read=await app.handler(new Request(`https://liftd.example/v1/rideshare/quotes/${quote.quoteId}`,{headers:{authorization:`Bearer ${token}`}}));assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');
  const body={riderId:'rider_fare',commandId:app.cid(),quoteHash:quote.quoteHash,currency:'CAD',totalCents:quote.amounts.totalCents,accepted:true};
  const response=await app.handler(new Request(`https://liftd.example/v1/rideshare/quotes/${quote.quoteId}/consent`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,200);
  const anonymous=await app.handler(new Request(`https://liftd.example/v1/rideshare/quotes/${quote.quoteId}`));assert.equal(anonymous.status,401);
  const foreign=await app.handler(new Request(`https://liftd.example/v1/rideshare/quotes/${quote.quoteId}`,{headers:{authorization:`Bearer ${app.token('rider','rider_other')}`}}));assert.equal(foreign.status,403);
});

test('new fare-rule changes deny consent and a funded reservation cannot be replayed for another trip',async()=>{
  const stale=await app.prepare('fare_stale_rules');controls.minimumFareCents=stale.quote.amounts.transportationCents+1;
  await assert.rejects(()=>app.consent(stale.token,stale.quote),e=>e.code==='QUOTE_RULES_CHANGED');controls.minimumFareCents=1000;
  await app.online('driver_fund_a','vehicle_fund_a');await app.online('driver_fund_b','vehicle_fund_b');
  await app.create('fare_fund_a');await app.create('fare_fund_b');
  controls.pickupMeters=50000;controls.pickupSeconds=3600;controls.subsidyReserved=true;controls.subsidyCents=10000;controls.subsidyPatch={fundingRef:'same_reservation'};
  await app.transition('operator','operator_fare','fare_fund_a','match',0);
  await assert.rejects(()=>app.transition('operator','operator_fare','fare_fund_b','match',0),e=>e.code==='FUNDING_REPLAY');
  assert.equal((await app.tripStore.get('fare_fund_b')).state,'REQUESTED');assert.equal((await app.tripStore.history('fare_fund_b')).length,1);
});

test('deterministic dispatch skips an unfunded long-pickup candidate and selects the next viable driver',async()=>{
  await app.online('driver_a_long','vehicle_a_long');await app.online('driver_z_short','vehicle_z_short');await app.create('fare_candidate');
  controls.pickupByDriver={driver_a_long:{meters:50000,seconds:3600}};
  await app.transition('operator','operator_fare','fare_candidate','match',0);
  assert.equal((await app.tripStore.get('fare_candidate')).driverId,'driver_z_short');
  assert.equal((await pool.query("SELECT payload FROM liftd.trip_viability WHERE trip_id='fare_candidate'")).rows[0].payload.requiredSubsidyCents,0);
});

test('new signed session for the same rider under another account cannot read or accept the original quote',async()=>{
  const {quote}=await app.prepare('fare_account_change');
  const credential=app.jwt(0,{sub:'rider_fare',purpose:'liftd_access',accountId:'other_account',sessionId:'fare_account_change',deviceId:'other_device',recoveryEpoch:0});
  await assert.rejects(()=>app.quoteService.get(credential,quote.quoteId),e=>e.code==='QUOTE_SCOPE_DENIED');
  await assert.rejects(()=>app.consent(credential,quote),e=>e.code==='QUOTE_SCOPE_DENIED');
  assert.equal((await pool.query('SELECT count(*)::int n FROM liftd.quote_consents WHERE quote_id=$1',[quote.quoteId])).rows[0].n,0);
});
test('quote expiry during a fresh fare-rule lookup rolls back affirmative consent',async()=>{
  const {token,quote}=await app.prepare('fare_late_consent');controls.afterFareRules=()=>{controls.now=130;};
  await assert.rejects(()=>app.consent(token,quote),e=>e.code==='QUOTE_EXPIRED');
  assert.equal((await pool.query('SELECT count(*)::int n FROM liftd.quote_consents WHERE quote_id=$1',[quote.quoteId])).rows[0].n,0);
});
