import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(root, 'distribution-qualification.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'release-bundle.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const device = JSON.parse(fs.readFileSync(path.join(root, 'device-qualification-results.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(contract.schemaVersion === 1, 'unsupported distribution qualification schema');
assert(contract.stage === 'W12.5', 'distribution qualification stage drift');
assert(contract.releaseBundle === 'release-bundle.json', 'release bundle reference drift');
assert(contract.checksumAlgorithm === 'sha256', 'distribution checksum algorithm must be sha256');
assert(bundle.releaseVersion === manifest.releaseVersion, 'release version drift during distribution qualification');
assert(bundle.qualifiedSourceCommit === manifest.source.commit, 'source provenance drift during distribution qualification');
assert(contract.secretPolicy.committedSigningCredentials === false, 'committed signing credentials are forbidden');
assert(contract.secretPolicy.committedWalletSecrets === false, 'committed wallet secrets are forbidden');
assert(contract.secretPolicy.remoteSignerFallback === false, 'remote signer fallback is forbidden');
assert(contract.secretPolicy.plaintextPrivateKeyFallback === false, 'plaintext private key fallback is forbidden');
assert(contract.productionReadiness.requiresDeviceCloseout === true, 'device closeout must remain required');
assert(contract.productionReadiness.requiredCommand === 'npm run device:closeout', 'device closeout command drift');

const platforms = ['android', 'ios'];
const physicalComplete = device.buildSha !== 'UNRECORDED' && platforms.every((platform) => {
  const record = device[platform];
  return record.deviceModel !== 'UNRECORDED' && record.osVersion !== 'UNRECORDED' && Object.values(record.results).every((status) => status === 'PASS');
});

if (!physicalComplete) {
  assert(contract.productionReadiness.currentStatus === 'BLOCKED_EXTERNAL_DEVICE', 'production readiness must remain blocked until physical qualification passes');
}

const forbiddenPatterns = [
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /-----BEGIN CERTIFICATE-----/,
  /(?:mnemonic|seed phrase)\s*[:=]\s*["'][^"']+/i,
  /(?:private[_-]?key|wallet[_-]?secret)\s*[:=]\s*["'][^"']+/i,
  /(?:keystore|p12|provisioning)[_-]?(?:password|secret)\s*[:=]\s*["'][^"']+/i,
  /app[_-]?store[_-]?connect[_-]?api[_-]?key\s*[:=]\s*["'][^"']+/i,
];

for (const file of [
  'release-manifest.json',
  'release-bundle.json',
  'distribution-qualification.json',
  'android/play-internal-testing.json',
  'ios-appstore-package.json',
  'android/app/build.gradle.kts',
  'ios/project.yml',
  'ios/ExportOptions-AppStore.template.plist'
]) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(text), `forbidden secret-like material detected in ${file}`);
  }
}

console.log(`W12.5 distribution qualification passed; production readiness=${physicalComplete ? 'DEVICE_CLOSEOUT_COMPLETE' : 'BLOCKED_EXTERNAL_DEVICE'}`);
