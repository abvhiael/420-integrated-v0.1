import test from 'node:test';import assert from 'node:assert/strict';
import {entry,previewInput,validateSuggestions,routeDescriptor} from '../pickup-policy.mjs';
import {createPickupController} from '../pickup-controller.mjs';
const point=(label,latitude,longitude)=>({label,source:'manual',latitude,longitude,precision:'approximate'});
test('explicit manual input, pickup clarification and no cross-origin provider authority',()=>{
 assert.equal(entry({...point('Pickup here',49.28,-123.12),clarification:'North entrance'}).clarification,'North entrance');
 assert.equal(previewInput(point('Here',49.28,-123.12),point('There',49.29,-123.13)).kind,'ready');
 for(const value of [{label:'x',source:'manual'}, {label:'Valid location',source:'manual',latitude:91,longitude:0,precision:'exact'}, {label:'Good name',source:'provider'},Object.defineProperty({},'label',{get(){throw Error('unsafe')}})])assert.throws(()=>entry(value));
 assert.throws(()=>previewInput(point('Same',49,-123),point('Same',49,-123)));
 assert.throws(()=>validateSuggestions(Array(11).fill(point('Here',49,-123))));
 assert.deepEqual(routeDescriptor({routeRef:'test123',distanceMeters:1200,durationSeconds:300}),{routeRef:'test123',distanceMeters:1200,durationSeconds:300});
});
test('device location permission never requested implicitly; denial is recoverable',async()=>{
 let calls=0;
 const ctl=createPickupController({geolocate:async()=>{calls++;throw Error('denied');}});
 assert.equal(calls,0);assert.equal(ctl.permission(),false);
 await assert.rejects(ctl.requestLocationPermission(),e=>e.code==='LOCATION_UNAVAILABLE');
 assert.equal(calls,1);assert.equal(ctl.permission(),false);
 ctl.set('pickup',{label:'Typed location',source:'manual',clarification:'Front door'});
});
test('stale search results cannot override current input, provider failures are bounded',async()=>{
 let complete;const ctl=createPickupController({search:()=>new Promise(r=>{complete=r;})});
 const pending=ctl.suggestions('First query');ctl.cancelPending();complete([point('Old result',49,-123)]);
 await assert.rejects(pending,e=>e.code==='STALE_RESULTS');
 await assert.rejects(createPickupController().suggestions('abc'),e=>e.code==='PROVIDER_UNAVAILABLE');
});
test('manual entries resolve through adapter and preview via canonical route authority',async()=>{
 let captured;const ctl=createPickupController({
  resolveAddress:async x=>({...x,latitude:x.label.includes('pickup')?49.28:49.29,longitude:-123.12,precision:'approximate'}),
  prepareRoute:async p=>{captured=p;return{routeRef:'route123',distanceMeters:1700,durationSeconds:360};}
 });
 ctl.set('pickup',{label:'manual pickup',source:'manual',clarification:'Street entrance'});
 ctl.set('destination',{label:'manual destination',source:'manual'});
 assert.equal((await ctl.preview()).routeRef,'route123');
 assert.equal(captured.passengerCount,1);assert.equal(captured.pickup.latitude,49.28);
 await assert.rejects(createPickupController().preview(),e=>e.code==='INVALID_ENTRY');
});
