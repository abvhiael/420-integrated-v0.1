import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const a=read('docs/migration/MIG-0-source-file-provenance.json'),e=read('docs/migration/MIG-0-level3-evidence.json');
assert.equal(e.step,'MIG-0');assert.equal(e.qualification.level,3);
assert.equal(e.qualification.status,'CANDIDATE_PENDING_EXACT_SHA_CI');
assert.equal(a.files.length,a.sourceSnapshots.reduce((n,x)=>n+x.fileCount,0));
assert.equal(a.sourceSnapshots.length,3);assert.equal(new Set(a.files.map(f=>f.repository+':'+f.path)).size,a.files.length);
for(const s of a.sourceSnapshots){assert.equal(e.canonicalSourceTrees[s.repository],s.treeSha);assert.match(s.treeSha,/^[0-9a-f]{40}$/);}
for(const f of a.files){assert.match(f.blobSha,/^[0-9a-f]{40}$/);assert(f.size>=0);}
assert.equal(e.preservedEvidence.length,6);
for(const q of e.preservedEvidence){assert.match(q.sha,/^[0-9a-f]{40}$/);assert(q.run>0);}
assert(e.prs.some(p=>p.number===734)&&e.prs.some(p=>p.number===788));
assert(e.handoffToMIG1.length>=2&&e.handoffToMIG2.length>=2);
assert(e.qualification.notClaimed.includes('complete off-GitHub artwork'));
const godot=a.sourceSnapshots.find(s=>s.role==='primary-godot');assert.equal(godot.fileCount,196);
const unity=a.sourceSnapshots.find(s=>s.role==='legacy-unity');assert.equal(unity.fileCount,101);
const genesis=a.sourceSnapshots.find(s=>s.role==='genesis');assert(genesis.fileCount>1000);
console.log('PASS MIG-0 Level 3 source inventory and evidence: '+a.files.length+' tracked source files, exact tree references, previously green runs, PR snapshot, deferred migration gates.');
