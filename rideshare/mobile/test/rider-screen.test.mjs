import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const screen=readFileSync(new URL('../src/RiderScreen.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
test('rider path renders accessible controls and blocked preview',()=>{
 for(const phrase of ['Pickup address','Destination address','Prepare route','Request fare quote','Accept fare terms and request ride','Refresh trip','Cancel eligible trip','Safety report details','Account preferences'])assert.ok(screen.includes(phrase),phrase);
 assert.match(screen,/accessibilityState=\{\{disabled:!enabled\}\}/);
 assert.match(screen,/NONPRODUCTION PREVIEW/);
 assert.match(app,/state.route==='rider'\?<RiderScreen\/>/);
});
test('no fabricated demo server, canned confirmed ride or automatic payment',()=>{
 assert.doesNotMatch(screen,/(https?:\/\/|fetch\(|automaticPayment|fakeDriver)/);
});
