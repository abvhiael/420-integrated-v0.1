import fs from 'node:fs';

const record = JSON.parse(fs.readFileSync(new URL('./device-qualification-results.json', import.meta.url), 'utf8'));
const unresolved = [];

for (const platformName of ['android', 'ios']) {
  const platform = record[platformName];
  if (!platform) {
    unresolved.push(`${platformName}: missing record`);
    continue;
  }
  if (!platform.deviceModel || platform.deviceModel === 'UNRECORDED') unresolved.push(`${platformName}: device model unrecorded`);
  if (!platform.osVersion || platform.osVersion === 'UNRECORDED') unresolved.push(`${platformName}: OS version unrecorded`);
  for (const [check, status] of Object.entries(platform.results ?? {})) {
    if (status !== 'PASS') unresolved.push(`${platformName}.${check}=${status}`);
  }
}

if (!record.buildSha || record.buildSha === 'UNRECORDED') unresolved.push('buildSha unrecorded');
if (unresolved.length) {
  console.error('W11.10 physical-device closeout is blocked:');
  for (const item of unresolved) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`W11.10 physical-device closeout qualified for build ${record.buildSha}`);
