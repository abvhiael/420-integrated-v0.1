// OT-SCREEN-00: execute in the repository checkout, no network or external services.
// Verifies source bytes against Git blob identity and SHA-256, never substitutes chat art.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const registry=JSON.parse(readFileSync(new URL('../../deployments/highcountry/old-town-genesis-assets.json',import.meta.url)));
const root=new URL('../../',import.meta.url);
test('20 original canonical exterior PNGs match recorded blob identities and SHA-256',()=>{
 assert.equal(registry.assets.length,20);
 for(const a of registry.assets){
  const bytes=readFileSync(new URL(a.repoPath,root));
  const blob=createHash('sha1').update('blob '+bytes.length+'\\0').update(bytes).digest('hex');
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(blob,a.gitBlobSha,a.id+' source blob changed');
  assert.match(a.sha256??'',/^[a-f0-9]{64}$/,a.id+' missing canonical SHA-256');
  assert.equal(sha,a.sha256,a.id+' source SHA-256 changed');
 }
 assert.equal(registry.qualifiedForLock,true,'lock must be explicitly approved after all 20 match');
});
