import test from 'node:test';
import assert from 'node:assert/strict';
import {TAXONOMY_VERSION,POLICY_VERSION,defineObjectType,eligibleEffects,defineModifierPolicy,defineTaxonomyCatalog,resolveCertifiedPolicy,validateModifierOutcome,checkStacking,assertRevealEligible} from '../src/object-taxonomy.js';
const type=(o={})=>({schemaVersion:TAXONOMY_VERSION,typeId:'artisan_bench',family:'artisan_equipment',roles:['crafting'],surfaces:['floor'],layers:['furniture'],decorative:true,qualified:true,qualificationRef:'signed_review_1',...o});
const policy=(o={})=>({schemaVersion:POLICY_VERSION,policyId:'artisan_policy',typeId:'artisan_bench',revision:1,origin:'creator',maxModifiers:2,perItemCapBps:500,effects:[{effectId:'crafting_efficiency',minBps:75,maxBps:175,weight:4},{effectId:'material_conservation',minBps:75,maxBps:175,weight:1}],qualified:true,qualificationRef:'policy_review_1',...o});
const bad=f=>assert.throws(f,/hc-econ-01:/);
test('immutable qualified catalogue, deterministic identity and eligible effects',()=>{
 const t=defineObjectType(type()),p=defineModifierPolicy(policy(),t);
 assert(Object.isFrozen(t.roles)&&Object.isFrozen(p.effects[0]));
 assert.deepEqual(eligibleEffects(t),['crafting_efficiency','material_conservation']);
 const a=defineTaxonomyCatalog({types:[type(),type({typeId:'chair',roles:['comfort']})],policies:[policy()]});
 const b=defineTaxonomyCatalog({types:[type({typeId:'chair',roles:['comfort']}),type()],policies:[policy()]});
 assert.equal(a.sha256,b.sha256);
 assert.equal(resolveCertifiedPolicy(a,{typeId:'artisan_bench',policyId:'artisan_policy',revision:1}).catalogSha256,a.sha256);
});
test('fail-closed geometry, qualification, semantic and shape validation',()=>{
 bad(()=>defineObjectType({...type(),extra:true}));
 bad(()=>defineObjectType(type({roles:['flying_speed']})));
 bad(()=>defineObjectType(type({roles:['crafting','crafting']})));
 bad(()=>defineObjectType(type({layers:['wall_decor']})));
 bad(()=>defineObjectType(type({surfaces:['floor','wall_slot']})));
 bad(()=>defineObjectType(type({qualified:false,qualificationRef:'signed_review_1'})));
 bad(()=>eligibleEffects(type({qualified:false,qualificationRef:null})));
 bad(()=>defineObjectType(type({decorative:false,roles:['display']})));
});
test('modifier policy rejects irrelevant, duplicate, over-budget and forged entries',()=>{
 bad(()=>defineModifierPolicy(policy({effects:[{effectId:'climate_stability',minBps:1,maxBps:5,weight:1}]}),type()));
 bad(()=>defineModifierPolicy(policy({perItemCapBps:200}),type()));
 bad(()=>defineModifierPolicy(policy({maxModifiers:4}),type()));
 bad(()=>defineModifierPolicy(policy({maxModifiers:3}),type()));
 bad(()=>defineModifierPolicy({...policy(),creatorOverride:true},type()));
 bad(()=>defineModifierPolicy(policy({effects:[policy().effects[0],policy().effects[0]]}),type()));
});
test('duplicate types/policies, missing types, tampered catalog and unqualified policies reject',()=>{
 bad(()=>defineTaxonomyCatalog({types:[type(),type()],policies:[]}));
 bad(()=>defineTaxonomyCatalog({types:[type()],policies:[policy(),policy()]}));
 bad(()=>defineTaxonomyCatalog({types:[],policies:[policy()]}));
 const c=defineTaxonomyCatalog({types:[type()],policies:[policy()]});
 bad(()=>resolveCertifiedPolicy({...c,sha256:'0'.repeat(64)},{typeId:'artisan_bench',policyId:'artisan_policy',revision:1}));
 bad(()=>resolveCertifiedPolicy(c,{typeId:'artisan_bench',policyId:'artisan_policy',revision:2}));
 bad(()=>resolveCertifiedPolicy(defineTaxonomyCatalog({types:[type()],policies:[policy({qualified:false,qualificationRef:null})]}),{typeId:'artisan_bench',policyId:'artisan_policy',revision:1}));
});
test('result requires independently valid effects and exact ranges; no RNG is performed here',()=>{
 const c=defineTaxonomyCatalog({types:[type()],policies:[policy()]});
 const resolved=resolveCertifiedPolicy(c,{typeId:'artisan_bench',policyId:'artisan_policy',revision:1});
 assert.equal(validateModifierOutcome(resolved,{effects:[{effectId:'crafting_efficiency',bps:175},{effectId:'material_conservation',bps:175}]}).totalBps,350);
 bad(()=>validateModifierOutcome(resolved,{effects:[{effectId:'crafting_efficiency',bps:150}]}));
 bad(()=>validateModifierOutcome(resolved,{effects:[{effectId:'crafting_efficiency',bps:250},{effectId:'crafting_efficiency',bps:100}]}));
 bad(()=>validateModifierOutcome(resolved,{effects:[{effectId:'crafting_efficiency',bps:251},{effectId:'material_conservation',bps:100}]}));
 bad(()=>validateModifierOutcome(resolved,{effects:[{effectId:'climate_stability',bps:100},{effectId:'material_conservation',bps:100}]}));
});
test('explicitly permitted purely decorative and zero-modifier object',()=>{
 const art=type({typeId:'wall_art',family:'decor',roles:['display'],layers:['wall_decor'],surfaces:['wall_slot']});
 const p=policy({policyId:'art_policy',typeId:'wall_art',maxModifiers:0,perItemCapBps:0,effects:[]});
 const c=defineTaxonomyCatalog({types:[art],policies:[p]});
 assert.equal(validateModifierOutcome(resolveCertifiedPolicy(c,{typeId:'wall_art',policyId:'art_policy',revision:1}),{effects:[]}).totalBps,0);
});
test('stack totals are capped and wrong effect families cannot stack',()=>{
 const items=Array.from({length:30},()=>({origin:'creator',effects:[{effectId:'crafting_efficiency',bps:100}]}));
 const r=checkStacking(type(),items);
 assert.equal(r.totals.crafting,3000);
 assert.equal(r.applied.crafting,500);
 bad(()=>checkStacking(type(),[{origin:'creator',effects:[{effectId:'climate_stability',bps:100}]}]));
 bad(()=>checkStacking(type(),[{effects:[{effectId:'crafting_efficiency',bps:-1}]}]));
});

test('ordinary marketplace policy is never above five percent and targets two to three percent',()=>{
 bad(()=>defineModifierPolicy(policy({perItemCapBps:501}),type()));
 bad(()=>defineModifierPolicy(policy({effects:[{effectId:'crafting_efficiency',minBps:200,maxBps:500,weight:1},{effectId:'material_conservation',minBps:100,maxBps:400,weight:1}]}),type()));
 bad(()=>defineModifierPolicy(policy({effects:[{effectId:'crafting_efficiency',minBps:20,maxBps:80,weight:1},{effectId:'material_conservation',minBps:20,maxBps:80,weight:1}]}),type()));
 const t=defineModifierPolicy(policy(),type());
 assert.equal(t.origin,'creator');
 assert.equal(t.perItemCapBps,500);
});
test('developer-made items have locked fixed policy values and do not stack',()=>{
 const fixed=defineModifierPolicy(policy({origin:'developer',maxModifiers:1,perItemCapBps:500,effects:[{effectId:'crafting_efficiency',minBps:300,maxBps:300,weight:1}]}),type());
 assert.equal(fixed.effects[0].minBps,fixed.effects[0].maxBps);
 bad(()=>defineModifierPolicy(policy({origin:'developer'}),type()));
 const dev={origin:'developer',effects:[{effectId:'crafting_efficiency',bps:300}]};
 assert.equal(checkStacking(type(),[dev]).applied.crafting,300);
 bad(()=>checkStacking(type(),[dev,dev]));
 bad(()=>checkStacking(type(),[dev,{origin:'creator',effects:[{effectId:'material_conservation',bps:150}]}]));
 bad(()=>checkStacking(type(),[dev,{origin:'quest',effects:[{effectId:'material_conservation',bps:900}]}]));
});
test('only quest-origin policy can exceed five percent; no ordinary override',()=>{
 const quest=defineModifierPolicy(policy({origin:'quest',maxModifiers:1,perItemCapBps:2000,effects:[{effectId:'crafting_efficiency',minBps:900,maxBps:900,weight:1}]}),type());
 const c=defineTaxonomyCatalog({types:[type()],policies:[quest]});
 const resolved=resolveCertifiedPolicy(c,{typeId:'artisan_bench',policyId:'artisan_policy',revision:1});
 assert.equal(validateModifierOutcome(resolved,{effects:[{effectId:'crafting_efficiency',bps:900}]}).totalBps,900);
 bad(()=>defineModifierPolicy(policy({origin:'creator',perItemCapBps:2000}),type()));
 bad(()=>defineModifierPolicy(policy({origin:'developer',perItemCapBps:2000}),type()));
});
test('creator modifier reveal must follow finalized purchase and verified issuer authority',()=>{
 bad(()=>assertRevealEligible({origin:'creator',purchaseFinalized:false,issuerAuthorized:true}));
 bad(()=>assertRevealEligible({origin:'creator',purchaseFinalized:true,issuerAuthorized:false}));
 assert.equal(assertRevealEligible({origin:'creator',purchaseFinalized:true,issuerAuthorized:true}),true);
});

test('authorized quest bonuses retain values above ordinary stack cap',()=>{
 const out=checkStacking(type(),[{origin:'creator',effects:[{effectId:'crafting_efficiency',bps:400}]},{origin:'quest',effects:[{effectId:'crafting_efficiency',bps:900}]}]);
 assert.equal(out.totals.crafting,400);
 assert.equal(out.questTotals.crafting,900);
 assert.equal(out.applied.crafting,1300);
});
