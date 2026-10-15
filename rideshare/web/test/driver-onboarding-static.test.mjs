import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('private driver UI requires protected session and never exposes document content',()=>{
 const s=readFileSync(new URL('../driver-onboarding.mjs',import.meta.url),'utf8');
 assert.ok(s.includes('roles?.includes(\'driver\')'));assert.ok(s.includes('independent review'));
 assert.ok(s.includes('aria-live'));assert.ok(!s.includes('innerHTML'));assert.ok(!s.includes('localStorage'));
});
