import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coverageResult,STATES} from '../coverage.mjs';
const test=(region,projection,when)=>coverageResult(region,projection,when);
assert.deepEqual(STATES,['AVAILABLE','LIMITED','UNAVAILABLE','UNKNOWN']);
for(const region of ['VANCOUVER','OTHER',undefined,'../../orders','',null]){
 const result=test(region);
 assert.equal(result.state,'UNKNOWN');assert.ok(!('courier_id' in result));assert.ok(!('coordinates' in result));
}
const now=new Date('2026-10-11T01:00:00.000Z');
for(const p of [null,{}, {operationally_authorized:true,region_code:'VANCOUVER',availability:'AVAILABLE',expires_at:'2026-10-12T01:00:00Z',policy_version:'v1'},
{operationally_authorized:true,region_code:'VANCOUVER',availability:'AVAILABLE',expires_at:'2026-10-10T01:00:00Z',policy_version:'v1'}])
 assert.equal(test('VANCOUVER',p,now).state,'UNKNOWN');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const needle of ['id="coverage-form"','id="coverage-response"','aria-live="polite"','coverage-ui.mjs','No orders','no delivery eligibility','id="support"']){
 assert.ok(html.toLowerCase().includes(needle.toLowerCase()),needle);
}
assert.ok(!/<input[^>]+(?:name|id)="(?:address|postcode|postal|email|phone|dob)"/i.test(html));
assert.ok(!/<form[^>]+action=/i.test(html));
console.log('R03.2 safe coverage/discovery/support negative checks PASS');
