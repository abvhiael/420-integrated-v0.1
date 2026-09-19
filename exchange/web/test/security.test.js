import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReviewedIntentUnchanged, assertTrustedExternalUrl, freezeReviewedIntent, reviewedIntentDigest, sanitizePathname, sanitizeSubjectId, trustedOrigin } from '../core/security.js';

test('subject IDs reject script/HTML/query payloads',()=>{
  assert.equal(sanitizeSubjectId('demo-420-usd'),'demo-420-usd');
  assert.throws(()=>sanitizeSubjectId('<script>alert(1)</script>'));
  assert.throws(()=>sanitizeSubjectId('a?b=c'));
});

test('path sanitizer rejects encoded slash/backslash tricks',()=>{
  assert.equal(sanitizePathname('/market'),'/market');
  assert.equal(sanitizePathname('javascript:alert(1)'),'/');
  assert.equal(sanitizePathname('/%2fadmin'),'/');
});

test('runtime external URLs forbid insecure schemes and embedded credentials',()=>{
  assert.equal(assertTrustedExternalUrl('https://api.example.invalid/exchange'),'https://api.example.invalid/exchange');
  assert.throws(()=>assertTrustedExternalUrl('http://api.example.invalid'));
  assert.throws(()=>assertTrustedExternalUrl('https://user:pass@example.invalid'));
});

test('production origin allowlist is exact',()=>{
  assert.equal(trustedOrigin('https://exchange.420integrated.org/swap'),true);
  assert.equal(trustedOrigin('https://evil.example/exchange.420integrated.org'),false);
});

test('reviewed intents are frozen and tamper-detectable',()=>{
  const frozen=freezeReviewedIntent({kind:'SWAP',route:{id:'r1'},amount:10});
  assert.equal(Object.isFrozen(frozen),true);
  assert.equal(Object.isFrozen(frozen.route),true);
  const digest=reviewedIntentDigest(frozen);
  assert.equal(assertReviewedIntentUnchanged(frozen,digest),true);
  assert.throws(()=>assertReviewedIntentUnchanged({...frozen,amount:11},digest));
});
