import test from 'node:test';
import assert from 'node:assert/strict';
import qrcode from '../../extension/vendor/qrcode.mjs';
import {normalizeExtensionAddress420} from '../core/extension-wallet-ui.js';
const address='0x'+'12'.repeat(20);
test('offline QR encoder represents the canonical receive address',()=>{
 const qr=qrcode(0,'M');
 qr.addData(normalizeExtensionAddress420(address),'Byte');
 qr.make();
 const n=qr.getModuleCount();
 assert.ok(n>=21&&n<=177);
 assert.equal(qr.isDark(0,0),true);
 assert.equal(qr.isDark(0,6),true);
 assert.equal(qr.isDark(6,0),true);
});
test('receive QR only accepts verified address input and never a name placeholder',()=>{
 assert.throws(()=>normalizeExtensionAddress420('someone.eth'),/valid nonzero EVM address/);
 assert.throws(()=>normalizeExtensionAddress420('alice.420'),/valid nonzero EVM address/);
 assert.throws(()=>normalizeExtensionAddress420('0x'+'0'.repeat(40)),/valid nonzero EVM address/);
});
