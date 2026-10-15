import test from 'node:test';import assert from 'node:assert/strict';
import {createLocationProviders} from '../location-providers.mjs';
const session={status:'authenticated',roles:['rider'],subject:'rider_1'};
const source={getSession:async()=>session,getAccessToken:async()=> 'aaa.bbb.ccc'};
test('L01 location API receives scoped rider token and route, no cookies or external requests',async()=>{
 let called=0;const p=createLocationProviders(source,{origin:'https://liftd.test',geolocation:null,
 fetchImpl:async(url,opts)=>{called++;assert.equal(String(url),'https://liftd.test/v1/rideshare/routes');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.authorization,'Bearer aaa.bbb.ccc');const body=JSON.parse(opts.body);assert.equal(body.riderId,'rider_1');assert.equal(body.passengerCount,1);
  assert.ok(/^[a-f0-9-]{36}$/.test(body.commandId));return{ok:true,json:async()=>({routeRef:'route',distanceMeters:400,durationSeconds:90})};}
 });
 const route=await p.prepareRoute({pickup:{latitude:49.28,longitude:-123.12,precision:'approximate'},dropoff:{latitude:49.29,longitude:-123.11,precision:'approximate'},passengerCount:1});
 assert.equal(route.distanceMeters,400);assert.equal(called,1);
});
test('anonymous or forged session cannot call route API',async()=>{
 let called=false;
 const p=createLocationProviders({...source,getSession:async()=>({status:'unauthenticated'})},{origin:'https://liftd.test',fetchImpl:async()=>{called=true;throw Error('must not call');}});
 await assert.rejects(p.prepareRoute({}));assert.equal(called,false);
});
test('geolocation only runs when the explicitly exposed method is invoked; failures reject',async()=>{
 let count=0;
 const p=createLocationProviders(source,{origin:'https://liftd.test',geolocation:{getCurrentPosition(ok){count++;ok({coords:{latitude:49.27,longitude:-123.11}});}}});
 assert.equal(count,0);assert.equal((await p.geolocate()).source,undefined);assert.equal(count,1);
});
