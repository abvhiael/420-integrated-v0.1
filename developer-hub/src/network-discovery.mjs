import { readFile } from 'node:fs/promises';

const ENVIRONMENTS = new Set(['local', 'devnet', 'testnet', 'mainnet']);
const CONTRACT_SOURCES = new Set(['genesis', 'registry', 'governance', 'deployment-manifest']);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CHAIN_ID_RE = /^[1-9][0-9]*$/;

export class NetworkManifestError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkManifestError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new NetworkManifestError420(message);
}

function assertOnlyKeys420(value, allowed, path) {
  for (const key of Object.keys(value)) {
    assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);
  }
}

function object420(value, path) {
  assert420(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value;
}

function string420(value, path) {
  assert420(typeof value === 'string' && value.length > 0, `${path} must be a non-empty string`);
  return value;
}

function uri420(value, path) {
  const raw = string420(value, path);
  try {
    return new URL(raw);
  } catch {
    throw new NetworkManifestError420(`${path} must be a valid URI`);
  }
}

export function validateNetworkManifest420(input) {
  const manifest = object420(input, 'manifest');
  assertOnlyKeys420(manifest, new Set(['schemaVersion', 'network', 'nativeCurrency', 'rpc', 'services', 'contracts']), 'manifest');
  assert420(manifest.schemaVersion === '1.0.0', 'unsupported network manifest schemaVersion');

  const network = object420(manifest.network, 'network');
  assertOnlyKeys420(network, new Set(['name', 'environment', 'chainId']), 'network');
  string420(network.name, 'network.name');
  assert420(ENVIRONMENTS.has(network.environment), 'network.environment is unsupported');
  assert420(typeof network.chainId === 'string' && CHAIN_ID_RE.test(network.chainId), 'network.chainId must be a positive decimal string');

  const nativeCurrency = object420(manifest.nativeCurrency, 'nativeCurrency');
  assertOnlyKeys420(nativeCurrency, new Set(['name', 'symbol', 'decimals']), 'nativeCurrency');
  string420(nativeCurrency.name, 'nativeCurrency.name');
  assert420(nativeCurrency.symbol === '420', 'nativeCurrency.symbol must be 420');
  assert420(Number.isInteger(nativeCurrency.decimals) && nativeCurrency.decimals >= 0 && nativeCurrency.decimals <= 255, 'nativeCurrency.decimals is invalid');

  const rpc = object420(manifest.rpc, 'rpc');
  assertOnlyKeys420(rpc, new Set(['http', 'websocket']), 'rpc');
  assert420(Array.isArray(rpc.http) && rpc.http.length > 0, 'rpc.http must contain at least one endpoint');
  rpc.http.forEach((endpoint, i) => uri420(endpoint, `rpc.http[${i}]`));
  if (rpc.websocket !== undefined) {
    assert420(Array.isArray(rpc.websocket), 'rpc.websocket must be an array');
    rpc.websocket.forEach((endpoint, i) => uri420(endpoint, `rpc.websocket[${i}]`));
  }

  const services = object420(manifest.services, 'services');
  assertOnlyKeys420(services, new Set(['explorer', 'indexer', 'verify', 'status', 'faucet']), 'services');
  for (const [name, endpoint] of Object.entries(services)) uri420(endpoint, `services.${name}`);
  assert420(!(network.environment === 'mainnet' && Object.hasOwn(services, 'faucet')), 'mainnet manifest must not expose a faucet');

  const contracts = object420(manifest.contracts, 'contracts');
  for (const [name, raw] of Object.entries(contracts)) {
    const contract = object420(raw, `contracts.${name}`);
    assertOnlyKeys420(contract, new Set(['address', 'source', 'version']), `contracts.${name}`);
    assert420(ADDRESS_RE.test(contract.address), `contracts.${name}.address is invalid`);
    assert420(CONTRACT_SOURCES.has(contract.source), `contracts.${name}.source is invalid`);
    if (contract.version !== undefined) string420(contract.version, `contracts.${name}.version`);
  }

  return structuredClone(manifest);
}

export async function loadNetworkManifest420(source) {
  const text = source instanceof URL
    ? await readFile(source, 'utf8')
    : await readFile(String(source), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new NetworkManifestError420(`network manifest is not valid JSON: ${error.message}`);
  }
  return validateNetworkManifest420(parsed);
}

export function discoverNetwork420(manifestInput) {
  const manifest = validateNetworkManifest420(manifestInput);
  const environment = manifest.network.environment;
  const service = (name) => manifest.services[name] ?? null;
  const contract = (name) => manifest.contracts[name] ? structuredClone(manifest.contracts[name]) : null;

  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    name: manifest.network.name,
    environment,
    chainId: BigInt(manifest.network.chainId),
    chainIdDecimal: manifest.network.chainId,
    nativeCurrency: Object.freeze({ ...manifest.nativeCurrency }),
    rpc: Object.freeze({
      http: Object.freeze([...manifest.rpc.http]),
      websocket: Object.freeze([...(manifest.rpc.websocket ?? [])])
    }),
    service,
    contract,
    canRequestFaucet: environment !== 'mainnet' && service('faucet') !== null,
    isProduction: environment === 'mainnet'
  });
}
