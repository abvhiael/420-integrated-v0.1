import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const live=JSON.parse(readFileSync('config/genesis-applications.json','utf8'));
const archive=JSON.parse(readFileSync('config/genesis-application-decision-2.json','utf8'));
assert.equal(archive.schema,'420-genesis-expansion-decision-v1');
assert.equal(archive.decision_id,'GENESIS_APPLICATION_DECISION_2');
assert.equal(archive.status,'CATALOG_INCLUSION_AUTHORIZED_RELEASE_GATED');
assert.equal(archive.immutable_prior_catalog_entries,22);
assert.equal(archive.entries.length,29);
assert.equal(new Set(archive.entries.map(x=>x.name)).size,29);
assert.equal(live.apps.length,22,'frozen authoritative Genesis catalogue must not be silently enlarged');
assert(live.apps.some(x=>x.name==='420 Gaming Protocol'));
assert(live.amendments.some(x=>/ARCADE_DEFERRAL/.test(x.id)),'preserve explicit Arcade deferral');
assert(live.apps.some(x=>x.name==='420 Pay'),'preserve current Pay protocol/app registration');
for(const app of archive.entries){
 assert.equal(app.release_enabled,false,'historical candidate must remain release gated: '+app.name);
 assert(['GENESIS_USER_APP','GENESIS_PROTOCOL_AND_USER_APP'].includes(app.class));
 assert(typeof app.existing_authority==='string'&&app.existing_authority.length);
 assert(typeof app.scope==='string'&&app.scope.length);
}
assert(archive.principles.some(x=>x.includes('not deployment')));
console.log('PASS: archived Decision #2 retains 29 release-disabled registrations without changing frozen current Genesis catalogue');
