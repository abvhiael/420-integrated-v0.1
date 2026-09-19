import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  WalletRuntimeConfigGenerationError420,
  buildWalletRuntimeConfig420,
} from '../scripts/generate-runtime-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));

function readyInventory420(environment = 'testnet') {
  return {
    schema: '420-wallet-deployment-inventory-v1',
    phase: 'W14.2-test-fixture',
    status: 'READY',
    readyForLiveTestnet: true,
    network: { environment, expectedChainId: '420' },
    walletAuthority: {
      entryPoint420: { address: '0x000000000000000000000000000000000000041f', status: 'BOUND' },
      smartAccountFactory420: { address: '0x0000000000000000000000000000000000000420', status: 'BOUND' },
      capabilityRegistry420: { address: '0x0000000000000000000000000000000000000421', status: 'BOUND' },
      protocolRegistry: { address: '0x0000000000000000000000000000000000000422', status: 'BOUND' },
      names420: { address: '0x0000000000000000000000000000000000000423', status: 'BOUND' },
      identity420: { address: '0x0000000000000000000000000000000000000424', status: 'BOUND' },
    },
    conflicts: [],
    releaseGates: {
      officialTestnetManifestPublished: true,
      canonicalAddressConflictResolved: true,
      entryPointProductionBytecodeBound: true,
      rpcChainIdentityQualified: true,
      canonicalWalletContractsHaveCode: true,
      faucetAndExplorerPublished: true,
      walletRuntimeConfigGenerated: false,
    },
  };
}

function testnetManifest420(overrides = {}) {
  const manifest = {
    schemaVersion: '1.0.0',
    network: { name: '420 Public Testnet', environment: 'testnet', chainId: '420' },
    nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
    rpc: { http: ['https://rpc.testnet.example.org'], websocket: ['wss://rpc.testnet.example.org/ws'] },
    services: {
      explorer: 'https://explorer.testnet.example.org',
      faucet: 'https://faucet.testnet.example.org',
      status: 'https://status.testnet.example.org',
    },
    contracts: {},
  };
  return { ...manifest, ...overrides };
}

test('W14.2 builds deterministic live-testnet runtime config from qualified inputs', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const config = buildWalletRuntimeConfig420({
    manifest: testnetManifest420(),
    inventory: readyInventory420(),
    baseConfig,
    manifestUrl: 'https://420integrated.org/manifests/testnet.json',
  });

  assert.equal(config.network.name, '420 Public Testnet');
  assert.equal(config.network.chainId, '0x1a4');
  assert.equal(config.network.rpcUrl, 'https://rpc.testnet.example.org');
  assert.equal(config.network.explorerUrl, 'https://explorer.testnet.example.org');
  assert.equal(config.smartAccount.factoryAddress, '0x0000000000000000000000000000000000000420');
  assert.equal(config.deployment.entryPointAddress, '0x000000000000000000000000000000000000041f');
  assert.equal(config.deployment.capabilityRegistryAddress, '0x0000000000000000000000000000000000000421');
  assert.equal(config.deployment.faucetUrl, 'https://faucet.testnet.example.org');
  assert.equal(config.manifest.url, 'https://420integrated.org/manifests/testnet.json');
  assert.equal(config.manifest.verificationMode, 'registry-or-signed-manifest');
  assert.equal(config.features.passkeys, true);
  assert.equal(config.features.batchExecution, true);
});

test('W14.2 fails closed against the current unresolved W14.1 inventory', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = await readJson('wallet/deployment-inventory.json');
  assert.throws(
    () => buildWalletRuntimeConfig420({
      manifest: testnetManifest420(),
      inventory,
      baseConfig,
      manifestUrl: 'https://420integrated.org/manifests/testnet.json',
    }),
    (error) => error instanceof WalletRuntimeConfigGenerationError420
      && /not ready for live testnet/.test(error.message),
  );
});

test('W14.2 rejects manifest chain-id drift', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const manifest = testnetManifest420();
  manifest.network.chainId = '421';
  assert.throws(
    () => buildWalletRuntimeConfig420({ manifest, inventory: readyInventory420(), baseConfig }),
    /chain id does not match/,
  );
});

test('W14.2 rejects insecure public RPC endpoints', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const manifest = testnetManifest420();
  manifest.rpc.http = ['http://rpc.testnet.example.org'];
  assert.throws(
    () => buildWalletRuntimeConfig420({ manifest, inventory: readyInventory420(), baseConfig }),
    /network RPC must use HTTPS/,
  );
});

test('W14.2 rejects unresolved authority states even when release gates claim ready', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = readyInventory420();
  inventory.walletAuthority.smartAccountFactory420.status = 'FROZEN_BUT_CONFLICTED';
  assert.throws(
    () => buildWalletRuntimeConfig420({ manifest: testnetManifest420(), inventory, baseConfig }),
    /smartAccountFactory420 remains conflicted/,
  );
});

test('W14.2 requires Explorer and Faucet publication for testnet', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const manifest = testnetManifest420();
  delete manifest.services.faucet;
  assert.throws(
    () => buildWalletRuntimeConfig420({ manifest, inventory: readyInventory420(), baseConfig }),
    /testnet manifest must publish Faucet/,
  );
});
