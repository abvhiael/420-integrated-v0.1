import fs from 'node:fs';

const bundle = JSON.parse(fs.readFileSync(new URL('./release-bundle.json', import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(new URL('./release-manifest.json', import.meta.url)));
const android = JSON.parse(fs.readFileSync(new URL('./android/play-internal-testing.json', import.meta.url)));
const ios = JSON.parse(fs.readFileSync(new URL('./ios-appstore-package.json', import.meta.url)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(bundle.schemaVersion === 1, 'unsupported release bundle schema');
assert(bundle.releaseVersion === manifest.releaseVersion, 'release version drift');
assert(bundle.authorityPolicy === manifest.authorityPolicy, 'authority policy drift');
assert(bundle.qualifiedSourceCommit === manifest.source.commit, 'qualified source commit drift');
assert(bundle.platforms.android.applicationId === manifest.android.applicationId, 'android application id drift');
assert(bundle.platforms.ios.bundleId === manifest.ios.bundleId, 'ios bundle id drift');
assert(bundle.platforms.android.checksumAlgorithm === 'sha256', 'android checksum must be sha256');
assert(bundle.platforms.ios.checksumAlgorithm === 'sha256', 'ios checksum must be sha256');
assert(bundle.security.physicalDeviceCloseoutRequired === true, 'physical device closeout must remain required');
assert(bundle.security.signingCredentialsCommitted === false, 'signing credentials must not be committed');
assert(bundle.security.remoteSignerFallback === false, 'remote signer fallback must remain disabled');
assert(bundle.security.plaintextPrivateKeyFallback === false, 'plaintext private key fallback must remain disabled');
assert(android.applicationId === manifest.android.applicationId, 'android play metadata drift');
assert(ios.bundleId === manifest.ios.bundleId, 'ios app store metadata drift');
for (const required of ['release-manifest.json','android/play-internal-testing.json','ios-appstore-package.json','artifact-checksums.sha256']) {
  assert(bundle.sbom.requiredComponents.includes(required), `missing required BOM component: ${required}`);
}
assert(/device:closeout/.test(bundle.releaseNotes.securityNotice), 'release notes must preserve physical-device closeout gate');

console.log('W12.4 cross-platform release bundle check passed');
