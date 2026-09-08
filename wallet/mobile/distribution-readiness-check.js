import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
const iosProject = fs.readFileSync(path.join(root, 'ios/project.yml'), 'utf8');
const exportOptions = fs.readFileSync(path.join(root, 'ios/ExportOptions-AppStore.template.plist'), 'utf8');

for (const name of [
  'WALLET420_ANDROID_KEYSTORE_PATH',
  'WALLET420_ANDROID_KEYSTORE_PASSWORD',
  'WALLET420_ANDROID_KEY_ALIAS',
  'WALLET420_ANDROID_KEY_PASSWORD',
]) {
  if (!androidGradle.includes(`environmentVariable("${name}")`)) {
    throw new Error(`missing Android authorized signing environment hook: ${name}`);
  }
}

if (!androidGradle.includes('releaseSigningRequested') || !androidGradle.includes('releaseSigningComplete')) {
  throw new Error('Android release signing must fail closed when only a partial signing environment is provided');
}
if (!androidGradle.includes('signingConfigs.findByName("authorizedRelease")')) {
  throw new Error('Android release build must bind only to the opt-in authorized signing config');
}
if (/storePassword\s*=\s*"|keyPassword\s*=\s*"|keyAlias\s*=\s*"/.test(androidGradle)) {
  throw new Error('Android signing credentials must not be hard-coded');
}

for (const invariant of [
  'PRODUCT_BUNDLE_IDENTIFIER: io.fourtwenty.wallet',
  'CODE_SIGN_STYLE: Automatic',
  'WALLET_LINK_HOST: wallet.invalid',
  'APS_ENVIRONMENT: development',
]) {
  if (!iosProject.includes(invariant)) throw new Error(`missing iOS distribution invariant: ${invariant}`);
}
if (!exportOptions.includes('<string>app-store-connect</string>')) {
  throw new Error('iOS export template must target App Store Connect distribution');
}
if (!exportOptions.includes('<string>automatic</string>')) {
  throw new Error('iOS export template must use authorized automatic signing at export time');
}

const forbidden = /(BEGIN (RSA |EC )?PRIVATE KEY|BEGIN CERTIFICATE|provisioningProfile|p12Password|api[_-]?key\s*[:=]\s*["'][^"']+)/i;
for (const file of [
  'android/app/build.gradle.kts',
  'ios/project.yml',
  'ios/ExportOptions-AppStore.template.plist',
]) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (forbidden.test(text)) throw new Error(`embedded distribution credential forbidden in ${file}`);
}

console.log('420 Wallet distribution readiness validation passed');
