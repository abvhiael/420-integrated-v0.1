import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420App.swift'), 'utf8');

test('W13.3 native onboarding exposes new, existing, and recovery entry paths', () => {
  for (const source of [android, ios]) {
    assert.match(source, /Welcome to 420 Wallet/);
    assert.match(source, /Set up a new wallet/);
    assert.match(source, /Find an existing wallet/);
    assert.match(source, /Recover a wallet/);
    assert.match(source, /Passkeys/);
    assert.match(source, /Recovery/);
  }
});

test('W13.3 onboarding teaches canonical SmartAccount and local-presence boundaries', () => {
  for (const source of [android, ios]) {
    assert.match(source, /canonical SmartAccount|SmartAccount is the canonical account/);
    assert.match(source, /Wallet Core/);
    assert.match(source, /local presence only|prove local presence only/);
    assert.match(source, /Public RPC is transport only|Public RPC.*never signing authority/);
  }
});

test('W13.3 onboarding blocks request presentation until onboarding is complete', () => {
  assert.match(android, /!onboardingActive/);
  assert.match(android, /if \(localLocked \|\| onboardingActive\) return/);
  assert.match(ios, /!onboardingActive/);
  assert.match(ios, /guard !localLocked, !onboardingActive else \{ return \}/);
});

test('W13.3 onboarding completion is presentation state, not wallet authority', () => {
  for (const source of [android, ios]) {
    assert.match(source, /onboarding.*completed|onboardingCompleted/);
    assert.doesNotMatch(source, /privateKey\s*=|remoteSigner|signingService|personal_sign|eth_sendTransaction/i);
  }
});
