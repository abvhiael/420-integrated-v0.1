import fs from 'node:fs';

const closeout = JSON.parse(fs.readFileSync(new URL('./release-candidate-closeout.json', import.meta.url)));
const bundle = JSON.parse(fs.readFileSync(new URL('./release-bundle.json', import.meta.url)));
const distribution = JSON.parse(fs.readFileSync(new URL('./distribution-qualification.json', import.meta.url)));
const device = JSON.parse(fs.readFileSync(new URL('./device-qualification-results.json', import.meta.url)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(closeout.schemaVersion === 1, 'unsupported W12.6 closeout schema');
assert(closeout.releaseVersion === bundle.releaseVersion, 'release candidate version drift');
assert(closeout.authorityPolicy === bundle.authorityPolicy, 'release candidate authority policy drift');
assert(closeout.qualificationMode === 'pull-request-merge-head', 'W12.6 must qualify the current PR merge head');
assert(closeout.requiredChecks.includes('420 Wallet Mobile Verification'), 'missing Wallet Mobile qualification requirement');
assert(closeout.requiredChecks.includes('420 Integrated Qualification'), 'missing Integrated qualification requirement');
assert(closeout.releaseGate === 'npm run device:closeout', 'production release gate drift');
assert(closeout.productionReadiness === 'BLOCKED_EXTERNAL_DEVICE', 'production readiness must remain blocked until genuine device closeout');
assert(closeout.distribution.android === 'AUTHORIZED_ONLY_AFTER_DEVICE_CLOSEOUT', 'Android distribution gate drift');
assert(closeout.distribution.ios === 'AUTHORIZED_ONLY_AFTER_DEVICE_CLOSEOUT', 'iOS distribution gate drift');
assert(closeout.security.committedSigningCredentials === false, 'committed signing credentials forbidden');
assert(closeout.security.remoteSignerFallback === false, 'remote signer fallback forbidden');
assert(closeout.security.plaintextPrivateKeyFallback === false, 'plaintext private-key fallback forbidden');
assert(distribution.productionReadiness?.requiresDeviceCloseout === true, 'distribution qualification must require device closeout');
assert(distribution.productionReadiness?.currentStatus === 'BLOCKED_EXTERNAL_DEVICE', 'distribution qualification must remain fail-closed');
assert(distribution.productionReadiness?.requiredCommand === 'npm run device:closeout', 'distribution device-closeout command drift');
assert(device.buildSha === 'UNRECORDED', 'device evidence unexpectedly claims a recorded build without closeout update');
for (const platform of ['android', 'ios']) {
  assert(device[platform].deviceModel === 'UNRECORDED', `${platform} device model must remain unrecorded until genuine hardware qualification`);
  assert(device[platform].osVersion === 'UNRECORDED', `${platform} OS version must remain unrecorded until genuine hardware qualification`);
  for (const status of Object.values(device[platform].results)) {
    assert(status === 'BLOCKED_EXTERNAL_DEVICE', `${platform} device result must remain honestly blocked until hardware qualification`);
  }
}

console.log('W12.6 release candidate closeout contract passed');
