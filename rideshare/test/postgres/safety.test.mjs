import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,createPostgresTripStore,migrate} from '../../src/postgres-store.mjs';
import {createSafetyService} from '../../src/safety.mjs';
import {createTrip,transitionTrip} from '../../src/trip.mjs';
import {createHttpHandler} from '../../src/http.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Isolated PostgreSQL required; no skips');
const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
let store,safety,n=0;const key=()=>`safety_${process.pid}_${++n}`;
const trips=new Map();let denied=false;
const auth={async authorize(token,{action,resource}) {
 if(denied)throw new Error('revoked');
 const role=token==='operator'?'operator':token==='driver'?'driver':'rider';
 const subject=role==='operator'?'operator_1':role==='driver'?'driver_1':'rider_1';
 if(!['safety.report','safety.resolve','safety.read'].includes(action))throw Error('unauthorized');
 if(role==='operator'&&action==='safety.report'||role!=='operator'&&action!=='safety.report')throw Error('forbidden');
 return {role,subject,accountId:'account_'+subject,recoveryEpoch:0,expiresAt:2000};
}};
before(async()=>{assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,'liftd_qualification');await migrate(pool);store=createPostgresTripStore(pool);safety=createSafetyService({pool,store,authenticator:auth,clock:()=>1000});});
after(async()=>pool.end());
const context={now:1000,paused:false};
async function activeTrip(){
 const tripId=key(),routeRef=key(),rider={subject:'rider_1',role:'rider'},driver={subject:'driver_1',role:'driver'},dispatcher={subject:'operator_1',role:'dispatcher'};
 let t=createTrip({id:tripId,routeRef},rider);
 await store.execute({actorId:rider.subject,commandId:key(),tripId,action:'create',request:{tripId},guard:async()=>{}},async()=>t);
 for(const [action,who,extra] of [['assign',dispatcher,{driverId:'driver_1',vehicleId:key()}],['arrive',driver,{}],['start',driver,{}]]){
  const command={action,expectedRevision:t.revision,...extra};
  t=await store.execute({actorId:who.subject,commandId:key(),tripId,action,request:command,guard:async()=>{}},async old=>transitionTrip(old,command,who,{...context,admission:{tripId,driverId:'driver_1',vehicleId:extra.vehicleId??old.vehicleId,routeRef,expiresAt:2000,allowed:true}}));
 }
 return t;
}
test('immutable incident reports, exact replay, redaction, and guarded safety resolution',async()=>{
 const t=await activeTrip();const cmd=key();
 const first=await safety.report('rider',t.id,{commandId:cmd,category:'collision'});
 assert.equal(first.status,'REPORTED');
 assert.deepEqual(await safety.report('rider',t.id,{commandId:cmd,category:'collision'}),first);
 await assert.rejects(()=>safety.report('rider',t.id,{commandId:cmd,category:'medical'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 await assert.rejects(()=>safety.read('rider',t.id));
 const privateCase=await safety.read('operator',t.id);assert.equal(privateCase.incidents.length,1);
 assert.equal('reporter_id' in privateCase.incidents[0],false);
 const result=await safety.resolve('operator',t.id,{commandId:key(),incidentId:first.incidentId,expectedRevision:t.revision,resolution:'interrupted'});
 assert.equal(result.state,'CANCELLED');
 assert.equal((await store.get(t.id)).state,'CANCELLED');
 assert.equal((await store.history(t.id)).at(-1).action,'safety_resolve');
 await assert.rejects(()=>safety.resolve('operator',t.id,{commandId:key(),incidentId:first.incidentId,expectedRevision:t.revision,resolution:'interrupted'}));
 await assert.rejects(()=>pool.query('DELETE FROM liftd.safety_incidents WHERE incident_id=$1',[first.incidentId]),e=>e.code==='23514');
});
test('safety resolution requires genuine incident, prevents arbitrary active-trip database mutation',async()=>{
 const t=await activeTrip();
 await assert.rejects(()=>safety.resolve('operator',t.id,{commandId:key(),incidentId:key(),expectedRevision:t.revision,resolution:'safe_exit'}),e=>e.code==='INCIDENT_REQUIRED');
 const forged={...t,state:'CANCELLED',revision:t.revision+1};
 await assert.rejects(()=>pool.query('UPDATE liftd.trips SET snapshot=$1,revision=$2 WHERE trip_id=$3',[forged,forged.revision,t.id]),e=>e.code==='23514');
 assert.equal((await store.get(t.id)).state,'IN_PROGRESS');
 const complete={action:'complete',expectedRevision:t.revision};
 await store.execute({actorId:'driver_1',commandId:key(),tripId:t.id,action:'complete',request:complete,guard:async()=>{}},
  async old=>transitionTrip(old,complete,{subject:'driver_1',role:'driver'},{now:1000,paused:false}));
});
test('revoked session cannot report or resolve safety incident',async()=>{
 const t=await activeTrip(),report=await safety.report('driver',t.id,{commandId:key(),category:'vehicle'});
 denied=true;
 try {await assert.rejects(()=>safety.resolve('operator',t.id,{commandId:key(),incidentId:report.incidentId,expectedRevision:t.revision,resolution:'safe_exit'}));}
 finally {denied=false;}
 assert.equal((await store.get(t.id)).state,'IN_PROGRESS');
});
