import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

test('W11.7 Android and iOS expose Wallet, Apps, Activity and Security surfaces', () => {
  for (const source of [android, ios]) {
    for (const label of ['Wallet', 'Apps', 'Activity', 'Security']) assert.match(source, new RegExp(label));
    assert.match(source, /Passkeys/);
    assert.match(source, /Sessions/);
    assert.match(source, /Recovery/);
  }
});

test('W11.7 native UX remains presentation-only', () => {
  for (const source of [android, ios]) {
    assert.match(source, /Presentation only|qualified Wallet Core/);
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|personal_sign|eth_signTypedData|eth_sendTransaction/i);
  }
});
