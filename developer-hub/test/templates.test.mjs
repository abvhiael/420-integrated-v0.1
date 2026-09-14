import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const scaffold = resolve(root, 'templates/scaffold.mjs');
function run(args, cwd = root) { return spawnSync(process.execPath, [scaffold, ...args], { cwd, encoding:'utf8' }); }

test('template registry exposes the three DEVHUB-7 starters', () => {
  const cp = run(['list']);
  assert.equal(cp.status, 0, cp.stderr);
  const output = JSON.parse(cp.stdout);
  assert.deepEqual(output.templates.map((x) => x.id), ['sdk-basic','wallet-aware','protocol-reader']);
});

test('scaffold materializes a starter and replaces project token', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'devhub7-'));
  try {
    const cp = run(['create','sdk-basic','demo420'], dir);
    assert.equal(cp.status, 0, cp.stderr);
    const pkg = JSON.parse(await readFile(resolve(dir,'demo420/package.json'),'utf8'));
    assert.equal(pkg.name, 'demo420');
  } finally { await rm(dir, { recursive:true, force:true }); }
});

test('scaffold rejects path traversal and existing targets', async () => {
  assert.notEqual(run(['create','sdk-basic','../escape']).status, 0);
  const dir = await mkdtemp(resolve(tmpdir(), 'devhub7-existing-'));
  try { assert.notEqual(run(['create','sdk-basic','existing', dir], dir).status, 0); }
  finally { await rm(dir, { recursive:true, force:true }); }
});

test('starter content contains no embedded signer secrets', async () => {
  for (const id of ['sdk-basic','wallet-aware','protocol-reader']) {
    const dir = resolve(root, 'templates/starters', id);
    for (const file of ['README.md','package.json','src/index.mjs']) {
      const raw = await readFile(resolve(dir,file),'utf8');
      assert.doesNotMatch(raw, /0x[0-9a-fA-F]{64}|seed phrase\s*[:=]|mnemonic\s*[:=]|privateKey\s*[:=]/i);
    }
  }
});
