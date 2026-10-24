import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(new URL('../../docs/migration/MIG-0.3-pr-disposition.json',import.meta.url),'utf8'));
assert.equal(d.schema,'420-migration-pr-disposition-v1');
assert.equal(d.policy.noMergeOrCloseDuringDiscovery,true);
assert.equal(d.policy.doNotReinstateArcadeGenesis,true);
assert.equal(d.policy.retainGameProtocol,true);
const numbers=new Set(),destinations=new Set(['420-arcade','420-budtender','420-green-road','genesis']);
const actions=new Set(['preserve-transfer','review-and-transfer','reconcile-conflict','preserve-audit','review-only']);
for(const p of d.pullRequests){
 assert(Number.isSafeInteger(p.number)&&p.number>0);
 assert(!numbers.has(p.number),'Duplicate PR');numbers.add(p.number);
 assert.equal(p.url,'https://github.com/'+d.sourceRepository+'/pull/'+p.number);
 assert(destinations.has(p.destination));
 assert(actions.has(p.disposition));
 assert.equal(p.mergeAuthorized,false,'Discovery must not authorize merging');
 assert(typeof p.rationale==='string'&&p.rationale.length>10);
 assert(p.headSha===null||/^[0-9a-f]{40}$/.test(p.headSha));
}
for(const n of [780,771,715,621,561,151,788,734,791,792])assert(numbers.has(n),'Missing known PR '+n);
for(const n of [734,788])assert.equal(d.pullRequests.find(x=>x.number===n).disposition,'reconcile-conflict');
assert(d.unresolved.some(x=>x.includes('head SHA')),'Missing provenance blocker');
assert.equal(d.qualification.passed,false,'Do not claim CI PASS before workflow evidence');
console.log('MIG-0.3 static PR disposition assertions PASS: '+numbers.size+' PRs recorded; transfers not authorized.');
