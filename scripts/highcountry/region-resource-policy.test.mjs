import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('deployments/highcountry/region-resource-policy.v1.json','utf8'));
test('three founders and six valid controls',()=>{assert.deepEqual(p.regions.map(r=>r.id),[1,2,3]);for(const r of p.regions){assert.equal(r.summer.length,6);r.summer.forEach((v,i)=>assert.ok(Number.isInteger(v)&&v>=(i===0?1000:0)&&v<=(i===0?4000:10000)));}});
test('no fabricated approved consumptions or deployed rulesets',()=>{assert.equal(p.conversionRates,null);assert.equal(p.weatherTransitions,null);assert.equal(p.equipmentCosts,null);assert.equal(p.derivedCanonicalRulesetIds,null);assert.equal(p.foundingGenesisUnchanged,true);});
