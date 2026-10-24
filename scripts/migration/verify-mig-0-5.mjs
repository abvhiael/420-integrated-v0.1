import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),'utf8');
const d=JSON.parse(read('docs/migration/MIG-0.5-closeout.json'));
assert.equal(d.schema,'420-mig-0-5-closeout-v1');
assert.equal(d.step,'MIG-0.5');
assert.equal(d.qualification.passed,false,'No premature phase qualification');
assert.equal(d.priorQualifications.length,4);
const ids=new Set();
for(const q of d.priorQualifications){
  assert(!ids.has(q.step));ids.add(q.step);
  assert.match(q.head,/^[0-9a-f]{40}$/);
  assert(Number.isInteger(q.run) && q.run>0);
  assert.equal(q.result,'success');
  const text=read(q.record),parsed=JSON.parse(text);
  assert.equal(parsed.step,q.step,'Step mismatch in preserved record');
  assert(text.endsWith('\n'));
  console.log(q.step+' retained '+createHash('sha256').update(text).digest('hex'));
}
const e=JSON.parse(read('docs/migration/MIG-0.4-provenance-evidence.json'));
assert.equal(e.godotQualification.exactHeadSha,d.godotQualification.head);
assert.equal(e.godotQualification.workflowRun,d.godotQualification.binaryAndRuntimeRun);
assert.equal(e.binaryAssets.sha256VerifiedAgainstBytes,150);
assert(d.remainingGates.length>=6);
console.log('PASS MIG-0.5: prior scoped evidence and retained inventories reconciled');
