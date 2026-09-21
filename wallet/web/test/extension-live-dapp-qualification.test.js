import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertExtensionLiveDappInputs420,
  qualifyExtensionLiveDapp420,
  qualifyExtensionPackageSurface420,
} from '../../extension/scripts/qualify-live-dapp.mjs';

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

function extensionConfig420() {
  return {
    schema: '420-wallet-extension-live-config-v1',
    environment: 'testnet',
    rpcUrl: 'https://rpc.testnet.example.org',
    accounts: ['0x0000000000000000000000000000000000000abc'],
    smartAccountConfig: {
      factoryAddress: '0x0000000000000000000000000000000000000420',
      entryPointAddress: '0x000000000000000000000000000000000000041f',
      capabilityRegistryAddress: '0x0000000000000000000000000000000000000421',
      recoveryAuthority: '0x0000000000000000000000000000000000000000',
      salt: '0x' + '00'.repeat(32),
    },
  };
}

function packageSources420() {
  return {
    serviceWorker: [
      'eth_requestAccounts','eth_accounts','eth_sendTransaction','personal_sign','eth_signTypedData_v4',
      'accountsFor(origin)','setAccounts(origin, selected)','origin !== senderOrigin','frameId','LOCAL_AUTHORITY_METHODS',
      'sensitive wallet methods cannot use RPC signing or submission authority','eth_sendUserOperation',
      'eth_getUserOperationReceipt','accountsChanged',
    ].join(' '),
    inpage: 'is420Wallet: true eip6963:announceProvider accountsChanged chainChanged',
    contentScript: 'event.source !== window event.origin !== origin chrome.runtime.sendMessage',
    popup: 'Review this request carefully before approving. approve reject',
    authority: 'createExtensionLocalAuthority420 navigatorLike: navigator 420-wallet-passkey-bindings-v1',
  };
}

function mockFetch420({ chainId = '0x1a4' } = {}) {
  return async (url, options = {}) => {
    if (options.method === 'POST') {
      const request = JSON.parse(options.body);
      let result;
      if (request.method === 'eth_chainId') result = chainId;
      else if (request.method === 'eth_blockNumber') result = '0x2a';
      else if (request.method === 'eth_getCode') result = '0x6001600055';
      else throw new Error(`unexpected RPC method: ${request.method}`);
      return { ok: true, status: 200, async json() { return { jsonrpc: '2.0', id: request.id, result }; } };
    }
    return { ok: true, status: 200 };
  };
}

test('W14.4 qualifies extension/runtime authority consistency', () => {
  assert.equal(assertExtensionLiveDappInputs420({ runtimeConfig: runtime420(), extensionConfig: extensionConfig420() }), true);
});

test('W14.4 qualifies provider injection, approvals and local authority package surface', () => {
  assert.equal(qualifyExtensionPackageSurface420(packageSources420()), true);
});

test('W14.4 completes live dApp qualification against qualified testnet fixtures', async () => {
  const result = await qualifyExtensionLiveDapp420({
    manifest: manifest420(),
    inventory: inventory420(),
    runtimeConfig: runtime420(),
    extensionConfig: extensionConfig420(),
    packageSources: packageSources420(),
    fetchImpl: mockFetch420(),
    minimumBlockNumber: 1n,
  });
  assert.equal(result.pass, true);
  assert.equal(result.phase, 'W14.4');
  assert.equal(result.providerInjectionQualified, true);
  assert.equal(result.originApprovalQualified, true);
  assert.equal(result.signingReviewQualified, true);
  assert.equal(result.localAuthorityQualified, true);
  assert.equal(result.transactionSubmissionQualified, true);
  assert.equal(result.smartAccountAuthorityConsistent, true);
});

test('W14.4 rejects extension RPC drift from Wallet runtime', () => {
  const config = extensionConfig420();
  config.rpcUrl = 'https://other.example.org';
  assert.throws(
    () => assertExtensionLiveDappInputs420({ runtimeConfig: runtime420(), extensionConfig: config }),
    /extension RPC URL does not match Wallet runtime/,
  );
});

test('W14.4 rejects SmartAccount authority drift', () => {
  const config = extensionConfig420();
  config.smartAccountConfig.entryPointAddress = '0x0000000000000000000000000000000000000999';
  assert.throws(
    () => assertExtensionLiveDappInputs420({ runtimeConfig: runtime420(), extensionConfig: config }),
    /extension EntryPoint does not match Wallet runtime/,
  );
});

test('W14.4 rejects missing provider approval surface', () => {
  const sources = packageSources420();
  sources.serviceWorker = sources.serviceWorker.replace('eth_requestAccounts', '');
  assert.throws(
    () => qualifyExtensionPackageSurface420(sources),
    /missing qualification marker: eth_requestAccounts/,
  );
});

test('W14.4 rejects live extension chain drift', async () => {
  await assert.rejects(
    qualifyExtensionLiveDapp420({
      manifest: manifest420(),
      inventory: inventory420(),
      runtimeConfig: runtime420(),
      extensionConfig: extensionConfig420(),
      packageSources: packageSources420(),
      fetchImpl: mockFetch420({ chainId: '0x1a5' }),
    }),
    /RPC chainId does not match|extension RPC chain differs/,
  );
});
