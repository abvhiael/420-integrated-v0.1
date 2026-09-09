import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

test('W13.2 Android and iOS expose polished Wallet, Apps, Activity and Security surfaces', () => {
  for (const source of [android, ios]) {
    for (const label of ['Wallet', 'Apps', 'Activity', 'Security']) assert.match(source, new RegExp(label));
    assert.match(source, /Portfolio/);
    assert.match(source, /Quick actions/);
    assert.match(source, /Passkeys/);
    assert.match(source, /session keys/i);
    assert.match(source, /Recovery/);
    assert.match(source, /Send/);
    assert.match(source, /Receive/);
    assert.match(source, /Connect/);
  }
});

test('W13.2 polished native UX remains presentation-only and defers authority to Wallet Core', () => {
  for (const source of [android, ios]) {
    assert.match(source, /presentation-only/i);
    assert.match(source, /Wallet Core/);
    assert.match(source, /SmartAccount|canonical/);
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|personal_sign|eth_signTypedData|eth_sendTransaction/i);
  }
});
