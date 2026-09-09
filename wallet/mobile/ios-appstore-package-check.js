import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('./ios-appstore-package.json', import.meta.url), 'utf8'));
const project = fs.readFileSync(new URL('./ios/project.yml', import.meta.url), 'utf8');
const exportOptions = fs.readFileSync(new URL('./ios/ExportOptions-AppStore.template.plist', import.meta.url), 'utf8');
const entitlements = fs.readFileSync(new URL('./ios/Wallet420/Wallet420.entitlements', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('./ios/Wallet420/PrivacyInfo.xcprivacy', import.meta.url), 'utf8');

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

requireCondition(pkg.schemaVersion === 1, 'unexpected iOS package schema version');
requireCondition(pkg.platform === 'ios', 'platform must be ios');
requireCondition(pkg.distribution === 'app-store-connect', 'distribution must be app-store-connect');
requireCondition(pkg.bundleIdentifier === 'io.fourtwenty.wallet', 'unexpected iOS bundle identifier');
requireCondition(project.includes(`PRODUCT_BUNDLE_IDENTIFIER: ${pkg.bundleIdentifier}`), 'project bundle identifier mismatch');
requireCondition(project.includes(`IPHONEOS_DEPLOYMENT_TARGET: "${pkg.deploymentTarget}"`), 'deployment target mismatch');
requireCondition(project.includes('WALLET_LINK_HOST: wallet.invalid'), 'Associated Domains host must remain configuration-driven');
requireCondition(project.includes('APS_ENVIRONMENT: development'), 'APNs environment must remain configuration-driven');
requireCondition(project.includes('UIBackgroundModes:'), 'remote notification background mode missing');
requireCondition(project.includes('- remote-notification'), 'remote notification background mode missing');
requireCondition(entitlements.includes('applinks:$(WALLET_LINK_HOST)'), 'Associated Domains entitlement must use WALLET_LINK_HOST');
requireCondition(entitlements.includes('$(APS_ENVIRONMENT)'), 'APNs entitlement must use APS_ENVIRONMENT');
requireCondition(exportOptions.includes('<string>app-store-connect</string>'), 'App Store export method missing');
requireCondition(exportOptions.includes('<key>signingStyle</key>'), 'signingStyle missing from export template');
requireCondition(privacy.includes('NSPrivacyAccessedAPITypes'), 'iOS privacy manifest missing required accessed API declaration');
requireCondition(pkg.signing.mode === 'external-only', 'iOS signing must remain external-only');
requireCondition(pkg.signing.committedCertificates === false, 'certificates must not be committed');
requireCondition(pkg.signing.committedProvisioningProfiles === false, 'provisioning profiles must not be committed');
requireCondition(pkg.signing.committedAppStoreConnectKeys === false, 'App Store Connect API keys must not be committed');
requireCondition(pkg.physicalDeviceQualification.requiredForProductionRelease === true, 'production release must require physical-device qualification');
requireCondition(pkg.physicalDeviceQualification.iosStatus === 'BLOCKED_EXTERNAL_DEVICE', 'iOS hardware qualification must remain blocked until genuine device evidence exists');

console.log('iOS App Store package contract: PASS');
