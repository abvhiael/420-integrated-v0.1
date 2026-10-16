import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorConsoleService,redactedOperatorTrip} from '../src/operator-console.mjs';
import {createHttpHandler} from '../src/http.mjs';
import {AuthError} from '../src/auth.mjs';
import {createOperatorMonitors} from '../src/operator-monitors.mjs';
const trip=()=>({id:'trip_a',riderId:'rider_a',driverId:'driver_a',vehicleId:'vehicle_a',routeRef:'secret_route',state:'IN_PROGRESS',revision:4});
function fixture(){
 let state=trip(),revoked=false,time=100,processed=false,audits=[];
 const auth={authorize:async(token,{action,resource})=>{
  if(token!=='operator_a'||revoked||resource!=='trip:trip_a'||!['operator.monitor','safety.read','safety.resolve'].includes(action))
    throw new AuthError('FORBIDDEN',403);
  return {role:'operator',subject:'operator_a',accountId:'account_a',sessionId:'session_a',recoveryEpoch:1,deviceId:'device_a',expiresAt:time+20,action,resource};
 }};
 const safety={read:async()=>({tripId:'trip_a',incidents:[{incidentId:'incident_a',category:'threat',createdAt:20}]}),
 resolve:async(_token,_,cmd)=>{processed=true;state={...state,state:'CANCELLED',revision:5};return {tripId:'trip_a',incidentId:cmd.incidentId,state:'CANCELLED',revision:5};}};
 const service=createOperatorConsoleService({authenticator:auth,tripStore:{get:async()=>state},
  dispatchMonitor:{read:async()=>({status:'ARRIVED',internalToken:'forbidden'})},
  eligibilityMonitor:{read:async()=>({status:'ELIGIBLE',privateDocs:'forbidden'})},
  safetyService:safety,audit:{append:async x=>{audits.push(x)}},clock:()=>time});
 return {service,audits,safety,auth,setState:x=>state=x,revoke:()=>revoked=true,setTime:n=>time=n,processed:()=>processed};
}
test('monitor projects only safe dispatch and eligibility states; audited, least privilege',async()=>{
 const x=fixture(),r=await x.service.snapshot('operator_a','trip_a');
 assert.deepEqual(r.trip,{tripId:'trip_a',state:'IN_PROGRESS',revision:4,assigned:true});
 assert.deepEqual(r.dispatch,{status:'ARRIVED'});assert.deepEqual(r.eligibility,{status:'ELIGIBLE'});
 assert.equal(JSON.stringify(r).includes('secret_route'),false);assert.equal(x.audits[0].action,'monitor');
 await assert.rejects(()=>x.service.snapshot('rider_a','trip_a'));
 await assert.rejects(()=>x.service.snapshot('operator_a','trip_other'));
 x.revoke();await assert.rejects(()=>x.service.snapshot('operator_a','trip_a'));
});
test('incident triage and canonical safety recovery are audited and revision gated',async()=>{
 const x=fixture(),cases=await x.service.incidents('operator_a','trip_a');
 assert.equal(cases.incidents[0].incidentId,'incident_a');
 assert.equal(x.audits[0].action,'incident.read');
 await assert.rejects(()=>x.service.resolve('operator_a','trip_a',{commandId:'key_a',incidentId:'incident_a',expectedRevision:3,resolution:'safe_exit'}),{code:'INVALID_RECOVERY_STATE'});
 assert.equal(x.processed(),false);
 const r=await x.service.resolve('operator_a','trip_a',{commandId:'key_a',incidentId:'incident_a',expectedRevision:4,resolution:'safe_exit'});
 assert.equal(r.state,'CANCELLED');assert.equal(x.audits.at(-1).action,'incident.resolve');
 await assert.rejects(()=>x.service.resolve('operator_a','trip_a',{commandId:'key_b',incidentId:'incident_a',expectedRevision:5,resolution:'safe_exit'}));
});
test('deny invalid audit authority/projections, payload injection, stale authorization',async()=>{
 const x=fixture();
 await assert.rejects(()=>x.service.resolve('operator_a','trip_a',{commandId:'key',incidentId:'incident_a',expectedRevision:4,resolution:'safe_exit',driverId:'other'}));
 assert.throws(()=>redactedOperatorTrip({...trip(),revision:-1}),{code:'INVALID_TRIP'});
 x.setState({...trip(),state:'COMPLETED'});await assert.rejects(()=>x.service.resolve('operator_a','trip_a',{commandId:'key',incidentId:'incident_a',expectedRevision:4,resolution:'safe_exit'}));
 const bad=createOperatorConsoleService({authenticator:x.auth,tripStore:{get:async()=>trip()},
  dispatchMonitor:{read:async()=>({status:'UNKNOWN_PRIVILEGED'})},eligibilityMonitor:{read:async()=>({status:'ELIGIBLE'})},
  safetyService:x.safety,audit:{append:async()=>{}},clock:()=>100});
 await assert.rejects(()=>bad.snapshot('operator_a','trip_a'),{code:'INVALID_PROJECTION'});
});
test('HTTP requires bearer and denies unsupported operator verbs and unbound deployments',async()=>{
 const x=fixture(),handler=createHttpHandler({},null,null,null,null,null,null,null,null,null,null,x.service);
 const url='https://liftd.example/v1/rideshare/operator/trips/trip_a';
 assert.equal((await handler(new Request(url))).status,401);
 assert.equal((await handler(new Request(url,{method:'DELETE',headers:{authorization:'Bearer a.b.c'}}))).status,405);
 const absent=createHttpHandler({},null,null,null,null,null,null,null,null,null,null);
 assert.equal((await absent(new Request(url))).status,503);
});

test('concrete monitors use private PostgreSQL lease and independently reverified eligibility, never location',async()=>{
 const state=trip();let lease={state:'ACCEPTED',expires_at:150},legal=true;
 const adapters=createOperatorMonitors({
  pool:{query:async(sql,params)=>{assert.match(sql,/liftd.assignment_leases/);assert.deepEqual(params,['trip_a']);return {rows:[lease]};}},
  tripStore:{get:async()=>state},
  eligibilityAdapter:{project:async(t,command)=>{assert.equal(t.id,'trip_a');assert.equal(command.action,'start');
    if(!legal)throw new AuthError('TRANSPORT_INELIGIBLE',403);
    return {admission:{allowed:true,tripId:'trip_a',driverId:'driver_a',vehicleId:'vehicle_a',expiresAt:150}};}},
  clock:()=>100
 });
 assert.deepEqual(await adapters.dispatch.read('trip_a'),{status:'ACCEPTED'});
 assert.deepEqual(await adapters.eligibility.read('trip_a'),{status:'ELIGIBLE'});
 legal=false;assert.deepEqual(await adapters.eligibility.read('trip_a'),{status:'REVOKED'});
 lease={state:'CLOSED',expires_at:150};assert.deepEqual(await adapters.dispatch.read('trip_a'),{status:'CLOSED'});
 await assert.rejects(()=>adapters.dispatch.read('different'),{code:'TRIP_UNAVAILABLE'});
});
