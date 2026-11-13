import test from 'node:test';
import assert from 'node:assert/strict';
import {formatExtensionUnitsExact420} from '../core/extension-wallet-ui.js';
test('Max preserves exact full-precision ERC-20 value',()=>{
  assert.equal(formatExtensionUnitsExact420('1234567890123456789',18),'1.234567890123456789');
  assert.equal(formatExtensionUnitsExact420('1000000',6),'1');
  assert.equal(formatExtensionUnitsExact420('1',6),'0.000001');
  assert.equal(formatExtensionUnitsExact420('42',0),'42');
});
test('Max rejects unverified raw amounts and invalid decimals',()=>{
  assert.throws(()=>formatExtensionUnitsExact420('0x10',18),/verified raw balance/);
  assert.throws(()=>formatExtensionUnitsExact420('-1',18),/verified raw balance/);
  assert.throws(()=>formatExtensionUnitsExact420('1',256),/invalid token decimals/);
});
