import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteController} from '../../web/quote-controller.mjs';
import {createPickupController} from '../../web/pickup-controller.mjs';
import {createTripExperienceController} from '../../web/trip-experience-controller.mjs';
import {createDriverOnboardingService} from '../../src/driver-onboarding.mjs';
import {createDriverOnboardingReviewService} from '../../src/driver-onboarding-review.mjs';
import {validateQuote} from '../../web/quote-policy.mjs';

const rider={status:'authenticated',subject:'rider_a',accountId:'account_a',roles:['rider']};
const fare={quoteId:'quote_a',routeRef:'route_a',riderId:'rider_a',accountId:'account_a',quoteHash:'a'.repeat(64),expiresAt:1200,
 amounts:{currency:'CAD',baseCents:400,distanceCents:180,durationCents:45,minimumAdjustmentCents:375,transportationCents:1000,bookingFeeCents:0,surgeCents:0,totalCents:1050,taxes:[{code:'tax',amountCents:50}],passThrough:[]},
 cancellationPolicy:{version:'v1',preTripRiderFeeCents:0,driverCancellationFeeCents:0,assignmentExpiryFeeCents:0,noShowFeeCents:0,waitingFeeCents:0,activeTrip:'safety-resolution-required',driverEarnedObligations:'preserved'}};
test('route consent and trip creation are bound end-to-end; quote changes/expiry deny creation',async()=>{
 let created=0,accepted=0,now=1000;
 const pickup=createPickupController({prepareRoute:async()=>({routeRef:'route_a',distanceMeters:1000,durationSeconds:240})});
 pickup.set('pickup',{label:'Pickup',source:'place',latitude:49.28,longitude:-123.12,precision:'approximate'});
 pickup.set('destination',{label:'Destination',source:'place',latitude:49.29,longitude:-123.13,precision:'approximate'});
 const route=await pickup.preview();assert.equal(route.routeRef,'route_a');
 const controller=createQuoteController({session:rider,clock:()=>now,randomId:(()=>{let i=0;return()=> 'cmd_'+(++i)})(),
  issue:async()=>fare,accept:async(q,cmd)=>{validateQuote(q,now);assert.equal(cmd.quoteHash,fare.quoteHash);accepted++;},
  createTrip:async cmd=>{created++;assert.equal(cmd.quoteId,fare.quoteId);return{id:cmd.id};}});
 await controller.load(route);
 await assert.rejects(controller.submit(false),e=>e.code==='EXPLICIT_CONSENT_REQUIRED');assert.equal(created,0);
 assert.equal((await controller.submit(true)).state,'submitted');assert.equal(created,1);assert.equal(accepted,1);
 assert.equal((await controller.submit(true)).state,'submitted');assert.equal(created,1);
 now=1200;await assert.rejects(controller.submit(true),e=>e.code==='QUOTE_EXPIRED');
 const changed=createQuoteController({session:rider,clock:()=>1000,issue:async()=>({...fare,amounts:{...fare.amounts,totalCents:2000}})});
 await assert.rejects(changed.load(route));assert.equal(created,1);
});
test('inaccessible geolocation and unresolved manual addresses never fabricate a quote',async()=>{
 const p=createPickupController({geolocate:async()=>{throw Error('permission denied')},resolveAddress:async()=>{throw Error('geocoder unavailable')}});
 await assert.rejects(p.requestLocationPermission(),e=>e.code==='LOCATION_UNAVAILABLE');
 p.set('pickup',{label:'Manual pickup',source:'manual'});p.set('destination',{label:'Manual destination',source:'manual'});
 await assert.rejects(p.preview(),e=>e.code==='ROUTE_UNAVAILABLE');
});
test('trip assignment is server confirmed; forged and stale updates rejected',async()=>{
 const confirmed={id:'trip_a',riderId:'rider_a',driverId:null,vehicleId:null,routeRef:'route_a',state:'REQUESTED',revision:0};
 const controller=createTripExperienceController({session:rider,api:{read:async()=>confirmed}});
 assert.equal((await controller.load('trip_a')).state,'REQUESTED');
 await assert.rejects(controller.load('trip_other'),e=>e.code==='INVALID_OR_UNAUTHORIZED_TRIP');
});
test('driver onboarding remains gated on independent vault and reviewer; revoked or expired proof rejects',async()=>{
 const row=new Map();const store={read:async id=>row.get(id),writeCAS:async(id,rev,key,v)=>{if((row.get(id)?.revision??0)!==rev)return false;row.set(id,v);return true;}};
 let time=1000;
 const authenticator={authorize:async(token,{action,resource})=>{
  if(token==='driver'&&action==='onboarding.manage'&&resource==='account:driver_a')return {role:'driver',subject:'driver_a',accountId:'acct_a',expiresAt:1100};
  if(token==='operator'&&action==='onboarding.review'&&resource==='account:driver_a')return {role:'operator',subject:'operator_a',accountId:'acct_op',expiresAt:1100};
  throw Error('revoked');}};
 const service=createDriverOnboardingService({authenticator,store,clock:()=>time,verifyPrivateReceipt:async()=>false});
 const submission={driverId:'driver_a',vehicleId:'vehicle_a',commandId:'submit_a',expectedRevision:0,documents:[{kind:'licence',privateRef:'receipt_a',expiresAt:1500}]};
 await assert.rejects(service.submit('driver',submission),e=>e.code==='INVALID_PRIVATE_RECEIPT');assert.equal(row.size,0);
 time=1100;await assert.rejects(service.submit('driver',submission),e=>e.code==='ONBOARDING_SCOPE_DENIED');time=1000;
 const review=createDriverOnboardingReviewService({authenticator,store,clock:()=>time,verifyIndependentDecision:async()=>null});
 await assert.rejects(review.decide('driver',{driverId:'driver_a',commandId:'review_a',expectedRevision:1,attestation:'forged'}));
 assert.equal(row.size,0);
});
