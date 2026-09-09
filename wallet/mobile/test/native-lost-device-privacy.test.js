import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidLost = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidLostDevice420.kt'), 'utf8');
const androidPrivacy = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidPrivacy420.kt'), 'utf8');
const iosLost = fs.readFileSync(path.join(root, 'ios/Wallet420/LostDevice420.swift'), 'utf8');
const iosPrivacy = fs.readFileSync(path.join(root, 'ios/Wallet420/Privacy420.swift'), 'utf8');

test('lost-device coordinators destroy local session state before canonical recovery', () => {
  assert.match(androidLost, /sessionKeys\.invalidate\(sessionAlias\)/);
  assert.match(androidLost, /beginCanonicalRecovery\(\)/);
  assert.ok(androidLost.indexOf('sessionKeys.invalidate(sessionAlias)') < androidLost.indexOf('beginCanonicalRecovery()'));

  assert.match(iosLost, /sessionKeys\.invalidate\(alias: sessionAlias\)/);
  assert.match(iosLost, /beginCanonicalRecovery\(\)/);
  assert.ok(iosLost.indexOf('sessionKeys.invalidate(alias: sessionAlias)') < iosLost.indexOf('beginCanonicalRecovery()'));
});

test('lost-device coordinators clear local push permission and clipboard state', () => {
  assert.match(androidLost, /wallet420_push_v1/);
  assert.match(androidLost, /wallet420_permissions_v1/);
  assert.match(androidLost, /AndroidPrivacy420\.clear/);
  assert.match(iosLost, /wallet420\.push\.v1/);
  assert.match(iosLost, /wallet420\.permissions\.v1/);
  assert.match(iosLost, /Privacy420\.clear/);
});

test('clipboard helpers mark or constrain copied public values and never expose signing authority', () => {
  assert.match(androidPrivacy, /IS_SENSITIVE/);
  assert.match(androidPrivacy, /clearPrimaryClip/);
  assert.match(iosPrivacy, /\.localOnly: true/);
  assert.match(iosPrivacy, /\.expirationDate:/);
  for (const source of [androidPrivacy, iosPrivacy, androidLost, iosLost]) {
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|personal_sign|eth_sendTransaction/i);
  }
});
