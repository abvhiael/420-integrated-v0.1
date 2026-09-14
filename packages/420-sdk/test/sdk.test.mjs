import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdk420, SdkConfigurationError420 } from '../dist/index.js';

function network() {
  return {
    schemaVersion: '1.0.0',
    name: '420 Local Devnet',
    environment: 'local',
    chainId: 420n,
    chainIdDecimal: '420',
    nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
    rpc: { http: ['http://127.0.0.1:8545'], websocket: [] },
    service: (name) => name === 'indexer' ? 'http://127.0.0.1:4202' : null,
    canRequestFaucet: true,
    isProduction: false
  };
}

function catalogue(chainId = 420n, chainIdDecimal = '420') {
  const entry = {
    name: 'ProtocolRegistry',
    protocol: '420Registry',
    address: '0x0000000000000000000000000000000000000420',
    source: 'genesis',
    version: '1.0.0',
    deploymentBlock: 0,
    artifact: 'contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json',
    interface: 'contracts/src/interfaces/IProtocolRegistry.sol',
    abiSha256: 'a'.repeat(64),
    verified: true
  };
  return {
    schemaVersion: '1.0.0',
    chainId,
    chainIdDecimal,
    list: () => [entry],
    get: (name) => name === entry.name ? entry : null,
    getByAddress: (address) => address.toLowerCase() === entry.address ? entry : null
  };
}

test('binds network discovery and contract catalogue to one chain', async () => {
  const calls = [];
  const sdk = createSdk420({
    network: network(),
    contracts: catalogue(),
    transport: { request: async (endpoint, request) => { calls.push({ endpoint, request }); return '0x1'; } }
  });

  assert.equal(sdk.rpcHttp, 'http://127.0.0.1:8545');
  assert.equal(sdk.service('indexer'), 'http://127.0.0.1:4202');
  assert.equal(sdk.contract('ProtocolRegistry').protocol, '420Registry');
  assert.equal(sdk.contract('Missing420'), null);
  assert.equal(await sdk.rpc({ method: 'eth_blockNumber' }), '0x1');
  assert.equal(calls[0].endpoint, sdk.rpcHttp);
});

test('fails closed on network/catalogue chain mismatch', () => {
  assert.throws(() => createSdk420({
    network: network(),
    contracts: catalogue(421n, '421'),
    transport: { request: async () => null }
  }), SdkConfigurationError420);
});

test('rejects an RPC override not declared by network discovery', () => {
  assert.throws(() => createSdk420({
    network: network(),
    contracts: catalogue(),
    transport: { request: async () => null },
    rpcEndpoint: 'https://untrusted.example'
  }), /must be declared by network discovery/);
});
