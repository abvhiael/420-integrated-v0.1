import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidSecurity = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidDeviceSecurity420.kt'), 'utf8');
const androidApp = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const iosSecurity = fs.readFileSync(path.join(root, 'ios/Wallet420/DeviceSecurity420.swift'), 'utf8');
const iosApp = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

test('W11.8 Android enables screenshot privacy and local background lock', () => {
  assert.match(androidSecurity, /FLAG_SECURE/);
  assert.match(androidSecurity, /Debug\.isDebuggerConnected/);
  assert.match(androidSecurity, /rootIndicators/);
  assert.match(androidApp, /override fun onPause/);
  assert.match(androidApp, /onBackground/);
  assert.match(androidApp, /localLocked = true/);
});

test('W11.8 Android local unlock requires existing biometric device-presence gate', () => {
  assert.match(androidApp, /AndroidBiometricGate420/);
  assert.match(androidApp, /authorize\("Unlock 420 Wallet after backgrounding"\)/);
  assert.match(androidApp, /if \(!localLocked\) consumePendingPush\(\)/);
  assert.match(androidApp, /Local presence only restores presentation access; canonical SmartAccount authority is unchanged/);
});

test('W11.8 iOS shields background and captured screens', () => {
  assert.match(iosSecurity, /UIScreen\.main\.isCaptured/);
  assert.match(iosSecurity, /jailbreakIndicators/);
  assert.match(iosApp, /capturedDidChangeNotification/);
  assert.match(iosApp, /case \.inactive, \.background/);
  assert.match(iosApp, /privacyShield = true/);
  assert.match(iosApp, /localLocked = true/);
});

test('W11.8 iOS local unlock requires existing device-owner authentication gate', () => {
  assert.match(iosApp, /BiometricGate420/);
  assert.match(iosApp, /authorize\(reason: "Unlock 420 Wallet after backgrounding"\)/);
  assert.match(iosApp, /guard !localLocked else \{ return \}/);
  assert.match(iosApp, /Local presence only restores presentation access; canonical SmartAccount authority is unchanged/);
});

test('hostile device signals remain non-authoritative presentation and risk inputs', () => {
  for (const source of [androidSecurity, iosSecurity, androidApp, iosApp]) {
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|eth_sendTransaction|personal_sign/i);
  }
  assert.match(androidSecurity, /never grant or revoke SmartAccount420 authority/);
  assert.match(iosSecurity, /never grant or revoke SmartAccount420 authority/);
});
