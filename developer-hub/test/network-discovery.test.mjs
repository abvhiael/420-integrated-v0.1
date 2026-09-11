import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverNetwork420, loadNetworkManifest420, NetworkManifestError420, validateNetworkManifest420 } from '../src/network-discovery.mjs';

const localManifestUrl = new URL('../manifests/local.example.json', import.meta.url);

test('loads and discovers the local DEVHUB manifest', async () => {
  const manifest = await loadNetworkManifest420(localManifestUrl);
  const network = discoverNetwork420(manifest);
  assert.equal(network.schemaVersion, '1.0.0');
  assert.equal(network.name, '420 Local Devnet');
  assert.equal(network.environment, 'local');
  assert.equal(network.chainId, 420n);
  assert.equal(network.chainIdDecimal, '420');
  assert.equal(network.nativeCurrency.symbol, '420');
  assert.equal(network.rpc.http[0], 'http://127.0.0.1:8545');
  assert.equal(network.service('indexer'), 'http://127.0.0.1:4202');
  assert.equal(network.contract('Registry420').address, '0x0000000000000000000000000000000000000420');
  assert.equal(network.canRequestFaucet, true);
  assert.equal(network.isProduction, false);
});

test('unknown services and contracts resolve to null without inventing data', async () => {
  const network = discoverNetwork420(await loadNetworkManifest420(localManifestUrl));
  assert.equal(network.service('missing'), null);
  assert.equal(network.contract('Missing420'), null);
});

test('fails closed on unsupported schema versions and fields', async () => {
  const manifest = await loadNetworkManifest420(localManifestUrl);
  assert.throws(() => validateNetworkManifest420({ ...manifest, schemaVersion: '2.0.0' }), NetworkManifestError420);
  assert.throws(() => validateNetworkManifest420({ ...manifest, unexpected: true }), /unsupported field/);
});

test('rejects malformed chain identity, addresses, and endpoints', async () => {
  const manifest = await loadNetworkManifest420(localManifestUrl);
  assert.throws(() => validateNetworkManifest420({ ...manifest, network: { ...manifest.network, chainId: '0' } }), /chainId/);
  assert.throws(() => validateNetworkManifest420({
    ...manifest,
    contracts: { Registry420: { ...manifest.contracts.Registry420, address: '0x1234' } }
  }), /address is invalid/);
  assert.throws(() => validateNetworkManifest420({
    ...manifest,
    rpc: { ...manifest.rpc, http: ['not a uri'] }
  }), /valid URI/);
});

test('mainnet manifests fail closed when a faucet is advertised', async () => {
  const manifest = await loadNetworkManifest420(localManifestUrl);
  assert.throws(() => validateNetworkManifest420({
    ...manifest,
    network: { ...manifest.network, environment: 'mainnet' }
  }), /mainnet manifest must not expose a faucet/);
});

test('mainnet discovery is production and faucet-disabled when faucet is absent', async () => {
  const manifest = await loadNetworkManifest420(localManifestUrl);
  const { faucet, ...services } = manifest.services;
  void faucet;
  const network = discoverNetwork420({
    ...manifest,
    network: { ...manifest.network, environment: 'mainnet' },
    services
  });
  assert.equal(network.isProduction, true);
  assert.equal(network.canRequestFaucet, false);
  assert.equal(network.service('faucet'), null);
});
