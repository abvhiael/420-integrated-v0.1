import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateNetworkManifest420 } from '../../../developer-hub/src/network-discovery.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_SALT = '0x' + '00'.repeat(32);
const LIVE_ENVIRONMENTS = new Set(['testnet', 'mainnet']);
const REQUIRED_LIVE_GATES = [
  'officialTestnetManifestPublished',
  'canonicalAddressConflictResolved',
  'entryPointProductionBytecodeBound',
  'rpcChainIdentityQualified',
  'canonicalWalletContractsHaveCode',
  'faucetAndExplorerPublished',
];

export class WalletRuntimeConfigGenerationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletRuntimeConfigGenerationError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new WalletRuntimeConfigGenerationError420(message);
}

function decimalChainIdToHex420(value) {
  assert420(/^[1-9][0-9]*$/.test(String(value)), 'manifest chainId must be a positive decimal string');
  return `0x${BigInt(value).toString(16)}`;
}

function assertSecureEndpoint420(raw, label, environment) {
  if (raw == null) return;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new WalletRuntimeConfigGenerationError420(`${label} must be a valid URL`);
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (environment === 'local' && localHost) return;
  assert420(url.protocol === 'https:', `${label} must use HTTPS outside local development`);
}

function assertInventoryAuthority420(inventory) {
  const authority = inventory?.walletAuthority;
  assert420(authority && typeof authority === 'object', 'wallet deployment inventory authority block missing');

  const required = ['entryPoint420', 'smartAccountFactory420', 'capabilityRegistry420', 'protocolRegistry', 'names420', 'identity420'];
  for (const key of required) {
    const item = authority[key];
    assert420(item && ADDRESS_RE.test(item.address || ''), `wallet authority ${key} address missing or invalid`);
    const state = String(item.status || '');
    assert420(!state.includes('CONFLICTED'), `wallet authority ${key} remains conflicted`);
    assert420(!state.includes('PENDING'), `wallet authority ${key} remains pending`);
  }
  return authority;
}

function assertLiveInventoryReady420(inventory, environment) {
  assert420(inventory?.schema === '420-wallet-deployment-inventory-v1', 'unsupported wallet deployment inventory schema');
  assert420(inventory?.network?.environment === environment, 'wallet deployment inventory environment does not match manifest');
  assert420(String(inventory?.network?.expectedChainId) === String(inventory?.network?.expectedChainId || ''), 'wallet deployment inventory chain id missing');

  if (!LIVE_ENVIRONMENTS.has(environment)) return;

  assert420(inventory.readyForLiveTestnet === true, 'wallet deployment inventory is not ready for live testnet/runtime generation');
  const gates = inventory.releaseGates || {};
  for (const gate of REQUIRED_LIVE_GATES) {
    assert420(gates[gate] === true, `wallet deployment release gate unresolved: ${gate}`);
  }
  assert420(Array.isArray(inventory.conflicts) && inventory.conflicts.length === 0, 'wallet deployment inventory still contains canonical address conflicts');
}

export function buildWalletRuntimeConfig420({ manifest, inventory, baseConfig, manifestUrl = null }) {
  const validatedManifest = validateNetworkManifest420(manifest);
  const environment = validatedManifest.network.environment;

  assert420(baseConfig?.schema === '420-wallet-runtime-config-v1', 'unsupported wallet runtime base schema');
  assert420(inventory?.schema === '420-wallet-deployment-inventory-v1', 'unsupported wallet deployment inventory schema');

  const expectedChainId = String(inventory?.network?.expectedChainId || '');
  assert420(expectedChainId.length > 0, 'wallet deployment inventory expected chain id missing');
  assert420(validatedManifest.network.chainId === expectedChainId, 'network manifest chain id does not match wallet deployment inventory');

  if (LIVE_ENVIRONMENTS.has(environment)) {
    assertLiveInventoryReady420(inventory, environment);
  }

  const authority = assertInventoryAuthority420(inventory);
  const rpcUrl = validatedManifest.rpc.http[0];
  const explorerUrl = validatedManifest.services.explorer ?? null;
  const faucetUrl = validatedManifest.services.faucet ?? null;

  assertSecureEndpoint420(rpcUrl, 'network RPC', environment);
  assertSecureEndpoint420(explorerUrl, 'Explorer URL', environment);
  assertSecureEndpoint420(faucetUrl, 'Faucet URL', environment);
  if (manifestUrl != null) assertSecureEndpoint420(manifestUrl, 'manifest URL', environment);

  if (environment === 'testnet') {
    assert420(explorerUrl !== null, 'testnet manifest must publish Explorer service');
    assert420(faucetUrl !== null, 'testnet manifest must publish Faucet service');
  }
  if (environment === 'mainnet') {
    assert420(faucetUrl === null, 'mainnet runtime must not expose Faucet service');
  }

  return {
    ...structuredClone(baseConfig),
    network: {
      name: validatedManifest.network.name,
      chainId: decimalChainIdToHex420(validatedManifest.network.chainId),
      rpcUrl,
      explorerUrl,
    },
    smartAccount: {
      ...structuredClone(baseConfig.smartAccount || {}),
      factoryAddress: authority.smartAccountFactory420.address,
      recoveryAuthority: baseConfig.smartAccount?.recoveryAuthority ?? null,
      salt: baseConfig.smartAccount?.salt ?? ZERO_SALT,
    },
    manifest: {
      url: manifestUrl,
      verificationMode: 'registry-or-signed-manifest',
    },
    deployment: {
      environment,
      entryPointAddress: authority.entryPoint420.address,
      capabilityRegistryAddress: authority.capabilityRegistry420.address,
      protocolRegistryAddress: authority.protocolRegistry.address,
      namesAddress: authority.names420.address,
      identityAddress: authority.identity420.address,
      faucetUrl,
      sourceInventoryPhase: inventory.phase,
    },
  };
}

function parseArgs420(argv) {
  const args = {
    manifest: null,
    inventory: 'wallet/deployment-inventory.json',
    base: 'wallet/web/runtime-config.json',
    output: null,
    manifestUrl: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new WalletRuntimeConfigGenerationError420(`unexpected argument: ${key}`);
    const name = key.slice(2);
    assert420(Object.hasOwn(args, name), `unsupported argument: --${name}`);
    const value = argv[++i];
    assert420(value && !value.startsWith('--'), `missing value for --${name}`);
    args[name] = value;
  }
  assert420(args.manifest, '--manifest is required');
  return args;
}

async function readJson420(file) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new WalletRuntimeConfigGenerationError420(`cannot read ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new WalletRuntimeConfigGenerationError420(`invalid JSON in ${file}: ${error.message}`);
  }
}

export async function generateWalletRuntimeConfig420(args) {
  const manifest = await readJson420(args.manifest);
  const inventory = await readJson420(args.inventory);
  const baseConfig = await readJson420(args.base);
  const config = buildWalletRuntimeConfig420({ manifest, inventory, baseConfig, manifestUrl: args.manifestUrl });

  if (args.output) {
    const outputPath = path.resolve(args.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(config, null, 2) + '\n', { flag: 'w' });
  }
  return config;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const thisPath = fileURLToPath(import.meta.url);
if (invokedPath === thisPath) {
  try {
    const args = parseArgs420(process.argv.slice(2));
    const config = await generateWalletRuntimeConfig420(args);
    process.stdout.write(JSON.stringify({ pass: true, generated: Boolean(args.output), output: args.output, config }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ pass: false, error: error.message }, null, 2) + '\n');
    process.exit(1);
  }
}
