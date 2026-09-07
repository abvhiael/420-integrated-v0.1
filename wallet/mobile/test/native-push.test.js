import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }

test('W11.6 Android uses FCM and accepts reference-only push fields', () => {
  const gradle = read('android/app/build.gradle.kts');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const source = read('android/app/src/main/java/io/fourtwenty/wallet/AndroidPush420.kt');
  assert.match(gradle, /firebase-messaging/);
  assert.match(manifest, /com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(source, /FirebaseMessaging/);
  for (const field of ['origin', 'requestId', 'expiresAt']) assert.match(source, new RegExp(field));
  assert.doesNotMatch(source, /privateKey|signature|userOperation|authorizationEpoch|eth_sendTransaction|personal_sign/i);
});

test('W11.6 iOS uses APNs and stores only reference fields from notifications', () => {
  const source = read('ios/Wallet420/Push420.swift');
  const app = read('ios/Wallet420/Wallet420App.swift');
  assert.match(source, /registerForRemoteNotifications/);
  assert.match(source, /didRegisterForRemoteNotificationsWithDeviceToken/);
  assert.match(source, /didReceiveRemoteNotification/);
  for (const field of ['origin', 'requestId', 'expiresAt']) assert.match(source, new RegExp(field));
  assert.match(app, /UIApplicationDelegateAdaptor/);
  assert.doesNotMatch(source, /privateKey|signature|userOperation|authorizationEpoch|eth_sendTransaction|personal_sign/i);
});
