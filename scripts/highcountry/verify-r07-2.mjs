import fs from 'node:fs';import assert from 'node:assert/strict';
const hash=/^0x[0-9a-fA-F]{64}$/;const nonzero=x=>hash.test(x)&&BigInt(x)!==0n;
export function check(m,{complete=false}={}){
 assert.equal(m.schema,'highcountry-r07-2-genesis-v1');
 assert.deepEqual(Object.keys(m.roots).sort(),['manifestRoot','parameterRoot','rulesetRoot','landRoot','randomnessRoot','qualificationRoot'].sort());
 for(const [k,v] of Object.entries(m.roots)) if(v!==null)assert.ok(nonzero(v),'invalid root '+k);
 assert.deepEqual(m.regions.map(r=>r.id),[1,2,3]);
 const ids=new Set();
 for(const r of m.regions){assert.ok(!ids.has(r.id));ids.add(r.id);for(const key of ['metadataHash','climateProfileId','rulesetId'])if(r[key]!==null)assert.ok(nonzero(r[key]));}
 assert.equal(m.founders.length,16);
 for(const [i,g] of m.founders.entries()){
 assert.equal(g.index,i+1);assert.equal(g.lineIdDomain,'HC.FOUNDING.GENETIC_LINE.'+(i+1));assert.equal(g.loci.length,28);
 for(const key of ['genomeId','metadataHash'])if(g[key]!==null)assert.ok(nonzero(g[key]));
 for(const locus of g.loci)if(locus!==null)assert.ok(nonzero(locus),'invalid founder locus');
 }
 assert.equal(m.landMerkle.hashAlgorithm,'keccak256');assert.equal(m.landMerkle.proofRule,'sorted-pair');
 const parcels=new Set();
 for(const p of m.genesisParcels){assert.ok(Number.isSafeInteger(p.parcelId)&&p.parcelId>0);assert.ok(!parcels.has(p.parcelId),'duplicate parcel');parcels.add(p.parcelId);
 assert.ok([1,2,3].includes(p.regionId));assert.match(p.owner,/^0x[0-9a-fA-F]{40}$/);assert.ok(BigInt(p.owner)!==0n);
 assert.ok(Number.isSafeInteger(p.growCapacity)&&p.growCapacity>0);assert.ok(nonzero(p.parcelType)&&nonzero(p.metadataHash));
 assert.ok(Array.isArray(p.proof));for(const x of p.proof)assert.ok(nonzero(x));
 }
 assert.equal(m.finalizationAuthorized,false,'finalization must be held for independent authority');
 if(complete){for(const v of Object.values(m.roots))assert.ok(nonzero(v),'unresolved root');
 for(const r of m.regions)for(const k of ['metadataHash','climateProfileId','rulesetId'])assert.ok(nonzero(r[k]),'unresolved region');
 for(const g of m.founders){assert.ok(nonzero(g.genomeId)&&nonzero(g.metadataHash),'unresolved founder');for(const x of g.loci)assert.ok(nonzero(x),'unresolved locus');}
 assert.ok(m.genesisParcels.length>0,'no founding parcel approvals');assert.ok(nonzero(m.landMerkle.root),'unresolved land root');
 for(const v of Object.values(m.requiredApprovals))assert.equal(v,true,'missing approval');
 }
 return {structure:'PASS',ready:complete};
}
if(process.argv[1]?.endsWith('verify-r07-2.mjs')){const m=JSON.parse(fs.readFileSync('deployments/highcountry/r07-2.genesis.json','utf8'));check(m,{complete:process.argv.includes('--require-complete')});console.log('R07.2 structural template valid; no Genesis finalization authorized');}
