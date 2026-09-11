#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const hubRoot = resolve(here, '..');
const repoRoot = resolve(hubRoot, '..');
const config = JSON.parse(readFileSync(resolve(here, 'devnet.config.json'), 'utf8'));

function fail(message) {
  console.error(`DEVHUB5_ERROR=${message}`);
  process.exit(2);
}

function abs(path) {
  return resolve(repoRoot, path);
}

function commandPlan(seconds = 90) {
  return Object.freeze({
    schemaVersion: config.schemaVersion,
    profile: config.profile,
    environment: config.environment,
    chainId: config.chainId,
    executionNodes: config.executionNodes,
    consensusNodes: config.consensusNodes,
    consensusTransport: config.consensusTransport,
    ports: config.ports,
    commands: [
      ['make', 'build'],
      [abs(config.paths.prepare)],
      ['python3', abs(config.paths.run), '--seconds', String(seconds), '--slot-ms', String(config.slotMs), '--consensus-transport', config.consensusTransport]
    ]
  });
}

function doctor() {
  const required = [
    'Makefile',
    config.paths.prepare,
    config.paths.run,
    'execution/genesis/execution-genesis.json',
    'scripts/generate-jwt.sh'
  ];
  const missing = required.filter((path) => !existsSync(abs(path)));
  const geth = process.env.NODE420_GETH || abs(config.paths.geth);
  if (!existsSync(geth)) missing.push(geth);
  if (config.environment !== 'local') missing.push('environment must remain local');
  if (config.chainId !== '420') missing.push('DEVHUB-5 profile chain id must remain 420');
  if (config.executionNodes !== 15 || config.consensusNodes !== 15) missing.push('real15 profile must contain 15 execution and 15 consensus nodes');
  if (missing.length) fail(`doctor failed: ${missing.join(', ')}`);
  console.log(JSON.stringify({ ok: true, profile: config.profile, chainId: config.chainId, geth }, null, 2));
}

function run(command, args = []) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${command} exited ${result.status}`);
}

function prepare() {
  doctor();
  run('make', ['build']);
  run(abs(config.paths.prepare));
}

function up(seconds) {
  prepare();
  run('python3', [abs(config.paths.run), '--seconds', String(seconds), '--slot-ms', String(config.slotMs), '--consensus-transport', config.consensusTransport]);
}

const [command = 'plan', ...rest] = process.argv.slice(2);
const secondsArg = rest.find((value) => /^\d+$/.test(value));
const seconds = secondsArg ? Number(secondsArg) : 90;
if (!Number.isInteger(seconds) || seconds <= 0) fail('seconds must be a positive integer');

switch (command) {
  case 'plan':
    console.log(JSON.stringify(commandPlan(seconds), null, 2));
    break;
  case 'doctor':
    doctor();
    break;
  case 'prepare':
    prepare();
    break;
  case 'up':
  case 'smoke':
    up(seconds);
    break;
  default:
    fail(`unknown command: ${command}`);
}
