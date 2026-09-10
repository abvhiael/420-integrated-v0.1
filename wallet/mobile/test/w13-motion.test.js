import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDesign = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/Wallet420DesignSystem.kt'), 'utf8');
const androidApp = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const iosDesign = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420DesignSystem.swift'), 'utf8');
const iosApp = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

test('W13.4 motion uses bounded native presentation primitives', () => {
  assert.match(androidDesign, /MOTION_SHORT_MS = 140L/);
  assert.match(androidDesign, /MOTION_MEDIUM_MS = 220L/);
  assert.match(androidDesign, /animateContentIn/);
  assert.match(androidDesign, /pulseStatus/);
  assert.match(iosDesign, /contentAnimation/);
  assert.match(iosDesign, /statusAnimation/);
  assert.match(iosApp, /\.transition\(/);
  assert.match(androidApp, /animateContentIn\(contentHost\)/);
});

test('W13.4 respects reduced-motion accessibility settings', () => {
  assert.match(androidDesign, /ANIMATOR_DURATION_SCALE/);
  assert.match(androidDesign, /reducedMotion/);
  assert.match(iosDesign, /accessibilityReduceMotion/);
  assert.match(iosApp, /accessibilityReduceMotion/);
  assert.match(iosApp, /reduceMotion \? \.identity/);
});

test('W13.4 motion remains presentation-only', () => {
  for (const source of [androidDesign, androidApp, iosDesign, iosApp]) {
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|personal_sign|eth_signTypedData|eth_sendTransaction/i);
  }
  assert.match(androidApp, /Wallet Core authorization/);
  assert.match(iosApp, /Wallet Core authorization/);
  assert.match(androidApp, /canonical SmartAccount authority is unchanged/);
  assert.match(iosApp, /canonical SmartAccount authority is unchanged/);
});
