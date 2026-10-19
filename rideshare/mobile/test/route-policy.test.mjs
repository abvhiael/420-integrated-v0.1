import test from 'node:test';
import assert from 'node:assert/strict';
import {routeFor,previewState,screens} from '../src/route-policy.mjs';
test('unknown, absent and forged roles cannot enter either protected role preview',()=>{
 for(const role of [null,undefined,'operator','admin','Rider',{},0])for(const route of ['rider','driver'])
  assert.equal(routeFor(role,route),'welcome');
});
test('rider and driver previews are isolated from the opposing role and unknown routes',()=>{
 for(const role of ['rider','driver']){
  assert.equal(routeFor(role,role),role);
  for(const route of [role==='rider'?'driver':'rider','/driver','/rider','unknown',null])
   assert.equal(routeFor(role,route),'welcome');
 }
});
test('all preview states explicitly disable networking, payments and dispatch',()=>{
 for(const role of [null,'rider','driver','operator'])
 for(const route of Object.keys(screens)){
  const state=previewState(role,route);
  assert.equal(state.networkEnabled,false);
  assert.equal(state.paymentsEnabled,false);
  assert.equal(state.dispatchEnabled,false);
  assert.equal(state.authorized,state.route!=='welcome');
 }
});
