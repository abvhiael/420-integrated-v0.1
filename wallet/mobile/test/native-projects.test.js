import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'android/settings.gradle.kts',
  'android/build.gradle.kts',
  'android/app/build.gradle.kts',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/NativeWalletBridge420.kt',
  'ios/project.yml',
  'ios/Wallet420/Info.plist',
  'ios/Wallet420/Wallet420App.swift',
  'ios/Wallet420/NativeWalletBridge420.swift',
];

const bridgeCapabilities = [
  'rpc',
  'secureGet',
  'secureSet',
  'secureDelete',
  'createPasskey',
  'getPasskey',
  'signSessionHash',
  'submitTransaction',
  'openExternal',
  'onResume',
  'onPause',
];

test('W11 contains real native project source trees', () => {
  for (const file of required) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `missing W11 native project file: ${file}`);
  }
});

test('iOS and Android expose the same qualified authority boundary', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/NativeWalletBridge420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/NativeWalletBridge420.swift'), 'utf8');
  for (const capability of bridgeCapabilities) {
    assert.match(android, new RegExp(capability), `Android missing bridge capability ${capability}`);
    assert.match(ios, new RegExp(capability), `iOS missing bridge capability ${capability}`);
  }
});

test('native bootstrap contains no remote signing fallback or plaintext private key', () => {
  for (const relative of required.filter((file) => /\.(kt|swift)$/.test(file))) {
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(text, /privateKey\s*=|remoteSigner|signingService/i, `${relative} introduces forbidden signing authority`);
  }
});
