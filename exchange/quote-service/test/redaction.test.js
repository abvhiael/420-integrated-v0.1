import test from 'node:test';
import assert from 'node:assert/strict';
import {redact} from '../src/redaction.js';
test('PRE-04 recursive log redaction removes secret-bearing fields',()=>{
 const value=redact({authorization:'Bearer x',nested:{privateKey:'0xdead',safe:'ok'},cookie:'a=b'});
 assert.equal(value.authorization,'[REDACTED]');assert.equal(value.nested.privateKey,'[REDACTED]');assert.equal(value.nested.safe,'ok');assert.equal(value.cookie,'[REDACTED]');
});
