import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {validateOldTownLandmarks} from '../../apps/highcountry-web/src/old-town-landmarks.js';
const m=JSON.parse(readFileSync(new URL('../../deployments/highcountry/hc-world-pa-oldtown-landmark-hitboxes.v1.json',import.meta.url)));
test('five canonical landmarks and image-space polygons',()=>{assert.equal(validateOldTownLandmarks(m),true);assert.equal(new Set(m.landmarks.map(l=>l.id)).size,5)});
test('no saleable private public landmark titles',()=>{assert.equal(m.privateTitleSaleEnabled,false);for(const l of m.landmarks)assert.equal(l.questRewardsEnabled,false)});
test('out of bounds polygon rejected',()=>{const c=structuredClone(m);c.landmarks[0].polygon[0]=[2000,10];assert.throws(()=>validateOldTownLandmarks(c))});
test('duplicate landmark ids rejected',()=>{const c=structuredClone(m);c.landmarks[1].id=c.landmarks[0].id;assert.throws(()=>validateOldTownLandmarks(c))});
test('unknown reward/sale authority rejected',()=>{const c=structuredClone(m);c.privateTitleSaleEnabled=true;assert.throws(()=>validateOldTownLandmarks(c))});
