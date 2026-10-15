import test from 'node:test';import assert from 'node:assert/strict';
import {createScopedMessagingService} from '../src/scoped-messaging.mjs';
const trip={id:'trip_1',riderId:'rider_1',driverId:'driver_1',vehicleId:'vehicle_1',routeRef:'route_1',state:'ASSIGNED',revision:1};
function setup(){
 let state={...trip},issued=0,paused=false,now=100;
 const service=createScopedMessagingService({clock:()=>now,isPaused:()=>paused,
 authenticator:{authorize:async(t)=>{if(!['rider_1','driver_1','outsider'].includes(t))throw Error('unauthorized');
  return {subject:t,role:t.startsWith('rider')?'rider':'driver',expiresAt:130};}},
 tripStore:{get:async()=>state},
 messagingAuthority:{mint:async c=>{issued++;return{boundTripId:c.tripId,boundRevision:c.revision,
   boundRequester:c.requester,conversationId:'room_1',expiresAt:Math.min(c.expiresAt,125)};},
 revoke:async()=>true}});
 return {service,get issued(){return issued;},setState:v=>state=v,setPaused:v=>paused=v,setNow:v=>now=v};
}
test('assigned participant receives only short-lived trip/revision/identity bound handle',async()=>{
 const x=setup();const a=await x.service.open('rider_1',{tripId:'trip_1',commandId:'command_1'});
 assert.equal(a.conversationId,'room_1');assert.equal(a.expiresAt,125);
 assert.equal(JSON.stringify(a).includes('driver_1'),false);assert.equal(x.issued,1);
});
test('stranger, terminal trip, reassignment and outage all fail closed',async()=>{
 const x=setup();await assert.rejects(x.service.open('outsider',{tripId:'trip_1',commandId:'command_2'}));
 x.setState({...trip,state:'CANCELLED',revision:2});
 await assert.rejects(x.service.open('rider_1',{tripId:'trip_1',commandId:'command_3'}));
 x.setState({...trip});x.setPaused(true);
 await assert.rejects(x.service.open('driver_1',{tripId:'trip_1',commandId:'command_4'}));
 assert.equal(x.issued,0);
});
test('revoked/expired signed session and malformed request block minting',async()=>{
 const x=setup();x.setNow(130);
 await assert.rejects(x.service.open('rider_1',{tripId:'trip_1',commandId:'command_1'}));
 await assert.rejects(x.service.open('rider_1',{tripId:'bad/path',commandId:'command_1'}));
 assert.equal(x.issued,0);
});
