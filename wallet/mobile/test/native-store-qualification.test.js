import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, '..');
const read = (path) => readFileSync(resolve(mobileRoot, path), 'utf8');

test('Android release/store configuration preserves wallet security boundaries', () => {
  const gradle = read('android/app/build.gradle.kts');
  const manifest = read('android/app/src/main/AndroidManifest.xml');

  assert.match(gradle, /applicationId\s*=\s*"io\.fourtwenty\.wallet"/);
  assert.match(gradle, /minSdk\s*=\s*28/);
  assert.match(gradle, /walletLinkHost/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="\$\{walletLinkHost\}"/);
  assert.doesNotMatch(manifest, /android:host="wallet\.invalid"/);
});

test('iOS release/store configuration is explicit and deployment-configurable', () => {
  const project = read('ios/project.yml');
  const entitlements = read('ios/Wallet420/Wallet420.entitlements');
  const privacy = read('ios/Wallet420/PrivacyInfo.xcprivacy');

  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER:\s*io\.fourtwenty\.wallet/);
  assert.match(project, /NSFaceIDUsageDescription:/);
  assert.match(project, /UIBackgroundModes:\s*\n\s*- remote-notification/);
  assert.match(project, /WALLET_LINK_HOST:\s*wallet\.invalid/);
  assert.match(project, /APS_ENVIRONMENT:\s*development/);
  assert.match(entitlements, /<string>\$\(APS_ENVIRONMENT\)<\/string>/);
  assert.match(entitlements, /applinks:\$\(WALLET_LINK_HOST\)/);
  assert.doesNotMatch(entitlements, /<string>production<\/string>/);
  assert.match(privacy, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.match(privacy, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(privacy, /<string>CA92\.1<\/string>/);
});

test('release metadata never embeds signing credentials or wallet secrets', () => {
  const files = [
    read('android/app/build.gradle.kts'),
    read('android/app/src/main/AndroidManifest.xml'),
    read('ios/project.yml'),
    read('ios/Wallet420/Wallet420.entitlements'),
    read('ios/Wallet420/PrivacyInfo.xcprivacy'),
  ].join('\n');

  for (const forbidden of [
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
    /provisioningProfile/i,
    /keystorePassword/i,
    /keyPassword/i,
    /apnsAuthKey/i,
    /remoteSigner/i,
  ]) {
    assert.doesNotMatch(files, forbidden);
  }
});
