import fs from 'node:fs';

const record = JSON.parse(fs.readFileSync(new URL('./device-qualification-results.json', import.meta.url), 'utf8'));
const allowed = new Set(['PASS', 'FAIL', 'BLOCKED_EXTERNAL_DEVICE']);
const requiredChecks = [
  'freshInstall','upgrade','passkeyRegistration','passkeyAssertion','biometricGate',
  'sessionKeyCreation','sessionKeyRotation','lockedDeviceAccess','backgroundForeground',
  'screenCapture','verifiedLinkUnlocked','verifiedLinkLocked','pushForeground',
  'pushBackground','pushTerminated','pushReplay','expiredReference','authorityDrift',
  'lostDevice','clipboard','rpcTransport'
];

function validatePlatform(name, platform) {
  if (!platform || typeof platform !== 'object') throw new Error(`${name}: missing platform record`);
  if (typeof platform.deviceModel !== 'string' || !platform.deviceModel) throw new Error(`${name}: deviceModel required`);
  if (typeof platform.osVersion !== 'string' || !platform.osVersion) throw new Error(`${name}: osVersion required`);
  if (!platform.results || typeof platform.results !== 'object') throw new Error(`${name}: results required`);
  for (const check of requiredChecks) {
    const status = platform.results[check];
    if (!allowed.has(status)) throw new Error(`${name}.${check}: invalid status ${status}`);
  }
  const extras = Object.keys(platform.results).filter((key) => !requiredChecks.includes(key));
  if (extras.length) throw new Error(`${name}: unexpected checks: ${extras.join(', ')}`);
}

if (record.schemaVersion !== 1) throw new Error('unsupported schemaVersion');
if (typeof record.buildSha !== 'string' || !record.buildSha) throw new Error('buildSha required');
validatePlatform('android', record.android);
validatePlatform('ios', record.ios);

const failures = [];
for (const [name, platform] of [['android', record.android], ['ios', record.ios]]) {
  for (const [check, status] of Object.entries(platform.results)) {
    if (status === 'FAIL') failures.push(`${name}.${check}`);
  }
}
if (failures.length) throw new Error(`physical-device qualification contains FAIL: ${failures.join(', ')}`);

console.log('physical-device qualification record is structurally valid');
