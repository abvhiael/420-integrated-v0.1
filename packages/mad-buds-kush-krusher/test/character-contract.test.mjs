import test from 'node:test';
import assert from 'node:assert/strict';
import {KUSH_KRUSHER,KUSH_KRUSHER_ID,validateKushKrusherDefinition,KushKrusherRuntimeContract} from '../src/character-contract.mjs';
test('locked identity, physics intent and independent frozen profiles',()=>{
 assert.equal(KUSH_KRUSHER_ID,'kush-krusher');
 assert.equal(KUSH_KRUSHER.role,'demolition');
 assert.equal(KUSH_KRUSHER.ability.id,'wrecking-ball');
 assert.equal(validateKushKrusherDefinition(KUSH_KRUSHER),true);
 assert.equal(Object.isFrozen(KUSH_KRUSHER.physicsIntent),true);
 assert.throws(()=>validateKushKrusherDefinition({...KUSH_KRUSHER,id:'foreign'}),/identity/);
 assert.throws(()=>validateKushKrusherDefinition({...KUSH_KRUSHER,physicsIntent:{...KUSH_KRUSHER.physicsIntent,mass:5}}),/physics intent/);
 assert.throws(()=>validateKushKrusherDefinition({...KUSH_KRUSHER,profiles:{...KUSH_KRUSHER.profiles,collision:'other'}}),/profile/);
 assert.throws(()=>validateKushKrusherDefinition({...KUSH_KRUSHER,ability:{...KUSH_KRUSHER.ability,singleUsePerLaunch:false}}),/ability/);
});
test('valid character launch lifecycle with one airborne activation',()=>{
 const bud=new KushKrusherRuntimeContract();
 assert.equal(bud.characterId,KUSH_KRUSHER_ID);
 bud.load();bud.aim();bud.launch();bud.airborne();bud.activate();bud.impact();bud.settle();bud.resolve();bud.remove();bud.reset();
 assert.equal(bud.state,'Queued');assert.equal(bud.launchCount,1);
 bud.load();bud.aim();bud.launch();assert.equal(bud.abilityUsed,false);assert.equal(bud.launchCount,2);
});
test('invalid ordering and illegal second activation fail closed',()=>{
 const bud=new KushKrusherRuntimeContract();
 assert.throws(()=>bud.launch(),/invalid lifecycle/);
 assert.throws(()=>bud.activate(),/invalid lifecycle/);
 bud.load();bud.aim();bud.launch();
 assert.throws(()=>bud.activate(),/invalid lifecycle/);
 bud.airborne();bud.activate();bud.impact();bud.airborne();
 assert.throws(()=>bud.activate(),/already used/);
 assert.throws(()=>bud.reset(),/unresolved/);
 bud.impact();bud.settle();bud.resolve();
 assert.throws(()=>bud.activate(),/invalid lifecycle/);
});
