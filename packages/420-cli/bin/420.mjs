#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadNetworkManifest420, discoverNetwork420 } from '../../../developer-hub/src/network-discovery.mjs';
import { createContractCatalogue420 } from '../../../developer-hub/src/contract-catalogue.mjs';
import { createSdk420 } from '@420/sdk';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const VERSION = '0.1.0';

function fail(message, code = 2) {
  console.error(`420_CLI_ERROR=${message}`);
  process.exit(code);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`);
}

function parseArgs(argv) {
  const positional = [];
  const options = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) options.set(key, true);
    else {
      options.set(key, next);
      i += 1;
    }
  }
  return { positional, options };
}

function option(options, name, fallback) {
  const value = options.get(name);
  return typeof value === 'string' ? value : fallback;
}

function repoPath(path) {
  return resolve(repoRoot, path);
}

async function loadRuntime(options) {
  const manifestPath = resolve(process.cwd(), option(options, 'manifest', repoPath('developer-hub/manifests/local.example.json')));
  const cataloguePath = resolve(process.cwd(), option(options, 'catalogue', repoPath('developer-hub/catalogue/local.example.json')));
  const network = discoverNetwork420(await loadNetworkManifest420(manifestPath));
  const catalogueRaw = JSON.parse(await readFile(cataloguePath, 'utf8'));
  const contracts = createContractCatalogue420(catalogueRaw);
  const rpcEndpoint = option(options, 'rpc', undefined);
  const transport = {
    async request(endpoint, request) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: request.method, params: request.params ?? [] })
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
      return payload.result;
    }
  };
  return { network, contracts, sdk: createSdk420({ network, contracts, transport, rpcEndpoint }) };
}

function networkView(network) {
  return {
    schemaVersion: network.schemaVersion,
    name: network.name,
    environment: network.environment,
    chainId: network.chainIdDecimal,
    nativeCurrency: network.nativeCurrency,
    rpc: network.rpc,
    canRequestFaucet: network.canRequestFaucet,
    isProduction: network.isProduction
  };
}

function help() {
  process.stdout.write(`420 CLI ${VERSION}\n\n` +
    'Usage:\n' +
    '  420 version\n' +
    '  420 network [--manifest PATH]\n' +
    '  420 service NAME [--manifest PATH]\n' +
    '  420 contract NAME [--manifest PATH] [--catalogue PATH]\n' +
    '  420 rpc METHOD [PARAMS_JSON] [--manifest PATH] [--catalogue PATH] [--rpc URL]\n' +
    '  420 wallet-contracts [--manifest PATH] [--catalogue PATH]\n' +
    '  420 devnet plan|doctor|prepare|up|smoke [SECONDS]\n');
}

async function runDevnet(args) {
  const [action = 'plan', seconds] = args;
  const allowed = new Set(['plan', 'doctor', 'prepare', 'up', 'smoke']);
  if (!allowed.has(action)) fail(`unsupported devnet action: ${action}`);
  const command = [repoPath('developer-hub/devnet/bootstrap.mjs'), action];
  if (seconds !== undefined) {
    if (!/^[1-9][0-9]*$/.test(seconds)) fail('devnet seconds must be a positive integer');
    command.push(seconds);
  }
  const result = spawnSync(process.execPath, command, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command = 'help', ...args] = positional;

  if (command === 'help' || command === '--help' || command === '-h') return help();
  if (command === 'version') return print({ name: '@420/cli', version: VERSION });
  if (command === 'devnet') return runDevnet(args);

  const { network, sdk } = await loadRuntime(options);

  if (command === 'network') return print(networkView(network));
  if (command === 'service') {
    if (!args[0]) fail('service name is required');
    return print({ name: args[0], url: sdk.service(args[0]) });
  }
  if (command === 'contract') {
    if (!args[0]) fail('contract name is required');
    const contract = sdk.contract(args[0]);
    if (!contract) fail(`unknown contract: ${args[0]}`, 3);
    return print(contract);
  }
  if (command === 'wallet-contracts') {
    const factory = sdk.contract('SmartAccountFactory420');
    const capabilityRegistry = sdk.contract('CapabilityRegistry420');
    if (!factory || !capabilityRegistry) fail('canonical wallet contracts are not available in this catalogue', 3);
    return print({ factory, capabilityRegistry });
  }
  if (command === 'rpc') {
    const method = args[0];
    if (!method) fail('RPC method is required');
    let params = [];
    if (args[1] !== undefined) {
      try { params = JSON.parse(args[1]); }
      catch { fail('RPC params must be valid JSON'); }
      if (!Array.isArray(params)) fail('RPC params JSON must be an array');
    }
    return print({ method, result: await sdk.rpc({ method, params }) });
  }

  fail(`unknown command: ${command}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error), 1));
