import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function run(script) {
  return spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    encoding: 'utf8'
  });
}

test('physical-device evidence schema accepts explicit external-device blockers', () => {
  const result = run('device-qualification-check.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /structurally valid/);
});

test('W11.10 closeout remains blocked until real physical-device PASS evidence exists', () => {
  const result = run('device-qualification-closeout.js');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /physical-device closeout is blocked/);
  assert.match(result.stderr, /BLOCKED_EXTERNAL_DEVICE/);
  assert.match(result.stderr, /buildSha unrecorded/);
});
