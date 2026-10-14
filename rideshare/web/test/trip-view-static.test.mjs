import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
test('rider trip view labels only authoritative events and no unscoped contact',()=>{
 const s=readFileSync(new URL('../trip-experience-view.mjs',import.meta.url),'utf8');
 for(const word of ['Confirmed state','Driver ID','Vehicle ID','ARRIVED','IN_PROGRESS','COMPLETED','Refresh confirmed status','Cancel trip','Report incident','Contact: available only','not confirmed events'])assert.ok(s.includes(word),word);
 assert.ok(!s.includes('innerHTML'));assert.ok(!s.includes('localStorage'));assert.ok(!s.includes('tel:'));
});
