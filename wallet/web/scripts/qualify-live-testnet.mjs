import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateNetworkManifest420 } from '../../../developer-hub/src/network-discovery.mjs';
import { validateRuntimeConfig } from '../core/config.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_QUANTITY_RE = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

export class WalletLiveTestnetQualificationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletLiveTestnetQualificationError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new WalletLiveTestnetQualificationError420(message);
}

function normalizeAddress420(value, label) {
  assert420(typeof value === 'string' && ADDRESS_RE.test(value), `${label} must be an EVM address`);
  return value.toLowerCase();
}

function normalizeHexQuantity420(value, label) {
  assert420(typeof value === 'string' && HEX_QUANTITY_RE.test(value), `${label} must be a canonical hex quantity`);
  return `0x${BigInt(value).toString(16)}`;
}

function decimalChainIdToHex420(value) {
  assert420(/^[1-9][0-9]*$/.test(String(value)), 'manifest chainId must be a positive decimal string');
  return `0x${BigInt(value).toString(16)}`;
}

async function rpc420(fetchImpl, rpcUrl, method, params = [], id = 1) {
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  assert420(response && response.ok === true, `RPC ${method} HTTP failure`);
  const payload = await response.json();
  assert420(payload && payload.jsonrpc === '2.0', `RPC ${method} malformed JSON-RPC response`);
  assert420(payload.error == null, `RPC ${method} error: ${payload.error?.message || 'unknown'}`);
  assert420(Object.hasOwn(payload, 'result'), `RPC ${method} missing result`);
  return payload.result;
}

async function serviceReachability420(fetchImpl, url, label) {
  assert420(typeof url === 'string' && url.length > 0, `${label} URL missing`);
  const parsed = new URL(url);
  assert420(parsed.protocol === 'https:', `${label} URL must use HTTPS`);
  const response = await fetchImpl(parsed, { method: 'GET', redirect: 'manual' });
  assert420(response && response.status >= 200 && response.status < 500, `${label} is unreachable`);
  return { url: parsed.toString(), status: response.status };
}

export function assertQualificationInputs420({ manifest, inventory, runtimeConfig }) {
  const validatedManifest = validateNetworkManifest420(manifest);
  validateRuntimeConfig(runtimeConfig);

  assert420(validatedManifest.network.environment === 'testnet', 'W14.3 requires a testnet manifest');
  assert420(inventory?.schema === '420-wallet-deployment-inventory-v1', 'unsupported wallet deployment inventory schema');
  assert420(inventory.readyForLiveTestnet === true, 'wallet deployment inventory is not live-testnet ready');
  assert420(inventory.network?.environment === 'testnet', 'wallet deployment inventory environment must be testnet');
  assert420(Array.isArray(inventory.conflicts) && inventory.conflicts.length === 0, 'wallet deployment inventory still contains canonical address conflicts');

  const expectedHexChainId = decimalChainIdToHex420(validatedManifest.network.chainId);
  assert420(normalizeHexQuantity420(runtimeConfig.network.chainId, 'runtime chainId') === expectedHexChainId, 'runtime chainId does not match manifest');
  assert420(runtimeConfig.network.rpcUrl === validatedManifest.rpc.http[0], 'runtime RPC URL does not match manifest primary RPC');
  assert420(runtimeConfig.network.explorerUrl === validatedManifest.services.explorer, 'runtime Explorer URL does not match manifest');
  assert420(runtimeConfig.deployment?.environment === 'testnet', 'runtime deployment environment must be testnet');
  assert420(runtimeConfig.deployment?.faucetUrl === validatedManifest.services.faucet, 'runtime Faucet URL does not match manifest');

  const authority = inventory.walletAuthority || {};
  const bindings = {
    entryPoint420: ['entryPointAddress', authority.entryPoint420],
    smartAccountFactory420: ['factoryAddress', authority.smartAccountFactory420],
    capabilityRegistry420: ['capabilityRegistryAddress', authority.capabilityRegistry420],
    protocolRegistry: ['protocolRegistryAddress', authority.protocolRegistry],
    names420: ['namesAddress', authority.names420],
    identity420: ['identityAddress', authority.identity420],
  };

  for (const [name, [runtimeKey, source]] of Object.entries(bindings)) {
    assert420(source, `inventory authority missing: ${name}`);
    const expected = normalizeAddress420(source.address, `inventory ${name}`);
    const actual = runtimeKey === 'factoryAddress'
      ? normalizeAddress420(runtimeConfig.smartAccount?.factoryAddress, 'runtime smartAccount factory')
      : normalizeAddress420(runtimeConfig.deployment?.[runtimeKey], `runtime ${runtimeKey}`);
    assert420(actual === expected, `runtime authority binding mismatch: ${name}`);
    assert420(!String(source.status || '').includes('PENDING'), `inventory authority remains pending: ${name}`);
    assert420(!String(source.status || '').includes('CONFLICTED'), `inventory authority remains conflicted: ${name}`);
  }

  return validatedManifest;
}

export async function qualifyWalletLiveTestnet420({
  manifest,
  inventory,
  runtimeConfig,
  fetchImpl = globalThis.fetch,
  minimumBlockNumber = 1n,
}) {
  assert420(typeof fetchImpl === 'function', 'fetch implementation required');
  const validatedManifest = assertQualificationInputs420({ manifest, inventory, runtimeConfig });
  const rpcUrl = runtimeConfig.network.rpcUrl;
  const expectedChainId = decimalChainIdToHex420(validatedManifest.network.chainId);

  const chainId = normalizeHexQuantity420(await rpc420(fetchImpl, rpcUrl, 'eth_chainId', [], 1), 'RPC chainId');
  assert420(chainId === expectedChainId, 'RPC chainId does not match selected manifest/runtime');

  const blockNumber = BigInt(normalizeHexQuantity420(await rpc420(fetchImpl, rpcUrl, 'eth_blockNumber', [], 2), 'RPC block number'));
  assert420(blockNumber >= BigInt(minimumBlockNumber), 'RPC block height is below qualification minimum');

  const authorityAddresses = {
    entryPoint420: runtimeConfig.deployment.entryPointAddress,
    smartAccountFactory420: runtimeConfig.smartAccount.factoryAddress,
    capabilityRegistry420: runtimeConfig.deployment.capabilityRegistryAddress,
    protocolRegistry: runtimeConfig.deployment.protocolRegistryAddress,
    names420: runtimeConfig.deployment.namesAddress,
    identity420: runtimeConfig.deployment.identityAddress,
  };

  const deployedCode = {};
  let id = 10;
  for (const [name, address] of Object.entries(authorityAddresses)) {
    const code = await rpc420(fetchImpl, rpcUrl, 'eth_getCode', [address, 'latest'], id++);
    assert420(typeof code === 'string' && /^0x[0-9a-fA-F]*$/.test(code), `${name} returned malformed bytecode`);
    assert420(code !== '0x' && code !== '0x0' && code.length > 4, `${name} has no deployed code`);
    deployedCode[name] = { address: address.toLowerCase(), byteLength: Math.max(0, (code.length - 2) / 2) };
  }

  const explorer = await serviceReachability420(fetchImpl, runtimeConfig.network.explorerUrl, 'Explorer');
  const faucet = await serviceReachability420(fetchImpl, runtimeConfig.deployment.faucetUrl, 'Faucet');

  return {
    schema: '420-wallet-live-testnet-qualification-v1',
    phase: 'W14.3',
    pass: true,
    environment: 'testnet',
    chainId,
    blockNumber: blockNumber.toString(),
    rpcUrl,
    authorityCode: deployedCode,
    services: { explorer, faucet },
  };
}

function parseArgs420(argv) {
  const args = {
    manifest: null,
    inventory: 'wallet/deployment-inventory.json',
    runtime: 'wallet/web/runtime-config.generated.json',
    output: null,
    minimumBlockNumber: '1',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    assert420(key.startsWith('--'), `unexpected argument: ${key}`);
    const name = key.slice(2);
    assert420(Object.hasOwn(args, name), `unsupported argument: --${name}`);
    const value = argv[++i];
    assert420(value && !value.startsWith('--'), `missing value for --${name}`);
    args[name] = value;
  }
  assert420(args.manifest, '--manifest is required');
  assert420(/^\d+$/.test(args.minimumBlockNumber), '--minimumBlockNumber must be a non-negative integer');
  return args;
}

async function readJson420(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new WalletLiveTestnetQualificationError420(`cannot read valid JSON from ${file}: ${error.message}`);
  }
}

export async function runWalletLiveTestnetQualification420(args) {
  const [manifest, inventory, runtimeConfig] = await Promise.all([
    readJson420(args.manifest),
    readJson420(args.inventory),
    readJson420(args.runtime),
  ]);

  const result = await qualifyWalletLiveTestnet420({
    manifest,
    inventory,
    runtimeConfig,
    minimumBlockNumber: BigInt(args.minimumBlockNumber),
  });

  if (args.output) {
    const output = path.resolve(args.output);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const thisPath = fileURLToPath(import.meta.url);
if (invokedPath === thisPath) {
  try {
    const args = parseArgs420(process.argv.slice(2));
    const result = await runWalletLiveTestnetQualification420(args);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ schema: '420-wallet-live-testnet-qualification-v1', phase: 'W14.3', pass: false, error: error.message }, null, 2) + '\n');
    process.exit(1);
  }
}
