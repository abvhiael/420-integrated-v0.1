import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {createSupportCaseService} from '../../src/support-cases.mjs';
const db=process.env.LIFTD_DATABASE_URL;
test('L03.1 PostgreSQL case lifecycle: all classes, replay, appeal and access', {skip:!db}, async()=>{
 const pool=createDatabasePool({connectionString:db});
 try{
  await migrate(pool);
  const tripId='trip_l031_'+Date.now(),now=1000;
  await pool.query('INSERT INTO liftd.trips(trip_id,revision,snapshot) VALUES($1,0,$2)',[tripId,{id:tripId,revision:0,state:'REQUESTED',riderId:'rider_1',driverId:null,vehicleId:null,routeRef:'route_1'}]);
  await pool.query('UPDATE liftd.trips SET snapshot=$1,revision=1 WHERE trip_id=$2',[{id:tripId,revision:1,state:'CANCELLED',riderId:'rider_1',driverId:null,vehicleId:null,routeRef:'route_1'},tripId]);
  let blocked=false;
  const auth={authorize:async(token,{action,resource})=>{if(blocked||resource!=='trip:'+tripId)throw Error('DENIED');return {role:token,subject:token+'_1',accountId:token+'_account',sessionId:'session_1',deviceId:'device_1',recoveryEpoch:0,expiresAt:5000,action,resource}}};
  const service=createSupportCaseService({pool,authenticator:auth,clock:()=>now,retentionSeconds:86400,appealSeconds:86400});
  for(const category of ['cancellation','no_show','fare','lost_property','incident']){
   const caseId='case_'+category+'_'+Date.now();
   const input={tripId,category,commandId:'open_'+category};
   const opened=await service.open('rider',caseId,input);
   assert.equal(opened.status,'OPEN');
   assert.deepEqual(await service.open('rider',caseId,input),opened);
   await assert.rejects(()=>service.read('driver',caseId),{code:'SUPPORT_SCOPE_DENIED'});
   await assert.rejects(()=>service.escalate('rider',caseId,{commandId:'escalate_'+category,expectedRevision:0}),{code:'SUPPORT_SCOPE_DENIED'});
   const evidence=await service.evidence('rider',caseId,{commandId:'evidence_'+category,expectedRevision:0,evidenceDigest:'a'.repeat(64),evidenceClass:'statement'});
   assert.equal(evidence.revision,1);
   await assert.rejects(()=>service.decide('operator',caseId,{commandId:'stale_'+category,expectedRevision:0,decision:'denied'}),{code:'CASE_STALE_REVISION'});
   await service.escalate('operator',caseId,{commandId:'escalate_'+category,expectedRevision:1});
   await service.decide('operator',caseId,{commandId:'decide_'+category,expectedRevision:2,decision:'denied'});
   await assert.rejects(()=>service.appeal('operator',caseId,{commandId:'wrong_'+category,expectedRevision:3}),{code:'APPEAL_DENIED'});
   await service.appeal('rider',caseId,{commandId:'appeal_'+category,expectedRevision:3});
   await service.decide('operator',caseId,{commandId:'again_'+category,expectedRevision:4,decision:'upheld'});
   await assert.rejects(()=>service.appeal('rider',caseId,{commandId:'againappeal_'+category,expectedRevision:5}),{code:'APPEAL_DENIED'});
   const closed=await service.close('operator',caseId,{commandId:'close_'+category,expectedRevision:5});
   assert.equal(closed.status,'CLOSED');
   await assert.rejects(()=>service.evidence('rider',caseId,{commandId:'late_'+category,expectedRevision:6,evidenceDigest:'a'.repeat(64),evidenceClass:'statement'}),{code:'CASE_TRANSITION_DENIED'});
  }
  blocked=true;
  await assert.rejects(()=>service.read('rider','case_fare_'+Date.now()));
 }finally{await pool.end()}
});
