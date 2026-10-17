import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripCommunicationService,safeTripUpdate,allowedNotification} from '../src/trip-communications.mjs';
import {createHttpHandler} from '../src/http.mjs';
const trip=()=>({id:'trip_1',riderId:'rider_1',driverId:'driver_1',vehicleId:'vehicle_1',routeRef:'route_1',state:'ASSIGNED',revision:1});
function setup(){
 let state=trip(), time=100,stop=false,consentEnabled=true,called=[],sent=0,published=[],prefs={rider_1:{tripNotifications:true,contactMethod:'email'},driver_1:{tripNotifications:false,contactMethod:'sms'}};
 const auth={authorize:async(token,{action,resource})=>{
  if(stop||!['rider_1','driver_1'].includes(token)||!['trip.message.read','trip.message.send','trip.read'].includes(action)||resource!=='trip:trip_1')throw Error('DENIED');
  return {role:token.startsWith('rider')?'rider':'driver',subject:token,accountId:'account_'+token,action,resource,expiresAt:time+40};
 }};
 const messenger={authorizeTrip:async x=>{called.push(x);return {...x,capability:'owner_signed_grant'};},
 send:async x=>{sent++;return {tripId:x.tripId,messageId:'message_1',status:'ACCEPTED'};},
 read:async x=>({messages:[{id:'message_1',tripId:x.tripId,sender:'driver_1',text:'Here'}],nextCursor:null})};
 const notifications={publish:async x=>{published.push(x);}};
 const consentGuard={require:async({token,accountId,purpose})=>{if(stop||!consentEnabled||token!=='rider_1'||accountId!=='account_rider_1'||purpose!=='trip_notifications')throw Error('CONSENT_DENIED');return {subject:'rider_1',accountId};}};
 const service=createTripCommunicationService({authenticator:auth,consentGuard,store:{get:async()=>state},messenger,notifications,preferencesFor:async id=>prefs[id],clock:()=>time});
 return {service,called,published,messenger,auth,setTrip:x=>{state=x},setTime:x=>{time=x},revoke:()=>{stop=true},getSends:()=>sent,setPreferences:x=>{prefs=x},revokeConsent:()=>{consentEnabled=false}};
}
test('owner-issued grants enforce trip, session, revision, expiry and recipient binding',async()=>{
 const x=setup();const r=await x.service.send('rider_1','trip_1',{commandId:'cmd_1',text:'At pickup'});
 assert.deepEqual(r,{messageId:'message_1',status:'ACCEPTED'});
 assert.equal(x.called[0].recipient,'driver_1');assert.equal(x.called[0].tripRevision,1);
 assert.equal(x.called[0].expiresAt,140);
 await assert.rejects(()=>x.service.send('other','trip_1',{commandId:'cmd_2',text:'Hello'}));
 await assert.rejects(()=>x.service.send('driver_1','other',{commandId:'cmd_2',text:'Hello'}));
 x.setTrip({...trip(),state:'COMPLETED'});await assert.rejects(()=>x.service.read('rider_1','trip_1'));
 x.setTrip({...trip(),driverId:'different'});await assert.rejects(()=>x.service.read('driver_1','trip_1'));
 x.setTrip({...trip(),revision:2});await x.service.send('rider_1','trip_1',{commandId:'cmd_3',text:'Hello'});
 assert.equal(x.called.at(-1).tripRevision,2);
 x.revoke();await assert.rejects(()=>x.service.send('rider_1','trip_1',{commandId:'cmd_4',text:'Hello'}));
});
test('tampered, stale and expired Messenger grants fail closed before delivery',async()=>{
 const x=setup();x.messenger.authorizeTrip=async req=>({...req,recipient:'outsider',capability:'bogus'});
 await assert.rejects(()=>x.service.send('rider_1','trip_1',{commandId:'a',text:'Hello'}),{code:'MESSENGER_AUTHORITY_UNAVAILABLE'});
 assert.equal(x.getSends(),0);
 x.messenger.authorizeTrip=async req=>({...req,capability:'cap',expiresAt:101});
 x.setTime(102);await assert.rejects(()=>x.service.read('rider_1','trip_1'),{code:'MESSENGER_AUTHORITY_UNAVAILABLE'});
});
test('negative boundaries reject malformed contents and unsafe Messenger results',async()=>{
 const x=setup();
 for(const value of ['', 'x'.repeat(1001),'new\nline'])await assert.rejects(()=>x.service.send('rider_1','trip_1',{commandId:'key',text:value}));
 await assert.rejects(()=>x.service.send('rider_1','trip_1',{commandId:'key',text:'ok',extra:'secret'}));
 await assert.rejects(()=>x.service.read('rider_1','trip_1','https://bad'));
 x.messenger.read=async()=>({messages:[{id:'msg_1',tripId:'other',sender:'driver_1',text:'secret'}]});
 await assert.rejects(()=>x.service.read('rider_1','trip_1'),{code:'MESSENGER_INVALID_RESPONSE'});
});
test('notification payload has no location, message, payment or identity and respects opt-out',async()=>{
 const x=setup();const response=await x.service.notifyTripEvent({tripId:'trip_1',revision:1,actorToken:'rider_1'});
 assert.equal(response.accepted,1);assert.equal(x.published[0].channel,'email');
 assert.deepEqual(Object.keys(x.published[0].event).sort(),['revision','state','tripId','type']);
 assert.equal(JSON.stringify(x.published[0]).includes('route_1'),false);
 assert.equal(allowedNotification({tripNotifications:true,contactMethod:'none'}),null);
 x.setPreferences({rider_1:{tripNotifications:false,contactMethod:'email'},driver_1:{tripNotifications:false,contactMethod:'sms'}});
 assert.equal((await x.service.notifyTripEvent({tripId:'trip_1',revision:1,actorToken:'rider_1'})).accepted,0);
 await assert.rejects(()=>x.service.notifyTripEvent({tripId:'trip_1',revision:2,actorToken:'rider_1'}),{code:'EVENT_AUTHORITY_DENIED'});
});
test('communications HTTP never exposes endpoints without service and checks bearer/method',async()=>{
 const svc=setup().service;
 const handler=createHttpHandler({},null,null,null,null,null,null,null,null,null,svc);
 const url='https://liftd.example/v1/rideshare/trips/trip_1/messages';
 const unauthorized=await handler(new Request(url));assert.equal(unauthorized.status,401);
 const method=await handler(new Request(url,{method:'DELETE',headers:{authorization:'Bearer a.b.c'}}));assert.equal(method.status,405);
 const closed=createHttpHandler({},null,null,null,null,null,null,null,null,null);
 assert.equal((await closed(new Request(url))).status,503);
});

test('PT-01 consumer denies revoked consent and unavailable consent authority before notification',async()=>{
 const x=setup();x.revokeConsent();await assert.rejects(()=>x.service.notifyTripEvent({tripId:'trip_1',revision:1,actorToken:'rider_1'}));assert.equal(x.published.length,0);
});
