import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonRpcProvider420 } from '../core/provider.js';
import { CORE_SERVICES, validateRuntimeConfig } from '../core/config.js';
import { resolveServices } from '../core/services.js';
import { decodeAddress, encodeGetAddress, ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import { discoverSmartAccount } from '../core/accounts.js';
import { formatUnits, readNetwork, readPortfolio } from '../core/portfolio.js';

const controller = '0x1111111111111111111111111111111111111111';
const factory = '0x2222222222222222222222222222222222222222';
const account = '0x3333333333333333333333333333333333333333';
const registry = '0x4444444444444444444444444444444444444444';
const entryPoint = '0x5555555555555555555555555555555555555555';
const wordAddress = (a) => `0x${'0'.repeat(24)}${a.slice(2)}`;
const wordUint = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;

function runtimeConfig(overrides = {}) {
  return {
    network: { rpcUrl: null, chainId: null },
    services: [],
    smartAccount: { factoryAddress: null, recoveryAuthority: null, salt: ZERO_BYTES32 },
    trackedAssets: [],
    ...overrides,
  };
}

test('runtime config accepts deferred production endpoints and smart account deployment', () => {
  assert.equal(validateRuntimeConfig(runtimeConfig()), true);
});

test('runtime config rejects malformed canonical smart account factory address', () => {
  assert.throws(() => validateRuntimeConfig(runtimeConfig({ smartAccount: { factoryAddress: '0x1234', salt: ZERO_BYTES32 } })));
});

test('verified manifest resolves known core services and leaves missing services unavailable', () => {
  const services = resolveServices({
    schema: '420-ecosystem-manifest-v1',
    verified: true,
    services: [{ serviceId: '420/service/search/v1', name: '420 Search', url: 'https://search.example/' }],
  }, CORE_SERVICES);
  assert.equal(services.find((service) => service.id === 'search').available, true);
  assert.equal(services.find((service) => service.id === 'ai').available, false);
});

test('unverified ecosystem manifest fails closed', () => {
  assert.throws(() => resolveServices({ schema: '420-ecosystem-manifest-v1', verified: false, services: [] }, CORE_SERVICES));
});

test('json rpc provider sends standard JSON-RPC request', async () => {
  let body;
  const provider = new JsonRpcProvider420({
    rpcUrl: 'https://rpc.example/',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ jsonrpc: '2.0', id: body.id, result: '0x420' }) };
    },
  });
  assert.equal(await provider.request('eth_chainId'), '0x420');
  assert.equal(body.method, 'eth_chainId');
});

test('factory getAddress calldata uses the canonical SmartAccountFactory420 selector', () => {
  const data = encodeGetAddress(controller, ZERO_ADDRESS, ZERO_BYTES32);
  assert.equal(data.slice(0, 10), '0x49d27e27');
  assert.equal(data.length, 2 + 8 + 64 * 3);
});

test('counterfactual smart account discovery predicts through factory and confirms no code', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return wordAddress(account);
    if (method === 'eth_getCode') return '0x';
    throw new Error(method);
  } };
  const found = await discoverSmartAccount(provider, controller, { factoryAddress: factory, recoveryAuthority: ZERO_ADDRESS, salt: ZERO_BYTES32 });
  assert.equal(found.smartAccount, account);
  assert.equal(found.deployed, false);
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_getCode']);
});

test('deployed smart account state is read from SmartAccount420 getters', async () => {
  const provider = { request: async (method, params) => {
    if (method === 'eth_getCode') return '0x60016000';
    if (method !== 'eth_call') throw new Error(method);
    const data = params[0].data.slice(0, 10);
    const results = {
      '0x49d27e27': wordAddress(account),
      '0x8da5cb5b': wordAddress(controller),
      '0x8a957938': wordAddress(ZERO_ADDRESS),
      '0x6d5f87be': wordUint(7),
      '0x7d5366f4': wordUint(3),
      '0xe5f1af38': wordAddress(ZERO_ADDRESS),
      '0x93261b5b': wordUint(0),
      '0xb0d691fe': wordAddress(entryPoint),
      '0xc9de3b48': wordAddress(registry),
    };
    if (!results[data]) throw new Error(`unexpected selector ${data}`);
    return results[data];
  } };
  const found = await discoverSmartAccount(provider, controller, { factoryAddress: factory, recoveryAuthority: ZERO_ADDRESS, salt: ZERO_BYTES32 });
  assert.equal(found.deployed, true);
  assert.equal(found.owner, controller);
  assert.equal(found.controllerIsOwner, true);
  assert.equal(found.authorizationEpoch, 7n);
  assert.equal(found.authorizationPolicyVersion, 3n);
  assert.equal(found.entryPoint, entryPoint);
  assert.equal(found.capabilityRegistry, registry);
});

test('network reads flag a chain mismatch fail-closed condition', async () => {
  const provider = { request: async (method) => method === 'eth_chainId' ? '0x420' : '0x2a' };
  const network = await readNetwork(provider, '0x421');
  assert.equal(network.chainMismatch, true);
  assert.equal(network.blockNumber, 42n);
});

test('portfolio reads native balances for controller and smart account', async () => {
  const provider = { request: async (method) => {
    if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
    throw new Error(method);
  } };
  const portfolio = await readPortfolio(provider, [controller, account], []);
  assert.equal(portfolio.native.length, 2);
  assert.equal(portfolio.native[0].raw, 1000000000000000000n);
  assert.equal(formatUnits(portfolio.native[0].raw, 18), '1');
});

test('ABI address decoder rejects malformed responses', () => {
  assert.throws(() => decodeAddress('0x1234'));
});
