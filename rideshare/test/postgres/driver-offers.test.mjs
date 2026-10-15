import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {fixture,generateRoots} from './dispatch-fixture.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real isolated PostgreSQL mandatory');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
const control={now:100,encryptionKey:Buffer.alloc(32,7).toString('base64'),paused:false};
const pairs=generateRoots();let app;
before(async()=>{
 assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,'liftd_qualification');
 await migrate(owner);
 app=fixture(owner,pairs,control);
});
after(async()=>{await owner.end();});
const token=(driver,trip='dispatch_account')=>app.token('driver',driver,trip);
async function make(name,driver='driver_offer_a'){
 await app.online(driver,'vehicle_offer_a');
 await app.create(name);
 await app.transition('operator','operator_dispatch',name,'match',0);
 const snap=await app.tripStore.get(name);
 assert.equal(snap.driverId,driver);
 return snap;
}
test('server read is private, offer state bound to driver and session',async()=>{
 const t=await make('offer_case_read');
 const got=await app.driverOfferService.readOffers(token('driver_offer_a'),'driver_offer_a');
 assert.ok(got.some(o=>o.offerId===t.id&&o.status==='PENDING'&&o.revision===1));
 await assert.rejects(app.driverOfferService.readOffers(token('driver_foreign'),'driver_offer_a'),e=>e.code==='PERMISSION_DENIED');
 const availability=await app.driverOfferService.readAvailability(token('driver_offer_a'),'driver_offer_a');
 assert.equal(availability.online,true);
 await assert.rejects(app.driverOfferService.readAvailability(token('driver_foreign'),'driver_offer_a'),e=>e.code==='PERMISSION_DENIED');
});
test('accept is an atomic lease acknowledgment, not arrival, and exact-command replay is safe',async()=>{
 const t=await make('offer_case_accept','driver_offer_b');
 const request={tripId:t.id,offerId:t.id,expectedRevision:1,decision:'accept',commandId:'accept_unique'};
 const a=await app.driverOfferService.respondOffer(token('driver_offer_b',t.id),'driver_offer_b',t.id,request);
 assert.equal(a.status,'ACCEPTED');assert.equal(a.tripState,'ASSIGNED');
 assert.deepEqual(await app.driverOfferService.respondOffer(token('driver_offer_b',t.id),'driver_offer_b',t.id,request),a);
 assert.equal((await app.tripStore.get(t.id)).state,'ASSIGNED');
 assert.equal((await owner.query('SELECT state FROM liftd.assignment_leases WHERE trip_id=$1',[t.id])).rows[0].state,'ACCEPTED');
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_b',t.id),'driver_offer_b',t.id,{...request,decision:'reject'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 await app.transition('driver','driver_offer_b',t.id,'arrive',1);
 assert.equal((await app.tripStore.get(t.id)).state,'ARRIVED');
});
test('reject atomically closes lease and cancels rider trip with durable event and revision',async()=>{
 const t=await make('offer_case_reject','driver_offer_c');
 const request={tripId:t.id,offerId:t.id,expectedRevision:1,decision:'reject',commandId:'reject_unique'};
 const response=await app.driverOfferService.respondOffer(token('driver_offer_c',t.id),'driver_offer_c',t.id,request);
 assert.equal(response.status,'REJECTED');assert.equal(response.tripState,'CANCELLED');
 assert.equal((await app.tripStore.get(t.id)).state,'CANCELLED');
 assert.equal((await owner.query('SELECT state FROM liftd.assignment_leases WHERE trip_id=$1',[t.id])).rows[0].state,'CLOSED');
 const events=await app.tripStore.history(t.id);
 assert.equal(events.at(-1).action,'offer_reject');
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_c',t.id),'driver_offer_c',t.id,{...request,commandId:'fresh_reject'}));
});
test('late accept, session revoked, paused operation and stale revision fail closed',async()=>{
 const t=await make('offer_case_expire','driver_offer_d');
 const request={tripId:t.id,offerId:t.id,expectedRevision:1,decision:'accept',commandId:'late_offer'};
 control.now=131;
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_d',t.id),'driver_offer_d',t.id,request),e=>e.code==='OFFER_EXPIRED');
 control.now=100;
 control.revokedSessions=['driver_offer_d'];
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_d',t.id),'driver_offer_d',t.id,request));
 control.revokedSessions=[];
 control.paused=true;
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_d',t.id),'driver_offer_d',t.id,request));
 control.paused=false;
 await assert.rejects(app.driverOfferService.respondOffer(token('driver_offer_d',t.id),'driver_offer_d',t.id,{...request,expectedRevision:0}),e=>e.code==='OFFER_EXPIRED');
});
test('two simultaneous different acceptance commands commit only one',async()=>{
 const t=await make('offer_case_race','driver_offer_e');
 const req=k=>({tripId:t.id,offerId:t.id,expectedRevision:1,decision:'accept',commandId:k});
 const outcomes=await Promise.allSettled([app.driverOfferService.respondOffer(token('driver_offer_e',t.id),'driver_offer_e',t.id,req('race1')),
 app.driverOfferService.respondOffer(token('driver_offer_e',t.id),'driver_offer_e',t.id,req('race2'))]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM liftd.offer_commands WHERE offer_id=$1',[t.id])).rows[0].n,1);
});
test('protected HTTP offer read/response rejects absent credentials, cross-role, forged route and method',async()=>{
 const t=await make('offer_case_http','driver_offer_f');
 const url='https://liftd.example/v1/rideshare/drivers/driver_offer_f/offers';
 const missing=await app.handler(new Request(url));assert.equal(missing.status,401);
 const tokenF=token('driver_offer_f',t.id);
 const result=await app.handler(new Request(url,{headers:{authorization:'Bearer '+tokenF}}));
 assert.equal(result.status,200);
 assert.equal((await result.json())[0].offerId,t.id);
 const noPost=await app.handler(new Request(url,{method:'POST',headers:{authorization:'Bearer '+tokenF}}));
 assert.equal(noPost.status,405);
 const cross=await app.handler(new Request(url,{headers:{authorization:'Bearer '+token('driver_other')}}));
 assert.equal(cross.status,403);
});
