import test from 'node:test';
import assert from 'node:assert/strict';
import {loadResearch,validateResearch} from './common-cultivar-research.mjs';
const [research,catalog]=loadResearch();
const entry=(r,name)=>r.cultivars.find(e=>e.canonicalName===name);
test('all 23 canonical commons and 25 Leafly records reviewed',()=>{const r=validateResearch(research,catalog);assert.equal(r.reviewedCultivars,23);assert.equal(r.reviewedSources,25);assert.ok(r.explicitGapResolutions>0);});
test('source profiles resolve to exact canonical names and slugs',()=>{for(const e of research.cultivars){const slug=e.canonicalName==='Girl Scout Cookies'?'gsc':e.canonicalName.toLowerCase().replaceAll(' ','-');assert.equal(e.sources[0].url,`https://www.leafly.com/strains/${slug}`);}});
test('source renaming does not create a new Z cultivar',()=>{const e=entry(research,'Zkittlez');assert.equal(e.cultivarId,'HC-C-zkittlez');assert.equal(e.sourceNameMappings[0].sourceName,'The Original Z');assert.equal(e.ancestry.status,'partial');assert.ok(e.ancestry.candidateParentSets[0].includes('undisclosed strain'));});
test('GSC intermediary is not silently changed to Durban Poison',()=>assert.deepEqual(entry(research,'Girl Scout Cookies').ancestry.candidateParentSets,[['OG Kush subtype','F1 Durban']]));
test('conflicting pedigrees remain separately attributed',()=>{const b=entry(research,'Blueberry');assert.equal(b.ancestry.status,'conflicting-reports');assert.equal(b.ancestry.candidateSourceIds.length,2);assert.ok(b.ancestry.candidateParentSets[1].includes('Afghani'));const g=entry(research,'Granddaddy Purple');assert.equal(g.ancestry.candidateParentSets.length,2);assert.equal(g.sources.length,2);});
test('unknown populations are not manufactured into two-parent crosses',()=>{for(const name of ['Acapulco Gold','Afghan Kush','Chemdawg','Durban Poison'])assert.deepEqual(entry(research,name).ancestry.candidateParentSets,[]);});
test('partial and legendary ancestors retain uncertainty',()=>{assert.equal(entry(research,'Alaskan Thunder Fuck').ancestry.status,'legend');assert.equal(entry(research,'Bubba Kush').ancestry.status,'uncertain');assert.equal(entry(research,'OG Kush').ancestry.status,'uncertain');assert.equal(entry(research,'Strawberry Cough').ancestry.status,'uncertain');});
test('Pineapple Express preserves panel/narrative terpene disagreement',()=>{const c=entry(research,'Pineapple Express').characteristics;assert.notDeepEqual(c.profileTerpenes,c.narrativeTerpenes);assert.deepEqual(c.narrativeTerpenes,['Caryophyllene','Limonene','Ocimene']);});
const changes={
 'missing common':r=>r.cultivars.pop(),
 'duplicate common':r=>r.cultivars[1]=structuredClone(r.cultivars[0]),
 'rare substituted':r=>r.cultivars[0].cultivarId='HC-R-spirit-bear',
 'region drift':r=>r.cultivars[0].canonicalRegion='Golden Prairie',
 'non-Leafly attribution':r=>r.cultivars[0].sources[0].url='https://example.com/strains/acapulco-gold',
 'publisher spoof':r=>r.cultivars[0].sources[0].publisher='Unknown',
 'missing review date':r=>delete r.cultivars[0].sources[0].reviewedOn,
 'dangling claim citation':r=>r.cultivars[0].history.sourceIds=['missing'],
 'missing uncertainty':r=>r.cultivars[0].uncertainty.notes='',
 'invented certainty':r=>r.cultivars[0].ancestry.biologicallyVerified=true,
 'invented parents':r=>r.cultivars[0].ancestry.candidateParentSets=[['invented','parents']],
 'lost alternate pedigree':r=>entry(r,'Blueberry').ancestry.candidateParentSets.pop(),
 'missing gap resolution':r=>r.cultivars[0].coverageGaps=[],
 'genome registration claim':r=>r.cultivars[0].genomeAdmission='registered',
 'embedded loci':r=>r.cultivars[0].loci=[],
 'source rename changes identity':r=>entry(r,'Zkittlez').sourceNameMappings[0].changesCanonicalIdentity=true,
 'false coverage summary':r=>r.coverage.missingProfiles=1
};
for(const [name,mutate] of Object.entries(changes))test(`reject ${name}`,()=>{const r=structuredClone(research);mutate(r);assert.throws(()=>validateResearch(r,catalog));});
