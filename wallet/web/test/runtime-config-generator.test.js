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
      entryPoint420: { address: '0x000000000000000000000000000000000000041f', status: 'BOUND', deploymentVerified: true },
      smartAccountFactory420: { address: '0x0000000000000000000000000000000000000446', status: 'BOUND', deploymentVerified: true },
      capabilityRegistry420: { address: '0x0000000000000000000000000000000000000447', status: 'BOUND', deploymentVerified: true },
      protocolRegistry: { address: '0x0000000000000000000000000000000000000434', status: 'BOUND', deploymentVerified: true },
      names420: { address: '0x0000000000000000000000000000000000000435', status: 'BOUND', deploymentVerified: true },
      identity420: { address: '0x0000000000000000000000000000000000000436', status: 'BOUND', deploymentVerified: true },
    },
    appAuthority: {
      stake420: { address: '0x000000000000000000000000000000000000043a', status: 'BOUND', deploymentVerified: true },
      validatorRegistry: { address: '0x0000000000000000000000000000000000000423', status: 'BOUND', deploymentVerified: true },
      rewardController: { address: '0x0000000000000000000000000000000000000420', status: 'BOUND', deploymentVerified: true },
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
  assert.equal(config.smartAccount.factoryAddress, '0x0000000000000000000000000000000000000446');
  assert.equal(config.deployment.entryPointAddress, '0x000000000000000000000000000000000000041f');
  assert.equal(config.deployment.capabilityRegistryAddress, '0x0000000000000000000000000000000000000447');
  assert.equal(config.deployment.stakeAddress, '0x000000000000000000000000000000000000043a');
  assert.equal(config.deployment.validatorRegistryAddress, '0x0000000000000000000000000000000000000423');
  assert.equal(config.deployment.rewardControllerAddress, '0x0000000000000000000000000000000000000420');
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


test('W14.2 refuses live Stake runtime binding when frozen app addresses are not chain-verified', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = readyInventory420();
  inventory.appAuthority.stake420.deploymentVerified = false;
  assert.throws(
    () => buildWalletRuntimeConfig420({ manifest: testnetManifest420(), inventory, baseConfig }),
    /stake420 is not chain-verified/,
  );
});

test('qualified runtime generator rejects retired Wallet factory authority', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = readyInventory420();
  inventory.walletAuthority.smartAccountFactory420.address = '0x0000000000000000000000000000000000000420';
  assert.throws(() => buildWalletRuntimeConfig420({ manifest: testnetManifest420(), inventory, baseConfig }), /retired Genesis/);
});

test('qualified runtime generator rejects fake unverified Wallet deployment', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = readyInventory420();
  inventory.walletAuthority.capabilityRegistry420.deploymentVerified = false;
  assert.throws(() => buildWalletRuntimeConfig420({ manifest: testnetManifest420(), inventory, baseConfig }), /not chain-verified/);
});

test('qualified runtime generator preserves canonical Registry, Names and Identity', async () => {
  const baseConfig = await readJson('wallet/web/runtime-config.json');
  const inventory = readyInventory420();
  inventory.walletAuthority.protocolRegistry.address = '0x0000000000000000000000000000000000000422';
  assert.throws(() => buildWalletRuntimeConfig420({ manifest: testnetManifest420(), inventory, baseConfig }), /frozen Genesis namespace/);
});

test('Token runtime generation uses only bound deployment inventory and clears stale base pins',async()=>{
  const {fixture}=await import('./token-test-fixture.js');
  const {validateRuntimeConfig}=await import('../core/config.js');
  const {binding}=fixture();
  const inventory=readyInventory420();
  const baseConfig=await readJson('wallet/web/runtime-config.json');
  baseConfig.token={environment:'testnet',binding};
  const args={manifest:testnetManifest420(),inventory,baseConfig};
  assert.equal(buildWalletRuntimeConfig420(args).token,null);
  inventory.appAuthority.token420={status:'PENDING',environment:'testnet',deploymentVerified:false,binding};
  assert.equal(buildWalletRuntimeConfig420(args).token,null);
  inventory.walletAuthority.capabilityRegistry420.address=binding.vaultGraph.CapabilityRegistry420.address;
  inventory.appAuthority.token420={status:'BOUND',environment:'testnet',deploymentVerified:true,binding};
  const config=buildWalletRuntimeConfig420(args);
  assert.equal(config.token.binding.factory.address,binding.factory.address);
  assert.equal(config.token.binding.release.dependencyRoot,binding.release.dependencyRoot);
  assert.equal(validateRuntimeConfig(JSON.parse(JSON.stringify(config))),true);
  assert.deepEqual(config,buildWalletRuntimeConfig420(args));
  inventory.appAuthority.token420.environment='mainnet';
  assert.throws(()=>buildWalletRuntimeConfig420(args),/not bound to this environment/);
  inventory.appAuthority.token420.environment='testnet';
  inventory.appAuthority.token420.status='CONFLICTED';
  assert.throws(()=>buildWalletRuntimeConfig420(args),/not bound to this environment/);
  inventory.appAuthority.token420.status='BOUND';
  inventory.walletAuthority.capabilityRegistry420.address='0x0000000000000000000000000000000000000447';
  assert.throws(()=>buildWalletRuntimeConfig420(args),/CapabilityRegistry differs/);
});
