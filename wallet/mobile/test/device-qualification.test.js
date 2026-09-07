import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { qualifyMobileDeviceManifest420 } from '../core/device-qualification.js';

function readManifest(name) {
  return JSON.parse(fs.readFileSync(new URL(`../platform/${name}.manifest.json`, import.meta.url), 'utf8'));
}

test('iOS manifest qualifies required secure capabilities', () => {
  const result = qualifyMobileDeviceManifest420(readManifest('ios'));
  assert.equal(result.platform, 'ios');
  assert.equal(result.secureStorage, 'keychain');
  assert.equal(result.qualified, true);
});

test('Android manifest qualifies required secure capabilities', () => {
  const result = qualifyMobileDeviceManifest420(readManifest('android'));
  assert.equal(result.platform, 'android');
  assert.equal(result.secureStorage, 'keystore');
  assert.equal(result.qualified, true);
});

test('device qualification rejects remote signer authority', () => {
  const manifest = readManifest('ios');
  manifest.security.remoteSignerAuthority = true;
  assert.throws(() => qualifyMobileDeviceManifest420(manifest), /remote signer authority must be disabled/);
});

test('device qualification rejects insecure transport', () => {
  const manifest = readManifest('android');
  manifest.security.cleartextTraffic = true;
  assert.throws(() => qualifyMobileDeviceManifest420(manifest), /cleartext traffic must be disabled/);
});
