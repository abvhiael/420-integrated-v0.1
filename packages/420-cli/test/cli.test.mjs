import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '../../..');
const cli = resolve(repoRoot, 'packages/420-cli/bin/420.mjs');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repoRoot, encoding: 'utf8' });
}

function json(cp) {
  assert.equal(cp.status, 0, cp.stderr);
  return JSON.parse(cp.stdout);
}

test('version reports the CLI package identity', () => {
  const output = json(run(['version']));
  assert.equal(output.name, '@420/cli');
  assert.equal(output.version, '0.1.0');
});

test('network consumes canonical DEVHUB network discovery', () => {
  const output = json(run(['network']));
  assert.equal(output.environment, 'local');
  assert.equal(output.chainId, '420');
  assert.equal(output.nativeCurrency.symbol, '420');
  assert.equal(output.isProduction, false);
});

test('contract lookup consumes the canonical contract catalogue', () => {
  const output = json(run(['contract', 'ProtocolRegistry']));
  assert.equal(output.name, 'ProtocolRegistry');
  assert.equal(output.protocol, '420Registry');
  assert.equal(output.address, '0x0000000000000000000000000000000000000420');
  assert.equal(output.verified, true);
});

test('unknown contracts fail closed instead of fabricating metadata', () => {
  const cp = run(['contract', 'DoesNotExist420']);
  assert.equal(cp.status, 3);
  assert.match(cp.stderr, /unknown contract/);
});

test('wallet metadata fails closed when canonical wallet contracts are absent', () => {
  const cp = run(['wallet-contracts']);
  assert.equal(cp.status, 3);
  assert.match(cp.stderr, /canonical wallet contracts are not available/);
});

test('devnet plan delegates to the DEVHUB-5 local bootstrap', () => {
  const output = json(run(['devnet', 'plan', '30']));
  assert.equal(output.environment, 'local');
  assert.equal(output.chainId, '420');
  assert.equal(output.profile, 'real15');
  assert.ok(output.commands[2].includes('30'));
});

test('CLI exposes no private-key or mnemonic command surface', () => {
  const cp = run(['help']);
  assert.equal(cp.status, 0, cp.stderr);
  assert.doesNotMatch(cp.stdout, /private[- ]?key|mnemonic|seed phrase/i);
  assert.match(cp.stdout, /420 devnet plan\|doctor\|prepare\|up\|smoke/);
});
