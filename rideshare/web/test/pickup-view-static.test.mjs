import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
test('rider preview uses explicit device permission, manual fallback and safe DOM text rendering',()=>{
 const s=readFileSync(new URL('../pickup-view.mjs',import.meta.url),'utf8');
 for(const term of ['Use my current location (optional)','Manual entry remains available','manual','aria-live','textContent','Preview route','Pickup clarification','not a booking'])assert.ok(s.toLowerCase().includes(term.toLowerCase()),term);
 assert.equal(s.includes('innerHTML'),false);assert.equal(s.includes('localStorage'),false);
});
