import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidPush = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidPush420.kt'), 'utf8');
const androidMain = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const iosPush = fs.readFileSync(path.join(root, 'ios/Wallet420/Push420.swift'), 'utf8');
const iosApp = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

for (const [name, source] of [['android push', androidPush], ['ios push', iosPush]]) {
  test(`${name} is reference-only and one-shot`, () => {
    assert.match(source, /origin/);
    assert.match(source, /requestId|requestID/);
    assert.match(source, /expiresAt/);
    assert.match(source, /consumePending/);
    assert.match(source, /consumed/i);
    assert.match(source, /foreground/);
    assert.match(source, /background/);
    assert.match(source, /terminated/);
    assert.doesNotMatch(source, /privateKey|signature|userOperation|pre.?authori[sz]ed|remoteSigner|signingService/i);
  });
}

test('Android foreground lifecycle consumes pending push before approval presentation', () => {
  assert.match(androidMain, /onResume/);
  assert.match(androidMain, /consumePendingPush/);
  assert.match(androidMain, /Shared Wallet Core must canonically rehydrate and revalidate before approval/);
});

test('iOS active scene consumes pending push and notification response covers terminated launch', () => {
  assert.match(iosApp, /scenePhase/);
  assert.match(iosApp, /phase == \.active|case \.active:/);
  assert.match(iosApp, /consumePendingPush/);
  assert.match(iosPush, /UNNotificationResponse/);
  assert.match(iosPush, /state: "terminated"/);
});
