import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {check} from './verify-r07-2.mjs';
const m=JSON.parse(fs.readFileSync('deployments/highcountry/r07-2.genesis.json','utf8'));const cp=()=>structuredClone(m);
test('canonical exact cardinality and unresolved state',()=>{assert.equal(check(m).structure,'PASS');assert.throws(()=>check(m,{complete:true}));});
test('reject missing or zero six-root entry',()=>{let x=cp();delete x.roots.rulesetRoot;assert.throws(()=>check(x));x=cp();x.roots.rulesetRoot='0x'+'0'.repeat(64);assert.throws(()=>check(x));});
test('reject mutated region count and ID',()=>{let x=cp();x.regions.pop();assert.throws(()=>check(x));x=cp();x.regions[2].id=2;assert.throws(()=>check(x));});
test('reject fake founder inventory',()=>{let x=cp();x.founders.pop();assert.throws(()=>check(x));x=cp();x.founders[0].loci.pop();assert.throws(()=>check(x));x=cp();x.founders[0].lineIdDomain='fabricated';assert.throws(()=>check(x));});
test('reject invalid and replayed parcel entries',()=>{const p={parcelId:1,regionId:1,owner:'0x'+'1'.repeat(40),growCapacity:1,parcelType:'0x'+'1'.repeat(64),metadataHash:'0x'+'2'.repeat(64),proof:[]};let x=cp();x.genesisParcels=[p,p];assert.throws(()=>check(x));x=cp();x.genesisParcels=[{...p,owner:'0x'+'0'.repeat(40)}];assert.throws(()=>check(x));});
test('fail closed on unapproved finalization',()=>{let x=cp();x.finalizationAuthorized=true;assert.throws(()=>check(x));});
