import test from 'node:test';import assert from 'node:assert/strict';
import {createDriverJourney} from '../src/driver-journey.mjs';
const s={subject:'driver1',accountId:'account1',sessionId:'session1'};
const ava={driverId:'driver1',vehicleId:'vehicle1',revision:1,online:false,expiresAt:100};
const off={offerId:'offer1',tripId:'trip1',driverId:'driver1',vehicleId:'vehicle1',revision:0,expiresAt:200,status:'PENDING'};
const trip=(state,revision)=>({id:'trip1',riderId:'rider1',driverId:'driver1',vehicleId:'vehicle1',routeRef:'route1',state,revision});
function make(api,role='driver',clock=()=>100){
 const session={withFreshRole:async(r,fn)=>{if(r!==role)throw Error('ROLE_DENIED');return fn(s);}};
 return createDriverJourney({session,api,clock,commandId:()=> 'command1'});
}
test('no local driver eligibility assumption and fresh role before onboarding',async()=>{
 let calls=0;const j=make({readOnboarding:async()=>{calls++;return {driverId:'driver1',revision:2,status:'pending',remediation:[]};}});
 await assert.rejects(j.submitDocuments({vehicleId:'vehicle1',kind:'licence',privateRef:'receipt1',expiresAt:200}),/ONBOARDING_STATUS_REQUIRED/);
 assert.equal(calls,0);assert.equal((await j.readOnboarding()).status,'pending');
 const denied=make({readOnboarding:async()=>{calls++;}},'rider');
 await assert.rejects(denied.readOnboarding(),/ROLE_DENIED/);assert.equal(calls,1);
});
test('availability must come from server, online transition keeps server response',async()=>{
 const j=make({readAvailability:async()=>ava,setAvailability:async()=>({...ava,online:true,expiresAt:200,revision:2})});
 await assert.rejects(j.setAvailability({online:true,vehicleId:'vehicle1',seats:4}),/AVAILABILITY_STATUS_REQUIRED/);
 await j.readAvailability();assert.equal((await j.setAvailability({online:true,vehicleId:'vehicle1',seats:4})).active,true);
});
test('offer expiry rejects before any acceptance call',async()=>{
 let responds=0;let now=100;const j=make({readOffers:async()=>[off],respondOffer:async()=>{responds++;}},'driver',()=>now);
 await j.readOffers();now=201;
 await assert.rejects(j.respondOffer('offer1',true),/OFFER_EXPIRED_OR_UNAVAILABLE/);assert.equal(responds,0);
});
test('offer response uses revision and requires server confirmation',async()=>{
 const j=make({readOffers:async()=>[off],respondOffer:async(_s,body)=>{assert.equal(body.expectedRevision,0);return {...off,status:'ACCEPTED',revision:1};}});
 await j.readOffers();assert.equal((await j.respondOffer('offer1',true)).status,'ACCEPTED');
 await assert.rejects(j.respondOffer('offer1',true),/OFFER_EXPIRED_OR_UNAVAILABLE/);
});
test('trip stages require server transitions, duplicate and stale revision denied',async()=>{
 let state=trip('ASSIGNED',1);
 const j=make({readTrip:async()=>state,transition:async(_s,_id,body)=>{state=trip(({arrive:'ARRIVED',start:'IN_PROGRESS',complete:'COMPLETED'})[body.action],state.revision+1);return state;}});
 await j.readTrip('trip1');await assert.rejects(j.transition('complete'),/TRANSITION_DENIED/);
 await j.transition('arrive');await assert.rejects(j.transition('arrive'),/TRANSITION_DENIED/);
 await j.transition('start');assert.equal((await j.transition('complete')).state,'COMPLETED');
 await assert.rejects(j.transition('complete'),/TRANSITION_DENIED/);
});
test('revoked driver credentials clear in-memory offers, trip and eligibility',async()=>{
 const j=make({readOffers:async()=>[off]});await j.readOffers();j.suspend();assert.equal(j.state().offers.length,0);
 await assert.rejects(j.respondOffer('offer1',true),/OFFER_EXPIRED_OR_UNAVAILABLE/);
});
test('navigation requires active verified trip; never mint guessed directions',async()=>{
 const j=make({readTrip:async()=>trip('ASSIGNED',1),navigation:async()=>({tripId:'trip1',routeRef:'route1',expiresAt:300,url:'https://navigation.example/route/1'})});
 await assert.rejects(j.navigation(),/TRIP_UNAVAILABLE/);await j.readTrip('trip1');
 assert.equal(await j.navigation(),'https://navigation.example/route/1');
});
test('invalid document receipt or expiry denied before backend transmission',async()=>{
 let n=0;const j=make({readOnboarding:async()=>({driverId:'driver1',revision:1,status:'pending',remediation:[]}),submitOnboarding:async()=>{n++;}});
 await j.readOnboarding();await assert.rejects(j.submitDocuments({vehicleId:'vehicle1',kind:'licence',privateRef:'../secret',expiresAt:200}),/INVALID_DOCUMENT_METADATA/);assert.equal(n,0);
});
