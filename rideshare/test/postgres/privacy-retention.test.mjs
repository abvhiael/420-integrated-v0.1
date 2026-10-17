import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createPrivacyService,redactedPrivacyTelemetry,privacyRetentionPolicy} from '../../src/privacy-retention.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real PostgreSQL database required');
test('L03.5 scoped privacy lifecycle, immutable decisions, evidence holds, redacted export and replay',async()=>{
 const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 let time=1000,revoked=false;
 const tripId='privacy_trip_'+Date.now(),rider='privacy_rider_'+Date.now(),driver='privacy_driver_'+Date.now();
 const auth={authorize:async(token,{action,resource})=>{
  if(revoked||resource!=='trip:'+tripId||!['rider','driver','operator'].includes(token))throw new Error('DENIED');
  const role=token,subject=role==='rider'?rider:role==='driver'?driver:'privacy_operator';
  return {role,subject,accountId:subject+'_account',sessionId:'session_1',deviceId:'device_1',recoveryEpoch:0,expiresAt:9999999,action};
 }};
 try{
  await migrate(pool);
  const service=createPrivacyService({pool,authenticator:auth,clock:()=>time});
  await pool.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,0,$2)',[tripId,{id:tripId,state:'REQUESTED',revision:0,riderId:rider,driverId:null,vehicleId:null,routeRef:'privacy_route'}]);
  const requestId='privacy_req_'+Date.now(),body={tripId,type:'export',commandId:'cmd_create'};
  const created=await service.request('rider',requestId,body);
  assert.equal(created.status,'OPEN');assert.equal(created.dueAt,time+privacyRetentionPolicy.privacyRequestSeconds);
  assert.deepEqual(await service.request('rider',requestId,body),created);
  await assert.rejects(()=>service.request('rider','privacy_other_'+Date.now(),body),{code:'PRIVACY_REPLAY_CONFLICT'});
  await assert.rejects(()=>service.fulfill('rider',requestId,{commandId:'cmd_no',expectedRevision:0}),{code:'PRIVACY_OPERATOR_REQUIRED'});
  await assert.rejects(()=>service.fulfill('operator',requestId,{commandId:'cmd_stale',expectedRevision:1}),{code:'PRIVACY_STALE_OR_TERMINAL'});
  const done=await service.fulfill('operator',requestId,{commandId:'cmd_complete',expectedRevision:0});
  assert.equal(done.status,'FULFILLED');
  const extracted=await service.export('rider',requestId);
  assert.equal(extracted.coordinates,'REDACTED');assert.equal(extracted.otherPartyIdentity,'REDACTED');
  await assert.rejects(()=>service.export('operator',requestId),{code:'PRIVACY_EXPORT_DENIED'});
  assert.equal((await service.read('rider',requestId)).status,'FULFILLED');
  const deletion='privacy_delete_'+Date.now();
  await service.request('rider',deletion,{tripId,type:'deletion',commandId:'cmd_delete'});
  await pool.query('INSERT INTO liftd.safety_incidents(incident_id,trip_id,reporter_id,reporter_role,category,created_at,trip_revision) VALUES($1,$2,$3,$4,$5,$6,$7)',['privacy_incident_'+Date.now(),tripId,rider,'rider','threat',time,0]);
  await assert.rejects(()=>service.fulfill('operator',deletion,{commandId:'cmd_erase',expectedRevision:0}),{code:'PRIVACY_PROTECTED_RECORD'});
  const held=await service.hold('operator',deletion,{commandId:'cmd_hold',expectedRevision:0});assert.equal(held.status,'BLOCKED_HOLD');
  assert.equal(held.reason,'retained_incident');
  const bad=()=>redactedPrivacyTelemetry({event:'export',domain:'privacy',status:'allowed',count:1,elapsedMs:5,tripId});
  assert.throws(bad,{code:'INVALID_REQUEST'});
  assert.equal(redactedPrivacyTelemetry({event:'export',domain:'privacy',status:'allowed',count:1,elapsedMs:5}).event,'export');
  await assert.rejects(()=>pool.query('DELETE FROM liftd.privacy_events WHERE request_id=$1',[requestId]),e=>e.code==='23514');
  await assert.rejects(()=>pool.query('UPDATE liftd.privacy_commands SET request_hash=$1 WHERE request_id=$2',['0'.repeat(64),requestId]),e=>e.code==='23514');
  revoked=true;await assert.rejects(()=>service.read('rider',requestId));
 }finally{await pool.end()}
});
