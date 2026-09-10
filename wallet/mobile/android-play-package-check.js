import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'android/play-internal-testing.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

const fail = (message) => { throw new Error(message); };

if (metadata.schemaVersion !== 1) fail('unsupported Android Play metadata schema');
if (metadata.track !== 'internal') fail('W12 Android qualification must begin on Play internal testing');
if (metadata.applicationId !== release.android.applicationId) fail('Play applicationId does not match canonical release manifest');
if (metadata.releaseVersion !== release.releaseVersion) fail('Play release version does not match canonical release manifest');
if (metadata.versionCode !== release.android.versionCode) fail('Play versionCode does not match canonical release manifest');
if (metadata.minSdk !== release.android.minSdk || metadata.targetSdk !== release.android.targetSdk) fail('Play SDK metadata drift');
if (metadata.artifact !== release.android.artifacts.aab) fail('Play artifact name does not match canonical release manifest');
if (metadata.appLinks?.scheme !== 'https' || metadata.appLinks?.pathPrefix !== '/connect') fail('Play App Link contract drift');
if (metadata.appLinks?.host !== 'BUILD_CONFIGURED') fail('production App Link host must remain build-configured');
if (metadata.appLinks?.requiresDigitalAssetLinks !== true) fail('Play release must require Digital Asset Links');
if (metadata.permissions?.internet !== true || metadata.permissions?.postNotifications !== true) fail('required Android permissions missing from Play metadata');
if (metadata.permissions?.backupAllowed !== false) fail('Android release backup must remain disabled');
if (metadata.distribution?.playAppSigning !== 'EXTERNAL_AUTHORIZED_CONFIGURATION') fail('Play App Signing must remain external');
if (metadata.distribution?.uploadKey !== 'EXTERNAL_AUTHORIZED_CONFIGURATION') fail('Play upload key must remain external');
if (metadata.distribution?.signedArtifactRequiredForUpload !== true) fail('signed AAB must be required for Play upload');
if (metadata.distribution?.productionReleaseBlockedUntilDeviceCloseout !== true) fail('production Play release must remain blocked by physical-device closeout');
if (metadata.dataSafety?.status !== 'REQUIRED_EXTERNAL_REVIEW') fail('Data Safety must remain explicitly pending external review until completed');
if (!gradle.includes(`applicationId = "${metadata.applicationId}"`)) fail('Gradle applicationId drift');
if (!gradle.includes(`versionCode = ${metadata.versionCode}`)) fail('Gradle versionCode drift');
if (!gradle.includes(`versionName = "${metadata.releaseVersion}"`)) fail('Gradle versionName drift');
if (!manifest.includes('android:allowBackup="false"')) fail('Android backup policy drift');
if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) fail('Android notification permission drift');
if (!manifest.includes('android:autoVerify="true"')) fail('verified Android App Link missing');
if (!manifest.includes('android:scheme="https"')) fail('Android App Link must use HTTPS');
if (!manifest.includes('android:host="${walletLinkHost}"')) fail('Android App Link host must remain configured via build placeholder');
if (!manifest.includes('android:pathPrefix="/connect"')) fail('Android App Link path drift');

const serialized = JSON.stringify(metadata);
for (const forbidden of ['BEGIN PRIVATE KEY', 'PRIVATE KEY-----', 'keystorePassword', 'keyPassword', 'WALLET420_ANDROID_KEYSTORE_PASSWORD']) {
  if (serialized.includes(forbidden)) fail(`Play metadata embeds forbidden signing material marker: ${forbidden}`);
}

console.log('420 Wallet W12 Android Play packaging qualification passed');
