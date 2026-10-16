import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createFraudService,enforceFraudHold} from '../../src/fraud.mjs';
import {createReviewService} from '../../src/reviews.mjs';
import {createHttpHandler} from '../../src/http.mjs';
import {createDispatchAdapter} from '../../src/dispatch.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real isolated PostgreSQL required; no skips');
test('L03.3 real PostgreSQL: five abuse types, expiry, adversarial decisions, replay, appeal and review hold',async()=>{
 const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 try{
  await migrate(pool);
  const suffix=String(Date.now()),tripId='fraud_trip_'+suffix,pendingId='fraud_pending_'+suffix,rider='fraud_rider_'+suffix,driver='fraud_driver_'+suffix,vehicle='fraud_vehicle_'+suffix;
  const snapshot=(state,revision,assigned)=>({id:tripId,revision,state,riderId:rider,driverId:assigned?driver:null,vehicleId:assigned?vehicle:null,routeRef:'route_fraud'});
  await pool.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,0,$2)',[tripId,snapshot('REQUESTED',0,false)]);
  for(const [state,revision] of [['ASSIGNED',1],['ARRIVED',2],['IN_PROGRESS',3],['COMPLETED',4]])
   await pool.query('UPDATE liftd.trips SET snapshot=$1,revision=$2 WHERE trip_id=$3',[snapshot(state,revision,true),revision,tripId]);
  let now=1000,revoked=false;
  const auth={authorize:async(token,{action,resource})=>{
   if(revoked||!['trip:'+tripId,'trip:'+pendingId].includes(resource)||!['rider','driver','operator'].includes(token))throw new Error('DENIED');
   const subject=token==='rider'?rider:token==='driver'?driver:'fraud_operator';
   return {role:token,subject,accountId:subject+'_account',sessionId:'s_1',deviceId:'d_1',recoveryEpoch:0,expiresAt:99999999,action,resource};
  }};
  const fraud=createFraudService({pool,authenticator:auth,clock:()=>now,maxHoldSeconds:86400});
  const reviews=createReviewService({pool,authenticator:auth,clock:()=>now});
  const categories=['account_misuse','fabricated_trip','location_manipulation','coordinated_reviews','economic_replay'];
  const ids=[];
  for(const [index,category] of categories.entries()){
   const caseId='fraud_case_'+index+'_'+suffix;ids.push(caseId);
   const request={tripId,commandId:'report_'+index,category,evidenceDigest:String(index+1).repeat(64)};
   const report=await fraud.report('rider',caseId,request);
   assert.equal(report.status,'OPEN');assert.equal(report.category,category);
   assert.deepEqual(await fraud.report('rider',caseId,request),report);
   await assert.rejects(()=>fraud.report('rider','other_'+index+'_'+suffix,request),{code:'FRAUD_REPLAY_CONFLICT'});
   await assert.rejects(()=>fraud.hold('rider',caseId,{commandId:'hold_denied_'+index,expectedRevision:0,holdSeconds:60}),{code:'FRAUD_OPERATOR_REQUIRED'});
   await assert.rejects(()=>fraud.hold('operator',caseId,{commandId:'hold_bad_'+index,expectedRevision:0,holdSeconds:86401}),{code:'INVALID_HOLD'});
  }
  const target=ids[0],moderation={commandId:'hold_first',expectedRevision:0,holdSeconds:60};
  const held=await fraud.hold('operator',target,moderation);
  assert.equal(held.status,'HELD');assert.equal(held.holdUntil,1060);
  assert.deepEqual(await fraud.hold('operator',target,moderation),held);
  await assert.rejects(()=>fraud.hold('operator',target,{...moderation,holdSeconds:61}),{code:'FRAUD_REPLAY_CONFLICT'});
  await assert.rejects(()=>fraud.hold('operator',target,{commandId:'stale',expectedRevision:0,holdSeconds:60}),{code:'FRAUD_STALE_REVISION'});
  await assert.rejects(()=>enforceFraudHold(pool,tripId,now),{code:'FRAUD_REVIEW_HOLD'});
  await assert.rejects(()=>reviews.submit('rider','fraud_review_'+suffix,{tripId,commandId:'rv_fraud',rating:5}),{code:'FRAUD_REVIEW_HOLD'});
  const visible=await fraud.read('driver',target);
  assert.equal(visible.caseId,target);assert.equal('reporter_id' in visible,false);assert.equal('evidence_digest' in visible,false);
  const appealed=await fraud.appeal('driver',target,{commandId:'appeal_1',expectedRevision:1});
  assert.equal(appealed.status,'APPEALED');assert.equal(appealed.holdUntil,1060);
  await assert.rejects(()=>enforceFraudHold(pool,tripId,now),{code:'FRAUD_REVIEW_HOLD'});
  await assert.rejects(()=>fraud.appeal('driver',target,{commandId:'appeal_twice',expectedRevision:2}),{code:'FRAUD_APPEAL_DENIED'});
  const cleared=await fraud.clear('operator',target,{commandId:'clear_a',expectedRevision:2});
  assert.equal(cleared.status,'CLEARED');
  const reviewed=await reviews.submit('rider','fraud_review_'+suffix,{tripId,commandId:'rv_fraud',rating:5});
  assert.equal(reviewed.moderation,'PENDING');
  const closed=await fraud.close('operator',target,{commandId:'close_a',expectedRevision:3});
  assert.equal(closed.status,'CLOSED');
  await assert.rejects(()=>fraud.hold('operator',target,{commandId:'reopen',expectedRevision:4,holdSeconds:60}),{code:'FRAUD_TRANSITION_DENIED'});
  const second=ids[1];
  await fraud.hold('operator',second,{commandId:'hold_second',expectedRevision:0,holdSeconds:60});
  now=1060;
  await enforceFraudHold(pool,tripId,now);
  assert.equal((await fraud.read('rider',second)).status,'HELD');
  await fraud.release('operator',second,{commandId:'release_second',expectedRevision:1});
  await assert.rejects(()=>pool.query('DELETE FROM liftd.fraud_events WHERE case_id=$1',[target]),e=>e.code==='23514');
  await assert.rejects(()=>pool.query('UPDATE liftd.fraud_commands SET request_hash=$1 WHERE actor_id=$2 AND command_id=$3',['0'.repeat(64),rider,'report_0']),e=>e.code==='23514');
  // A genuine requested trip with an operator-adjudicated hold cannot enter assignment.
  const pending={id:pendingId,revision:0,state:'REQUESTED',riderId:rider,driverId:null,vehicleId:null,routeRef:'route_fraud'};
  await pool.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,0,$2)',[pendingId,pending]);
  await fraud.report('operator','fraud_pending_case_'+suffix,{tripId:pendingId,commandId:'pending_report',category:'fabricated_trip',evidenceDigest:'b'.repeat(64)});
  await fraud.hold('operator','fraud_pending_case_'+suffix,{commandId:'pending_hold',expectedRevision:0,holdSeconds:300});
  const dispatch=createDispatchAdapter({pool,authenticator:auth,eligibilityAdapter:{project:async()=>({})},availabilitySeconds:60,assignmentSeconds:60,verifyAvailability:async()=>true,clock:()=>now,isPaused:()=>false});
  const conn=await pool.connect();
  try{
   await conn.query('BEGIN');
   await assert.rejects(()=>dispatch.select(conn,pending,{expectedRevision:0}),{code:'FRAUD_REVIEW_HOLD'});
   await conn.query('ROLLBACK');
  }finally{conn.release()}
  await fraud.release('operator','fraud_pending_case_'+suffix,{commandId:'pending_release',expectedRevision:1});
  const handler=createHttpHandler({},null,null,null,null,null,null,null,null,null,null,null,null,null,null,fraud);
  const url='https://liftd.example/v1/rideshare/fraud/cases/'+target;
  assert.equal((await handler(new Request(url))).status,401);
  assert.equal((await handler(new Request(url,{method:'DELETE',headers:{authorization:'Bearer a.b.c'}}))).status,405);
  revoked=true;await assert.rejects(()=>fraud.read('rider',target));
 }finally{await pool.end()}
});
