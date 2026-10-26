import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog,validateCatalog,resolveCultivar} from './seed-catalog.mjs';
const [catalog,archive]=loadCatalog();
test('complete catalog and every source panel reconcile',()=>assert.equal(validateCatalog(catalog,archive).sourcePanels,68));
const homes={
 'Emerald Coast':'Alaskan Thunder Fuck|Blue Dream|Green Crack|Granddaddy Purple|Pineapple Express|Durban Poison|Gelato|Super Silver Haze',
 'Golden Prairie':'Jack Herer|Northern Lights|Purple Haze|Sour Diesel|Blueberry|Chemdawg|Trainwreck|Girl Scout Cookies',
 'Red Mesa':'Acapulco Gold|Strawberry Cough|White Widow|Bubba Kush|OG Kush|Zkittlez|Afghan Kush'};
for(const [region,names] of Object.entries(homes)) test(`owner-approved common pool: ${region}`,()=>assert.deepEqual(catalog.cultivars.filter(e=>e.tier==='common'&&e.region===region).map(e=>e.name).sort(),names.split('|').sort()));
test('canonical founder IDs, names and regions remain exact',()=>assert.deepEqual(catalog.cultivars.filter(e=>e.tier==='exclusive').map(({id,name,region})=>({id,name,region})),archive.founders.map(({id,name,region})=>({id,name,region}))));
test('lookup preserves founder identities and handles normalized common names',()=>{assert.equal(resolveCultivar(catalog,' harvest moon ').id,'HC-F09');assert.equal(resolveCultivar(catalog,'EMERALD GHOST').id,'HC-F01');assert.equal(resolveCultivar(catalog,'crimson ghost').id,'HC-F16');assert.equal(resolveCultivar(catalog,'  blue   dream ').tier,'common');assert.equal(resolveCultivar(catalog,'unknown'),null);});
const mutations={
 'duplicate ID': c=>c.cultivars[17].id=c.cultivars[16].id,
 'founder alias hijack': c=>c.cultivars.find(e=>e.name==='Spirit Bear').aliases.push(' Emerald Ghost '),
 'wrong founder name': c=>c.cultivars[0].name='Spirit Bear',
 'new region': c=>c.cultivars[16].region='Northern Lights',
 'reserved namespace': c=>c.cultivars[16].id='HC-F17',
 'missing cultivar': c=>c.cultivars.pop(),
 'missing source panel': c=>c.cultivars.find(e=>e.sourceArt?.length>1).sourceArt.pop(),
 'duplicate source panel': c=>c.cultivars.find(e=>e.sourceArt).sourceArt.push(c.cultivars.find(e=>e.sourceArt).sourceArt[0]),
 'missing source': c=>c.sources.pop(),
 'invalid digest': c=>c.sources[0].sha256='no',
 'false registration claim': c=>c.cultivars[16].genomeStatus='registered',
 'invalid rename': c=>c.cultivars.find(e=>e.name==='Blue Moon').sourceArt.forEach(r=>r.contextualRename=false),
 'concept founder admission': c=>c.cultivars.find(e=>e.tier==='rare').sourceArt[0].founderIdIsInvalidForThisPanel=false
};
for(const [name,mutate] of Object.entries(mutations)) test(`reject ${name}`,()=>{const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateCatalog(c,archive));});
test('Northern Lights is common even on the mistaken founders sheet',()=>{const n=resolveCultivar(catalog,'Northern Lights');assert.equal(n.tier,'common');assert.ok(n.sourceArt.some(r=>r.sourceId==='seal-concept-b'));});
