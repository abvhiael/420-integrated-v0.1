import test from 'node:test';
import assert from 'node:assert/strict';
import {createTravelHandoffService,createInMemoryTravelConsentFixture,boundedTravelContext} from '../src/travel-handoff.mjs';
import {createLiftdTravelSdk,validateTravelHandoffV1} from '../sdk/travel-handoff-v1.mjs';
import {createTravelGroundConnectionConsumer} from '../consumers/travel-handoff-v1.mjs';
import {createHttpHandler} from '../src/http.mjs';
let time=100,revoked=false,trip;
function fixture(){
 time=100;revoked=false;trip={id:'trip_a',riderId:'rider_a',routeRef:'secret_route',state:'REQUESTED',revision:0,driverId:null,vehicleId:null};
 const auth={authorize:async(token,{action,resource})=>{
  if(revoked||token!=='rider_a'||action!=='travel.handoff'||resource!=='trip:trip_a')throw Error('DENIED');
  return {role:'rider',action,resource,subject:'rider_a',accountId:'account_a',sessionId:'session_a',deviceId:'device_a',recoveryEpoch:1,expiresAt:140};
 }};
 const svc=createTravelHandoffService({authenticator:auth,tripStore:{get:async()=>trip},
  consentStore:createInMemoryTravelConsentFixture({clock:()=>time}),clock:()=>time});
 return svc;
}
test('fresh consent and signed rider trip scope produce strictly bounded Travel handoff',async()=>{
 const service=fixture();
 await assert.rejects(()=>service.prepare('rider_a','trip_a',{commandId:'one',purpose:'travel_ground_connection',consent:false}));
 const v=await service.prepare('rider_a','trip_a',{commandId:'one',purpose:'travel_ground_connection',consent:true});
 assert.equal(v.version,'1.0');assert.deepEqual(Object.keys(v.context).sort(),['kind','market','service','status']);
 assert.ok(!JSON.stringify(v).includes('secret_route'));assert.ok(!JSON.stringify(v).includes('rider_a'));
 assert.deepEqual(await service.verify('rider_a','trip_a',v.handoffId),v);
 await assert.rejects(()=>service.verify('other','trip_a',v.handoffId));
 trip={...trip,revision:1};await assert.rejects(()=>service.verify('rider_a','trip_a',v.handoffId),{code:'CONSENT_EXPIRED'});
});
test('revoked session, terminal trip, stale revision and idempotency conflict fail closed',async()=>{
 const service=fixture();const cmd={commandId:'cmd_1',purpose:'travel_ground_connection',consent:true};
 const a=await service.prepare('rider_a','trip_a',cmd);
 assert.equal((await service.prepare('rider_a','trip_a',cmd)).handoffId,a.handoffId);
 await assert.rejects(()=>service.prepare('rider_a','trip_a',{...cmd,commandId:'cmd_2',purpose:'other'}));
 revoked=true;await assert.rejects(()=>service.verify('rider_a','trip_a',a.handoffId));
 revoked=false;trip={...trip,state:'CANCELLED'};await assert.rejects(()=>service.prepare('rider_a','trip_a',{...cmd,commandId:'cmd_3'}));
 time=150;await assert.rejects(()=>service.verify('rider_a','trip_a',a.handoffId));
});
test('Travel consumer uses separate verified API and cannot enable Genesis payments or booking',async()=>{
 const service=fixture();const prepared=await service.prepare('rider_a','trip_a',{commandId:'cmd_x',purpose:'travel_ground_connection',consent:true});
 const sdk=createLiftdTravelSdk({origin:'https://liftd.example/',tokenProvider:async()=> 'a.b.c',
  fetchImpl:async(url,init)=>{assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
   assert.equal(String(url).includes('secret_route'),false);
   return {ok:true,json:async()=>service.verify('rider_a','trip_a',prepared.handoffId)};}});
 const consumer=createTravelGroundConnectionConsumer({liftdSdk:sdk,clock:()=>100});
 const view=await consumer.preview({tripId:'trip_a',handoffId:prepared.handoffId});
 assert.deepEqual(view,{kind:'travel_ground_connection',market:'CA-BC-Vancouver',
  availability:'not_live',bookingEnabled:false,transactionEnabled:false});
 assert.throws(()=>validateTravelHandoffV1({...prepared,privateCoordinates:[1,2]}),/INVALID_HANDOFF_CONTRACT/);
 assert.throws(()=>createLiftdTravelSdk({origin:'http://liftd.example/',fetchImpl:async()=>{},tokenProvider:async()=>''}),/SDK_ORIGIN_REQUIRED/);
});
test('v1 handoff API fail closed when service absent, bearer invalid and verbs unsupported',async()=>{
 const service=fixture(),url='https://liftd.example/v1/rideshare/trips/trip_a/travel-handoff';
 const handler=createHttpHandler({},null,null,null,null,null,null,null,null,null,null,null,service);
 assert.equal((await handler(new Request(url))).status,401);
 assert.equal((await handler(new Request(url,{method:'DELETE',headers:{authorization:'Bearer a.b.c'}}))).status,405);
 const absent=createHttpHandler({},null,null,null,null,null,null,null,null,null,null,null);
 assert.equal((await absent(new Request(url))).status,503);
});
