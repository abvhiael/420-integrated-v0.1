import test from 'node:test';
import assert from 'node:assert/strict';
import {createHttpHandler} from '../src/http.mjs';
const seen=[];
const safety={
 async report(token,id,body){seen.push(['report',token,id,body]);return {incidentId:'case_1',status:'REPORTED'};},
 async resolve(token,id,body){seen.push(['resolve',token,id,body]);return {tripId:id,state:'CANCELLED'};},
 async read(token,id){seen.push(['read',token,id]);return {tripId:id,incidents:[],resolution:null};}
};
const handler=createHttpHandler({},undefined,undefined,undefined,undefined,safety);
const url='https://liftd.example/v1/rideshare/trips/trip_1/safety';
const headers={authorization:'Bearer a.b.c','content-type':'application/json'};
const send=(route,body)=>handler(new Request(url+route,{method:'POST',headers,body:JSON.stringify(body)}));
test('safety report and resolve use protected no-store HTTP route',async()=>{
 const a=await send('/report',{commandId:'one',category:'medical'});
 assert.equal(a.status,200);assert.equal(a.headers.get('cache-control'),'no-store');
 const b=await send('/resolve',{commandId:'two',incidentId:'case_1',expectedRevision:4,resolution:'interrupted'});
 assert.equal(b.status,200);assert.equal(seen[1][0],'resolve');assert.equal(seen[1][2],'trip_1');
 const c=await handler(new Request(url+'/case',{headers}));assert.equal(c.status,200);
 assert.equal(c.headers.get('cache-control'),'no-store');
});
test('safety HTTP rejects missing bearer, malformed body, unsupported methods and query data',async()=>{
 assert.equal((await handler(new Request(url+'/case'))).status,401);
 assert.equal((await handler(new Request(url+'/report?expand=1',{method:'POST',headers,body:'{}'}))).status,400);
 assert.equal((await handler(new Request(url+'/resolve',{method:'GET',headers}))).status,405);
 assert.equal((await handler(new Request(url+'/report',{method:'POST',headers,body:'not-json'}))).status,400);
 assert.equal((await handler(new Request(url+'/report',{method:'POST',headers,body:'{}'}))).status,200);
});
