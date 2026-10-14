import test from 'node:test';import assert from 'node:assert/strict';
import {validateTrip,tripPresentation,estimateLabel} from '../trip-experience-policy.mjs';
import {createTripExperienceController} from '../trip-experience-controller.mjs';
const session={status:'authenticated',subject:'rider_a',roles:['rider']};
const trip=(state='REQUESTED',revision=0)=>({id:'trip_a',riderId:'rider_a',driverId:state==='REQUESTED'?null:'driver_a',vehicleId:state==='REQUESTED'?null:'vehicle_a',routeRef:'route_a',state,revision});
test('confirmed state, role, revision and identities are server bound',()=>{
 assert.equal(tripPresentation(validateTrip(trip(),session)).canCancel,true);
 assert.throws(()=>validateTrip(trip(),{...session,subject:'other'}));
 assert.throws(()=>validateTrip(trip('ARRIVED',2),session,trip('IN_PROGRESS',3)));
 assert.throws(()=>validateTrip({...trip(),state:'COMPLETED'},session));
 assert.match(estimateLabel(61),/Estimate only/);
});
test('cancellation rereads confirmed outcome and reuses replay identity on uncertainty',async()=>{
 let state=trip(),calls=[];let fail=true;
 const api={read:async()=>state,cancel:async(id,revision,key)=>{calls.push(key);if(fail){fail=false;throw Error('timeout');}state={...state,state:'CANCELLED',revision:revision+1};}};
 const ctl=createTripExperienceController({api,session,idFactory:()=> 'cmd_1'});
 await ctl.load('trip_a');
 await assert.rejects(ctl.cancel());
 assert.equal((await ctl.cancel()).state,'CANCELLED');
 assert.deepEqual(calls,['cmd_1','cmd_1']);
 await assert.rejects(ctl.cancel(),e=>e.code==='ACTION_NOT_PERMITTED');
});
test('incident reporting is authorized only on active assigned trips, not completion',async()=>{
 const ctl=createTripExperienceController({api:{read:async()=>trip('COMPLETED',4)},session});
 await ctl.load('trip_a');
 await assert.rejects(ctl.report('medical'),e=>e.code==='ACTION_NOT_PERMITTED');
});
