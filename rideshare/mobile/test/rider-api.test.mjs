import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderApi} from '../src/rider-api.mjs';
const tok='aaaa.bbbb.cccc';
test('rejects non-HTTPS and credentials in origin',()=>{
 for(const origin of ['http://example.org/','https://u:p@example.org/','https://example.org/?a=1','https://example.org/base/'])assert.throws(()=>createRiderApi({origin,accessToken:async()=>tok}),/UNAPPROVED_ENDPOINT/);
});
test('denies absent access token before network calls',async()=>{
 let called=0;const api=createRiderApi({origin:'https://liftd.example/',accessToken:async()=>null,fetchImpl:async()=>{called++;}});
 await assert.rejects(api.readTrip({subject:'rider1'},'trip1'),/SESSION_UNAVAILABLE/);assert.equal(called,0);
});
test('commands stay inside same origin, include bearer, deny redirects and cache',async()=>{
 const calls=[];const api=createRiderApi({origin:'https://liftd.example/',accessToken:async()=>tok,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({routeRef:'route1',distanceMeters:5,durationSeconds:3})};}});
 await api.prepareRoute({subject:'rider1'},{passengerCount:1},'command1');
 assert.equal(calls[0].url,'https://liftd.example/v1/rideshare/routes');
 assert.equal(calls[0].options.headers.authorization,'Bearer '+tok);
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');
 assert.equal(JSON.parse(calls[0].options.body).riderId,'rider1');
});
test('forged trip ID is rejected before a request leaves device',async()=>{
 let calls=0;const api=createRiderApi({origin:'https://liftd.example/',accessToken:async()=>tok,fetchImpl:async()=>{calls++;}});
 assert.throws(()=>api.readTrip({},'../admin'),/INVALID_IDENTIFIER/);assert.equal(calls,0);
});
test('oversized server responses fail closed',async()=>{
 const api=createRiderApi({origin:'https://liftd.example/',accessToken:async()=>tok,fetchImpl:async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=> 'x'.repeat(70000)})});
 await assert.rejects(api.readTrip({},'trip1'),/RESPONSE_TOO_LARGE/);
});
