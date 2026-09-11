import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdk420, createWalletSdk420, WalletSdkConfigurationError420 } from '../dist/index.js';

const controller = '0x0000000000000000000000000000000000000001';
const factoryAddress = '0x0000000000000000000000000000000000000421';
const capabilityAddress = '0x0000000000000000000000000000000000000422';
const smartAccount = '0x0000000000000000000000000000000000000423';
const sessionKey = '0x0000000000000000000000000000000000000002';

function sdk() {
  const entries = [
    { name: 'SmartAccountFactory420', protocol: '420Wallet', address: factoryAddress, source: 'genesis', version: '1.0.0', deploymentBlock: 0, artifact: 'factory.json', interface: 'IFactory.sol', abiSha256: 'a'.repeat(64), verified: true },
    { name: 'CapabilityRegistry420', protocol: '420Wallet', address: capabilityAddress, source: 'genesis', version: '1.0.0', deploymentBlock: 0, artifact: 'cap.json', interface: 'ICap.sol', abiSha256: 'b'.repeat(64), verified: true }
  ];
  const catalogue = {
    schemaVersion: '1.0.0', chainId: 420n, chainIdDecimal: '420',
    list: () => entries,
    get: (name) => entries.find((entry) => entry.name === name) ?? null,
    getByAddress: (address) => entries.find((entry) => entry.address === address.toLowerCase()) ?? null
  };
  const network = {
    schemaVersion: '1.0.0', name: '420 Local', environment: 'local', chainId: 420n, chainIdDecimal: '420',
    nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
    rpc: { http: ['http://127.0.0.1:8545'], websocket: [] },
    service: () => null, canRequestFaucet: true, isProduction: false
  };
  return createSdk420({ network, contracts: catalogue, transport: { request: async () => null } });
}

function provider(chainId = '0x1a4') {
  return {
    request: async (method) => {
      if (method === 'eth_chainId') return chainId;
      if (method === 'eth_accounts') return [controller];
      throw new Error(`unexpected method ${method}`);
    }
  };
}

function adapter(overrides = {}) {
  return {
    discoverSmartAccount: async (_provider, owner, config) => ({ controller: owner, smartAccount, deployed: true, factoryAddress: config.factoryAddress, capabilityRegistry: capabilityAddress }),
    prepareSessionUserOperation: async (_provider, state, key, request) => ({ state, key, request, broadcastReady: false }),
    sendPreparedSessionUserOperation: async (_provider, prepared) => ({ prepared, submitted: true }),
    confirmSessionUserOperation: async (_provider, submitted) => ({ submitted, confirmed: true }),
    ...overrides
  };
}

test('binds connected wallet to the SDK chain and canonical smart-account contracts', async () => {
  const wallet = createWalletSdk420({ sdk: sdk(), provider: provider(), adapter: adapter() });
  const connected = await wallet.connect();
  assert.equal(connected.controller, controller);
  assert.equal(connected.chainId, 420n);
  assert.equal(wallet.factory.address, factoryAddress);
  assert.equal(wallet.capabilityRegistry.address, capabilityAddress);

  const state = await wallet.discoverSmartAccount();
  assert.equal(state.smartAccount, smartAccount);
  const prepared = await wallet.prepareSession(state, sessionKey, { target: factoryAddress, data: '0x' });
  const submitted = await wallet.sendPreparedSession(prepared);
  const confirmed = await wallet.confirmSession(submitted);
  assert.equal(confirmed.confirmed, true);
});

test('fails closed when the connected wallet is on another chain', async () => {
  const wallet = createWalletSdk420({ sdk: sdk(), provider: provider('0x1a5'), adapter: adapter() });
  await assert.rejects(() => wallet.connect(), WalletSdkConfigurationError420);
});

test('rejects a wallet runtime that reports a non-canonical capability registry', async () => {
  const wallet = createWalletSdk420({
    sdk: sdk(), provider: provider(),
    adapter: adapter({ discoverSmartAccount: async (_provider, owner, config) => ({ controller: owner, smartAccount, deployed: true, factoryAddress: config.factoryAddress, capabilityRegistry: '0x0000000000000000000000000000000000000999' }) })
  });
  await assert.rejects(() => wallet.discoverSmartAccount(controller), /non-canonical capability registry/);
});

test('does not acquire signer authority in SDK core', async () => {
  const seen = [];
  const runtime = adapter({
    prepareSessionUserOperation: async (_provider, _state, key) => { seen.push(key); return { broadcastReady: false }; }
  });
  const wallet = createWalletSdk420({ sdk: sdk(), provider: provider(), adapter: runtime });
  const state = await wallet.discoverSmartAccount(controller);
  await wallet.prepareSession(state, sessionKey, { target: factoryAddress });
  assert.deepEqual(seen, [sessionKey]);
});
