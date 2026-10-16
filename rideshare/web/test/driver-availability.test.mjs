import test from 'node:test';import assert from 'node:assert/strict';
import {availability,offer,capacity} from '../driver-availability-policy.mjs';
import {createDriverAvailabilityController} from '../driver-availability-controller.mjs';
const session={status:'authenticated',subject:'driver_a',roles:['driver']};
const item={offerId:'offer_a',tripId:'trip_a',driverId:'driver_a',vehicleId:'vehicle_a',revision:1,expiresAt:1100,status:'PENDING'};
test('fresh online status is never inferred from a click, and capacity is bounded',()=>{
 const a=availability({driverId:'driver_a',vehicleId:'vehicle_a',revision:1,online:true,expiresAt:1100},session,1000);
 assert.equal(a.active,true);assert.equal(availability(a,session,1100).active,false);
 assert.throws(()=>availability(a,{...session,subject:'other'},1000));
 assert.throws(()=>capacity(0));assert.throws(()=>capacity(13));assert.equal(capacity(4),4);
});
test('expired and foreign offers cannot be accepted',()=>{
 assert.equal(offer(item,session,1100).canRespond,false);
 assert.throws(()=>offer(item,{...session,subject:'other'},1000));
});
test('server outcome and revision control online/offline and acceptance',async()=>{
 let on=false,revision=1,accepted=0,now=1000;
 const api={readAvailability:async()=>({driverId:'driver_a',vehicleId:'vehicle_a',online:on,revision,expiresAt:now+60}),
  readOffers:async()=>[item],
  setAvailability:async req=>{assert.equal(req.expectedRevision,revision);revision++;on=req.online;return{driverId:'driver_a',vehicleId:'vehicle_a',online:on,revision,expiresAt:now+60};},
  respondOffer:async(id,command)=>{assert.equal(command.offerId,'offer_a');accepted++;}
 };
 const ctrl=createDriverAvailabilityController({api,session,clock:()=>now,nonce:()=> 'unique_command'});
 await ctrl.refresh();await assert.rejects(ctrl.respond(item,'accept'),e=>e.code==='AVAILABILITY_EXPIRED');
 await ctrl.setOnline(true,'vehicle_a',4);
 await ctrl.respond(item,'accept');assert.equal(accepted,1);assert.equal(ctrl.snapshot().offers[0].status,'PENDING');
 ctrl.disconnect();await assert.rejects(ctrl.refresh(),e=>e.code==='DISCONNECTED');
 ctrl.reconnect();await ctrl.refresh();assert.equal(ctrl.snapshot().current.online,true);
 now=1200;await assert.rejects(ctrl.respond(item,'accept'),e=>e.code==='OFFER_EXPIRED');
});
test('lost network and malformed provider responses fail closed',async()=>{
 const ctrl=createDriverAvailabilityController({api:{readAvailability:async()=>({driverId:'other'}),readOffers:async()=>[]},session,clock:()=>1000});
 await assert.rejects(ctrl.refresh());
 assert.equal(ctrl.snapshot().current,null);
});

test('new driver availability starts offline and can be initialized with explicit server-bound vehicle reference',async()=>{
 let called=0;
 const api={
  readAvailability:async()=>({driverId:'driver_a',vehicleId:null,online:false,revision:0,expiresAt:0}),
  readOffers:async()=>[],
  setAvailability:async body=>{called++;assert.equal(body.vehicleId,'vehicle_first');assert.equal(body.expectedRevision,0);
   return {driverId:'driver_a',vehicleId:'vehicle_first',online:true,revision:1,expiresAt:1060};}
 };
 const controller=createDriverAvailabilityController({api,session,clock:()=>1000,nonce:()=> 'init_command'});
 const result=await controller.refresh();
 assert.equal(result.current.online,false);
 const online=await controller.setOnline(true,'vehicle_first',4);
 assert.equal(online.active,true);assert.equal(called,1);
});
