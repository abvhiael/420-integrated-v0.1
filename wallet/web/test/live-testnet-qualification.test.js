import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WalletLiveTestnetQualificationError420,
  assertQualificationInputs420,
  qualifyWalletLiveTestnet420,
} from '../scripts/qualify-live-testnet.mjs';

function manifest420() {
  return {
    schemaVersion: '1.0.0',
    network: { name: '420 Public Testnet', environment: 'testnet', chainId: '420' },
    nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
    rpc: { http: ['https://rpc.testnet.example.org'] },
    services: {
      explorer: 'https://explorer.testnet.example.org',
      faucet: 'https://faucet.testnet.example.org',
    },
    contracts: {},
  };
}

function inventory420() {
  return {
    schema: '420-wallet-deployment-inventory-v1',
    phase: 'W14.2-qualified-fixture',
    readyForLiveTestnet: true,
    network: { environment: 'testnet', expectedChainId: '420' },
    conflicts: [],
    walletAuthority: {
      entryPoint420: { address: '0x000000000000000000000000000000000000041f', status: 'BOUND' },
      smartAccountFactory420: { address: '0x0000000000000000000000000000000000000420', status: 'BOUND' },
      capabilityRegistry420: { address: '0x0000000000000000000000000000000000000421', status: 'BOUND' },
      protocolRegistry: { address: '0x0000000000000000000000000000000000000422', status: 'BOUND' },
      names420: { address: '0x0000000000000000000000000000000000000423', status: 'BOUND' },
      identity420: { address: '0x0000000000000000000000000000000000000424', status: 'BOUND' },
    },
  };
}

function runtime420() {
  return {
    schema: '420-wallet-runtime-config-v1',
    network: {
      name: '420 Public Testnet',
      chainId: '0x1a4',
      rpcUrl: 'https://rpc.testnet.example.org',
      explorerUrl: 'https://explorer.testnet.example.org',
    },
    smartAccount: {
      factoryAddress: '0x0000000000000000000000000000000000000420',
      recoveryAuthority: null,
      salt: '0x' + '00'.repeat(32),
    },
    gasQuote: { enabled: false, endpoint: null },
    trackedAssets: [],
    manifest: { url: 'https://420integrated.org/manifests/testnet.json', verificationMode: 'registry-or-signed-manifest' },
    services: [],
    features: {},
    deployment: {
      environment: 'testnet',
      entryPointAddress: '0x000000000000000000000000000000000000041f',
      capabilityRegistryAddress: '0x0000000000000000000000000000000000000421',
      protocolRegistryAddress: '0x0000000000000000000000000000000000000422',
      namesAddress: '0x0000000000000000000000000000000000000423',
      identityAddress: '0x0000000000000000000000000000000000000424',
      faucetUrl: 'https://faucet.testnet.example.org',
    },
  };
}

function mockFetch420({ chainId = '0x1a4', blockNumber = '0x2a', missingCodeAt = null, serviceStatus = 200 } = {}) {
  return async (url, options = {}) => {
    if (options.method === 'POST') {
      const request = JSON.parse(options.body);
      let result;
      if (request.method === 'eth_chainId') result = chainId;
      else if (request.method === 'eth_blockNumber') result = blockNumber;
      else if (request.method === 'eth_getCode') {
        const address = String(request.params[0]).toLowerCase();
        result = missingCodeAt && address === missingCodeAt.toLowerCase() ? '0x' : '0x6001600055';
      } else {
        throw new Error(`unexpected RPC method: ${request.method}`);
      }
      return {
        ok: true,
        status: 200,
        async json() { return { jsonrpc: '2.0', id: request.id, result }; },
      };
    }
    return { ok: serviceStatus >= 200 && serviceStatus < 400, status: serviceStatus };
  };
}

test('W14.3 qualifies chain identity, authority code and public services', async () => {
  const result = await qualifyWalletLiveTestnet420({
    manifest: manifest420(),
    inventory: inventory420(),
    runtimeConfig: runtime420(),
    fetchImpl: mockFetch420(),
    minimumBlockNumber: 10n,
  });

  assert.equal(result.pass, true);
  assert.equal(result.phase, 'W14.3');
  assert.equal(result.chainId, '0x1a4');
  assert.equal(result.blockNumber, '42');
  assert.equal(Object.keys(result.authorityCode).length, 6);
  assert.equal(result.authorityCode.smartAccountFactory420.byteLength, 5);
  assert.equal(result.services.explorer.status, 200);
  assert.equal(result.services.faucet.status, 200);
});

test('W14.3 rejects an unresolved W14.1/W14.2 inventory', () => {
  const inventory = inventory420();
  inventory.readyForLiveTestnet = false;
  assert.throws(
    () => assertQualificationInputs420({ manifest: manifest420(), inventory, runtimeConfig: runtime420() }),
    /not live-testnet ready/,
  );
});

test('W14.3 rejects runtime/manifest chain drift before network access', () => {
  const runtime = runtime420();
  runtime.network.chainId = '0x1a5';
  assert.throws(
    () => assertQualificationInputs420({ manifest: manifest420(), inventory: inventory420(), runtimeConfig: runtime }),
    /runtime chainId does not match manifest/,
  );
});

test('W14.3 rejects live RPC chain identity drift', async () => {
  await assert.rejects(
    qualifyWalletLiveTestnet420({
      manifest: manifest420(),
      inventory: inventory420(),
      runtimeConfig: runtime420(),
      fetchImpl: mockFetch420({ chainId: '0x1a5' }),
    }),
    /RPC chainId does not match/,
  );
});

test('W14.3 rejects missing canonical authority bytecode', async () => {
  await assert.rejects(
    qualifyWalletLiveTestnet420({
      manifest: manifest420(),
      inventory: inventory420(),
      runtimeConfig: runtime420(),
      fetchImpl: mockFetch420({ missingCodeAt: '0x0000000000000000000000000000000000000421' }),
    }),
    /capabilityRegistry420 has no deployed code/,
  );
});

test('W14.3 rejects an RPC below the requested minimum block height', async () => {
  await assert.rejects(
    qualifyWalletLiveTestnet420({
      manifest: manifest420(),
      inventory: inventory420(),
      runtimeConfig: runtime420(),
      fetchImpl: mockFetch420({ blockNumber: '0x3' }),
      minimumBlockNumber: 4n,
    }),
    /block height is below qualification minimum/,
  );
});

test('W14.3 rejects unreachable Explorer or Faucet service', async () => {
  await assert.rejects(
    qualifyWalletLiveTestnet420({
      manifest: manifest420(),
      inventory: inventory420(),
      runtimeConfig: runtime420(),
      fetchImpl: mockFetch420({ serviceStatus: 503 }),
    }),
    /Explorer is unreachable/,
  );
});
