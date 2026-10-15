import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {createDatabasePool,createPostgresTripStore,migrate} from '../../src/postgres-store.mjs';
import {createAuthenticator} from '../../src/auth.mjs';
import {createSessionClient} from '../../src/session-client.mjs';
import {createEligibilityAdapter} from '../../src/eligibility.mjs';
import {createLocationRoutingAdapter,createPrivateLocationStore,createLocationService} from '../../src/location.mjs';
import {createTripService} from '../../src/service.mjs';
import {createHttpHandler} from '../../src/http.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real PostgreSQL mandatory');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
let pool,tripStore,privateStore,locationService,service,handler,now=100,revoked=false,transportRevoked=false,role='rider',subject='rider_1';
const encryptionKey=randomBytes(32);let sequence=0;
const cid=()=>`location_${process.pid}_${++sequence}`;
const pairs=Array.from({length:6},()=>generateKeyPairSync('rsa',{modulusLength:2048}));
const roots=pairs.map((p,i)=>({issuer:`https://authority-${i}.example`,audience:'liftd-api',keys:{v1:p.publicKey.export({type:'spki',format:'pem'})}}));
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const jwt=(i,claims)=>{const data=`${b64({alg:'RS256',typ:'JWT',kid:'v1'})}.${b64({iss:roots[i].issuer,aud:'liftd-api',iat:now,nbf:now,exp:now+30,jti:cid(),...claims})}`;
  return `${data}.${sign('RSA-SHA256',Buffer.from(data),pairs[i].privateKey).toString('base64url')}`;};
const access=()=>jwt(0,{sub:subject,purpose:'liftd_access',accountId:subject==='driver_1'?'driver_account':'rider_account',sessionId:'session_1',deviceId:'device_1',recoveryEpoch:0});
const input=commandId=>({riderId:'rider_1',commandId,pickup:{latitude:49.282731,longitude:-123.120739,precision:'exact'},dropoff:{latitude:49.29,longitude:-123.13,precision:'exact'},passengerCount:2});
const transport=(i,purpose,fn)=>createSessionClient({endpoint:`https://authority-${i}.example/verify`,credential:'test-only',transport:async(_,options)=>{
  const request=JSON.parse(options.body);return new Response(jwt(i,{purpose,...fn(request)}),{headers:{'content-type':'application/jwt'}});
}});
before(async()=>{
  assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name,'liftd_qualification');await migrate(owner);
  await owner.query("CREATE ROLE liftd_location_runtime LOGIN PASSWORD 'location_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE");
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_location_runtime');
  await owner.query('GRANT SELECT ON ALL TABLES IN SCHEMA liftd TO liftd_location_runtime');
  await owner.query('GRANT INSERT,UPDATE ON liftd.trips,liftd.private_locations TO liftd_location_runtime');
  await owner.query('GRANT INSERT ON liftd.events,liftd.commands TO liftd_location_runtime');
  const url=new URL(process.env.LIFTD_DATABASE_URL);url.username='liftd_location_runtime';url.password='location_fixture';
  pool=createDatabasePool({connectionString:url.href});tripStore=createPostgresTripStore(pool);
  privateStore=createPrivateLocationStore(pool,{keys:{v1:encryptionKey},activeKey:'v1',retentionSeconds:100,clock:()=>now});
  const auth=createAuthenticator({identity:roots[0],sessionAuthority:roots[1],clock:()=>now,resolveSession:transport(1,'liftd_session_status',r=>({
    sub:r.subject,nonce:r.nonce,tokenDigest:r.tokenDigest,accountId:r.accountId,sessionId:r.sessionId,deviceId:r.deviceId,recoveryEpoch:0,
    active:!revoked,deviceActive:true,tokenActive:true,grants:[{role,resource:role==='rider'?`account:${r.subject}`:'trip:integrated_trip',
      actions:role==='rider'?['route.prepare','trip.create']:role==='operator'?['trip.assign']:['trip.read','trip.arrive','trip.start','trip.complete'],expiresAt:now+30,revoked:false},
      ...(role==='rider'?[{role:'rider',resource:'trip:integrated_trip',actions:['trip.read','trip.cancel'],expiresAt:now+30,revoked:false}]:[])]}))});
  const routingAdapter=createLocationRoutingAdapter({authority:roots[2],clock:()=>now,resolveRoute:transport(2,'liftd_location_route',r=>({sub:r.riderId,nonce:r.nonce,
    routeRef:r.routeRef,pointsDigest:r.pointsDigest,provider:'fixture_provider',provenanceRef:'scope_1',revision:1,distanceMeters:1800,durationSeconds:500,
    country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',airport:false,crossBoundary:false,available:true,ambiguous:false}))});
  locationService=createLocationService({authenticator:auth,tripStore,privateStore,routingAdapter,clock:()=>now});
  const eligibilityAdapter=createEligibilityAdapter({driverRegistry:roots[3],vehicleRegistry:roots[4],transportAuthority:roots[5],clock:()=>now,
    routeScopeFor:locationService.routeScopeFor,
    resolveDriver:transport(3,'liftd_driver_registry',r=>({...r,sub:r.driverId,accountId:'driver_account',recordRef:'driver_record',revision:1,active:true,suspended:false})),
    resolveVehicle:transport(4,'liftd_vehicle_registry',r=>({...r,sub:r.vehicleId,recordRef:'vehicle_record',revision:1,active:true,suspended:false,authorizedDriverId:r.driverId,capacity:4})),
    resolveTransport:transport(5,'liftd_transport_eligibility',r=>({...r,sub:r.driverId,operatorRef:'operator_1',approved:true,revoked:transportRevoked,validUntil:now+30}))});
  service=createTripService({authenticator:auth,store:tripStore,privateLocationStore:privateStore,eligibilityAdapter,isPaused:()=>false,clock:()=>now});
  handler=createHttpHandler(service,locationService);
});
after(async()=>{await pool?.end();await owner.end();});
test('signed Location, Identity, registry and eligibility integrate with atomic PostgreSQL trip binding',async()=>{
  const descriptor=await locationService.prepare(access(),input(cid()));
  assert.equal('pickup' in descriptor,false);assert.equal(descriptor.precision,'municipality');
  await service.create(access(),{id:'integrated_trip',routeRef:descriptor.routeRef,riderId:'rider_1',commandId:cid()});
  assert.equal((await privateStore.owned(descriptor.routeRef,{subject:'rider_1',accountId:'rider_account',role:'rider'})).payload.pickup.latitude,49.282731);
  role='operator';subject='operator_1';
  await service.transition(access(),'integrated_trip',{action:'assign',expectedRevision:0,driverId:'driver_1',vehicleId:'vehicle_1',commandId:cid()});
  await assert.rejects(()=>locationService.coordinates(access(),'integrated_trip'),e=>e.code==='PERMISSION_DENIED');
  role='driver';subject='driver_1';assert.equal((await locationService.coordinates(access(),'integrated_trip')).passengerCount,2);
  await service.transition(access(),'integrated_trip',{action:'arrive',expectedRevision:1,commandId:cid()});
  transportRevoked=true;
  await assert.rejects(()=>service.transition(access(),'integrated_trip',{action:'start',expectedRevision:2,commandId:cid()}),e=>e.code==='TRANSPORT_INELIGIBLE');
  transportRevoked=false;await service.transition(access(),'integrated_trip',{action:'start',expectedRevision:2,commandId:cid()});
  await service.transition(access(),'integrated_trip',{action:'complete',expectedRevision:3,commandId:cid()});
  await assert.rejects(()=>locationService.coordinates(access(),'integrated_trip'),e=>e.code==='LOCATION_SCOPE_DENIED');
  role='rider';subject='rider_1';assert.equal((await locationService.coordinates(access(),'integrated_trip')).pickup.latitude,49.282731);
  assert.equal((await tripStore.history('integrated_trip')).length,5);
});
test('coordinates are encrypted at rest and absent from immutable trip/event/command records',async()=>{
  const row=(await pool.query('SELECT * FROM liftd.private_locations WHERE trip_id=$1',['integrated_trip'])).rows[0];
  assert.ok(row.sealed.ciphertext);assert.equal(JSON.stringify(row).includes('49.282731'),false);
  for(const table of ['trips','events','commands']) {
    const rows=(await pool.query(`SELECT * FROM liftd.${table} WHERE trip_id=$1`,['integrated_trip'])).rows;
    assert.equal(JSON.stringify(rows).includes('49.282731'),false);
  }
});
test('other riders/accounts, unassigned drivers and provider outages cannot obtain private coordinates',async()=>{
  const row=(await pool.query('SELECT route_ref FROM liftd.private_locations WHERE trip_id=$1',['integrated_trip'])).rows[0];
  await assert.rejects(()=>privateStore.owned(row.route_ref,{subject:'other',accountId:'rider_account',role:'rider'}));
  await assert.rejects(()=>privateStore.owned(row.route_ref,{subject:'rider_1',accountId:'other',role:'rider'}));
  await assert.rejects(()=>privateStore.owned(row.route_ref,{subject:'other',role:'driver'},{id:'integrated_trip',driverId:'driver_1',routeRef:row.route_ref,state:'ASSIGNED'}));
  revoked=true;await assert.rejects(()=>locationService.coordinates(access(),'integrated_trip'),e=>e.code==='SESSION_REVOKED');revoked=false;
});
test('same-key preparation retries are idempotent; payload changes and duplicate route binding fail closed',async()=>{
  const key=cid(),a=await locationService.prepare(access(),input(key)),b=await locationService.prepare(access(),input(key));
  assert.deepEqual(a,b);
  await assert.rejects(()=>locationService.prepare(access(),{...input(key),passengerCount:3}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  await service.create(access(),{id:cid(),routeRef:a.routeRef,riderId:'rider_1',commandId:cid()});
  const otherTrip=cid();await assert.rejects(()=>service.create(access(),{id:otherTrip,routeRef:a.routeRef,riderId:'rider_1',commandId:cid()}),e=>e.code==='LOCATION_SCOPE_DENIED');
  assert.equal(await tripStore.get(otherTrip),undefined);
});
test('expired coordinates deny immediately; purge erases ciphertext and tombstones cannot reactivate',async()=>{
  const key=cid(),route=await locationService.prepare(access(),input(key));
  now=201;
  await assert.rejects(()=>locationService.prepare(access(),input(key)),e=>e.code==='LOCATION_EXPIRED');
  await assert.rejects(()=>privateStore.forRouting(route.routeRef),e=>e.code==='LOCATION_EXPIRED');
  assert.ok(await privateStore.purgeExpired()>0);
  const row=(await pool.query('SELECT * FROM liftd.private_locations WHERE route_ref=$1',[route.routeRef])).rows[0];
  assert.equal(row.sealed,null);assert.equal(row.tombstoned,true);
  await assert.rejects(()=>owner.query('UPDATE liftd.private_locations SET tombstoned=false,sealed=$1 WHERE route_ref=$2',[{ciphertext:'old'},route.routeRef]),e=>e.code==='23514');
  await assert.rejects(()=>owner.query('DELETE FROM liftd.private_locations WHERE route_ref=$1',[route.routeRef]),e=>e.code==='23514');
  await assert.rejects(()=>privateStore.forRouting(route.routeRef),e=>e.code==='LOCATION_EXPIRED');
  now=100;
});

test('HTTP private coordinates are no-store; unauthenticated and terminal-driver reads fail',async()=>{
  role='rider';subject='rider_1';
  const unauthenticated=await handler(new Request('https://liftd.example/v1/rideshare/trips/integrated_trip/coordinates'));
  assert.equal(unauthenticated.status,401);assert.equal(unauthenticated.headers.get('cache-control'),'no-store');
  const expired=await handler(new Request('https://liftd.example/v1/rideshare/trips/integrated_trip/coordinates',{headers:{authorization:`Bearer ${access()}`}}));
  assert.equal(expired.status,403);
});
