import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const androidGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
const iosProject = fs.readFileSync(path.join(root, 'ios/project.yml'), 'utf8');

const fail = (message) => { throw new Error(message); };
if (manifest.schemaVersion !== 1) fail('unsupported release manifest schema');
if (!/^[0-9a-f]{40}$/.test(manifest.source?.commit ?? '')) fail('release manifest requires exact 40-character source commit');
if (manifest.android?.applicationId !== 'io.fourtwenty.wallet') fail('Android application id drift');
if (manifest.ios?.bundleId !== 'io.fourtwenty.wallet') fail('iOS bundle id drift');
if (!manifest.security?.requiresPhysicalDeviceCloseout) fail('W12 must require W11 physical-device closeout');
for (const field of ['committedSigningCredentials', 'remoteSignerFallback', 'plaintextPrivateKeyFallback']) {
  if (manifest.security?.[field] !== false) fail(`unsafe release security flag: ${field}`);
}
if (!androidGradle.includes(`versionCode = ${manifest.android.versionCode}`)) fail('Android versionCode does not match release manifest');
if (!androidGradle.includes(`versionName = "${manifest.releaseVersion}"`)) fail('Android versionName does not match release manifest');
if (!androidGradle.includes(`minSdk = ${manifest.android.minSdk}`)) fail('Android minSdk does not match release manifest');
if (!androidGradle.includes(`targetSdk = ${manifest.android.targetSdk}`)) fail('Android targetSdk does not match release manifest');
if (!iosProject.includes(`PRODUCT_BUNDLE_IDENTIFIER: ${manifest.ios.bundleId}`)) fail('iOS bundle identifier does not match release manifest');
if (!iosProject.includes(`IPHONEOS_DEPLOYMENT_TARGET: "${manifest.ios.minimumOS}"`)) fail('iOS deployment target does not match release manifest');
if (!manifest.authorityPolicy || manifest.authorityPolicy !== 'wallet-core-canonical-v1') fail('release authority policy drift');

console.log('420 Wallet W12 release manifest qualification passed');
