import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('private driver UI requires protected session and never exposes document content',()=>{
 const s=readFileSync(new URL('../driver-onboarding.mjs',import.meta.url),'utf8');
 assert.ok(s.includes('roles?.includes(\'driver\')'));assert.ok(s.includes('independent review'));
 assert.ok(s.includes('aria-live'));assert.ok(!s.includes('innerHTML'));assert.ok(!s.includes('localStorage'));
});

test('protected driver workspace mounts onboarding with independently authenticated session adapter',()=>{
 const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 assert.match(app,/decision\.kind === "protected" && decision\.role === "driver"/);
 assert.match(app,/clearDriverOnboarding = mountDriverOnboarding\(root, session, createDriverOnboardingApi\(globalThis\.LIFTdSessionAdapter\)\)/);
 assert.match(app,/if \(clearDriverOnboarding\) \{ clearDriverOnboarding\(\); clearDriverOnboarding = null; \}/);
 assert.ok(!app.includes('localStorage'));
});
