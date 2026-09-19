import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNEYS,qualifyJourney,qualifyAllJourneys,assertQualifiedBinding} from '../core/journey-gates.js';
const viewer='0x1111111111111111111111111111111111111111';
const session={viewer,connected:true,supportedNetwork:true,canonicalRefresh:true};
const binding={qualified:true,available:true,version:'bg-qualified-v1'};
const bound=name=>Object.fromEntries(JOURNEYS[name].requires.map(key=>[key,binding]));
test('BG-19.14: no journey is ready merely because its route renders',()=>{
 const report=qualifyAllJourneys(session);
 assert.equal(report.length,Object.keys(JOURNEYS).length);
 assert.ok(report.every(row=>row.ready===false));
 assert.ok(report.find(row=>row.name==='games').missing.includes('gameDetailRead'));
});
test('BG-19.14: qualified bindings and canonical refresh are independently required',()=>{
 const bindings=bound('games');
 assert.equal(qualifyJourney('games',{...session,bindings}).ready,true);
 assert.equal(qualifyJourney('games',{...session,bindings,canonicalRefresh:false}).ready,false);
 assert.equal(qualifyJourney('games',{...session,bindings:{...bindings,gameDetailRead:{qualified:false,available:true,version:'v1'}}}).ready,false);
});
test('BG-19.14: session downgrade denies account-scoped journeys',()=>{
 const bindings=bound('rewards');
 for(const change of [{connected:false},{supportedNetwork:false},{viewer:null},{viewer:'attacker'}]){
  const result=qualifyJourney('rewards',{...session,bindings,...change});
  assert.equal(result.ready,false);
  assert.ok(result.missing.includes('walletSession'));
 }
});
test('BG-19.14: public page visibility requires HTTP policy without wallet',()=>{
 const bindings=bound('publicPages');
 assert.equal(qualifyJourney('publicPages',{bindings}).ready,true);
 assert.equal(qualifyJourney('publicPages',{bindings:{...bindings,httpVisibilityStatus:null}}).ready,false);
});
test('BG-19.14: binding registry rejects unqualified or unknown authority',()=>{
 assert.throws(()=>assertQualifiedBinding('arbitrary',binding),/unknown binding/);
 assert.throws(()=>assertQualifiedBinding('gameWrite',{qualified:true,available:true}),/unqualified binding/);
 assert.equal(assertQualifiedBinding('gameWrite',binding).authoritative,false);
 assert.throws(()=>qualifyJourney('unknown'),/unknown journey/);
});
