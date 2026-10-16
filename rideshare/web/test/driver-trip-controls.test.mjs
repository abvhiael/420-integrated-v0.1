import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverTripController} from '../driver-trip-controller.mjs';
import {createDriverTripApi} from '../driver-trip-api.mjs';
import {verifiedDriverTrip,validateNavigationHandoff} from '../driver-trip-policy.mjs';
const session={status:'authenticated',subject:'driver_1',roles:['driver']};
const base=Object.freeze({id:'trip_1',riderId:'rider_1',driverId:'driver_1',vehicleId:'vehicle_1',routeRef:'route_1',state:'ASSIGNED',revision:1});
function fixture(){
 let state=base,failed=false;const calls=[];
 const api={read:async()=>state,transition:async(id,cmd)=>{calls.push({...cmd});if(failed)throw Error('lost acknowledgment');
  state={...state,state:{arrive:'ARRIVED',start:'IN_PROGRESS',complete:'COMPLETED'}[cmd.action],revision:state.revision+1};},report:async()=>true};
 const ctl=createDriverTripController({api,session,nonce:()=>('key_'+(calls.length+1))});
 return {ctl,calls,set:x=>{state=x},fail:x=>{failed=x}};
}
test('driver trip controls require real confirmation and monotonic server revisions',async()=>{
 const x=fixture();await x.ctl.load('trip_1');
 assert.equal(x.ctl.snapshot().presentation.canArrive,true);
 await assert.rejects(()=>x.ctl.action('start'),{code:'TRANSITION_DENIED'});
 await x.ctl.action('arrive');assert.equal(x.ctl.snapshot().presentation.state,'ARRIVED');
 await assert.rejects(()=>x.ctl.action('start'),{code:'PICKUP_CONFIRMATION_REQUIRED'});
 x.ctl.confirmPickup(true);
 await x.ctl.action('start');assert.equal(x.ctl.snapshot().presentation.state,'IN_PROGRESS');
 await x.ctl.action('complete');assert.equal(x.ctl.snapshot().presentation.terminal,true);
 assert.deepEqual(x.calls.map(x=>x.action),['arrive','start','complete']);
 assert.deepEqual(x.calls.map(x=>x.expectedRevision),[1,2,3]);
 await assert.rejects(()=>x.ctl.action('complete'),{code:'TRANSITION_DENIED'});
});
test('cross-trip, cross-driver, same-revision mutation, rollback and forged states fail closed',async()=>{
 assert.throws(()=>verifiedDriverTrip({...base,driverId:'other'},session),{code:'UNAUTHORIZED_TRIP'});
 assert.throws(()=>verifiedDriverTrip({...base,state:'IN_PROGRESS'},session,base),{code:'STALE_TRIP'});
 assert.throws(()=>verifiedDriverTrip({...base,revision:0},session,base),{code:'STALE_TRIP'});
 assert.throws(()=>verifiedDriverTrip({...base,state:'ARRIVED',accessToken:'secret'},session),{code:'INVALID_TRIP'});
 const x=fixture();x.set({...base,id:'wrong'});await assert.rejects(()=>x.ctl.load('trip_1'),{code:'CROSS_TRIP_RESPONSE'});
});
test('failed command retains idempotency key; offline cannot dispatch; reconnect rereads',async()=>{
 const x=fixture();await x.ctl.load('trip_1');x.fail(true);
 await assert.rejects(()=>x.ctl.action('arrive'),/lost acknowledgment/);
 assert.equal(x.ctl.snapshot().pending,'arrive');
 x.ctl.disconnect();await assert.rejects(()=>x.ctl.action('arrive'),{code:'OFFLINE'});
 x.ctl.reconnect();x.fail(false);await x.ctl.reconcile();await x.ctl.action('arrive');
 assert.equal(x.calls[0].commandId,x.calls[1].commandId);
 assert.equal(x.ctl.snapshot().presentation.state,'ARRIVED');
});
test('ambiguous successful command must reconcile without replay or fabricating state',async()=>{
 let state=base;let requests=0;
 const ctl=createDriverTripController({session,nonce:()=> 'stable_1',api:{
  read:async()=>state,
  transition:async()=>{requests++;state={...state,state:'ARRIVED',revision:2};throw Error('network lost after commit');}
 }});
 await ctl.load('trip_1');await assert.rejects(()=>ctl.action('arrive'),/network lost/);
 await ctl.reconcile();assert.equal(ctl.snapshot().presentation.state,'ARRIVED');
 assert.equal(ctl.snapshot().pending,null);assert.equal(requests,1);
});
test('navigation handoff only uses correct trip, route and HTTPS and is never fabricated',async()=>{
 const x=fixture();await x.ctl.load('trip_1');
 await assert.rejects(()=>x.ctl.navigation(),{code:'NAVIGATION_UNAVAILABLE'});
 const expiry=Math.floor(Date.now()/1000)+60;
 assert.throws(()=>validateNavigationHandoff({tripId:'other',routeRef:'route_1',url:'https://maps.example/',expiresAt:expiry},base),{code:'NAVIGATION_UNAVAILABLE'});
 assert.throws(()=>validateNavigationHandoff({tripId:'trip_1',routeRef:'route_1',url:'javascript:alert(1)',expiresAt:expiry},base),{code:'NAVIGATION_UNAVAILABLE'});
 assert.throws(()=>validateNavigationHandoff({tripId:'trip_1',routeRef:'route_1',url:'https://evil:secret@maps.example/',expiresAt:expiry},base),{code:'NAVIGATION_UNAVAILABLE'});
 assert.equal(validateNavigationHandoff({tripId:'trip_1',routeRef:'route_1',url:'https://maps.example/route',expiresAt:expiry},base),'https://maps.example/route');
});
test('driver API requires verified session, request identity and same-origin no-redirect network transport',async()=>{
 const requests=[];
 const api=createDriverTripApi({getAccessToken:async()=> 'a.b.c'},{origin:'https://liftd.example',fetchImpl:async (u,o)=>{requests.push({u:String(u),o});return {ok:true,json:async()=>base}}});
 await api.read('trip_1');await api.transition('trip_1',{action:'arrive',expectedRevision:1,commandId:'key_1'});
 assert.equal(requests.length,2);assert.equal(requests[0].o.redirect,'error');assert.equal(requests[0].o.credentials,'omit');
 assert.equal(requests[1].o.method,'POST');
 assert.throws(()=>api.transition('trip_1',{action:'assign',expectedRevision:1,commandId:'key_2'}),/INVALID_COMMAND/);
 const invalid=createDriverTripApi({getAccessToken:async()=> 'unverified'},{origin:'https://liftd.example',fetchImpl:async()=>{throw Error('should not send')}});
 await assert.rejects(()=>invalid.read('trip_1'),/UNVERIFIED_SESSION/);
});
