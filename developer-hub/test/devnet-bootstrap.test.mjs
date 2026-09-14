import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(resolve(root, 'devnet/devnet.config.json'), 'utf8'));

test('DEVHUB-5 profile is local, deterministic, and real15-shaped', () => {
  assert.equal(config.schemaVersion, '1.0.0');
  assert.equal(config.environment, 'local');
  assert.equal(config.chainId, '420');
  assert.equal(config.profile, 'real15');
  assert.equal(config.executionNodes, 15);
  assert.equal(config.consensusNodes, 15);
  assert.equal(config.consensusTransport, 'devnet-tcp');
  assert.equal(config.ports.rpcBase, 8545);
  assert.equal(config.ports.engineBase, 8551);
  assert.equal(config.ports.p2pBase, 30303);
});

test('bootstrap plan reuses canonical repository devnet scripts', () => {
  const cp = spawnSync(process.execPath, [resolve(root, 'devnet/bootstrap.mjs'), 'plan', '30'], { encoding: 'utf8' });
  assert.equal(cp.status, 0, cp.stderr);
  const plan = JSON.parse(cp.stdout);
  assert.equal(plan.environment, 'local');
  assert.equal(plan.chainId, '420');
  assert.deepEqual(plan.commands[0], ['make', 'build']);
  assert.match(plan.commands[1][0], /scripts[\\/]prepare-real-devnet15\.sh$/);
  assert.equal(plan.commands[2][0], 'python3');
  assert.match(plan.commands[2][1], /scripts[\\/]run-real-devnet15\.py$/);
  assert.ok(plan.commands[2].includes('devnet-tcp'));
  assert.ok(plan.commands[2].includes('30'));
});

test('DEVHUB-5 config contains no mainnet or production authority path', () => {
  const raw = readFileSync(resolve(root, 'devnet/devnet.config.json'), 'utf8');
  assert.doesNotMatch(raw, /mainnet/i);
  assert.doesNotMatch(raw, /privateKey|mnemonic|seedPhrase/i);
});
