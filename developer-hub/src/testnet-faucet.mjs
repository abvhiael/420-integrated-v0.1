const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class FaucetError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'FaucetError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new FaucetError420(message);
}

function normalizeAddress420(address) {
  assert420(typeof address === 'string' && ADDRESS_RE.test(address), 'developer test-account address is invalid');
  return address.toLowerCase();
}

function validateEndpoint420(endpoint) {
  assert420(typeof endpoint === 'string' && endpoint.length > 0, 'canonical faucet endpoint is unavailable');
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new FaucetError420('canonical faucet endpoint is invalid');
  }
  assert420(parsed.protocol === 'http:' || parsed.protocol === 'https:', 'canonical faucet endpoint must use HTTP(S)');
  return endpoint;
}

export function createDeveloperTestAccount420(address, label = 'developer') {
  const normalized = normalizeAddress420(address);
  assert420(typeof label === 'string' && label.length > 0 && label.length <= 64, 'developer test-account label is invalid');
  return Object.freeze({
    address: normalized,
    label,
    custody: 'external-wallet',
    secretMaterialManaged: false
  });
}

export function createFaucetClient420({ network, transport }) {
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(network.environment === 'testnet', 'remote faucet requests are testnet-only');
  assert420(network.canRequestFaucet === true, 'selected testnet does not expose faucet capability');
  assert420(typeof network.service === 'function', 'discovered network service resolver is required');
  const endpoint = validateEndpoint420(network.service('faucet'));
  assert420(transport && typeof transport.request === 'function', 'faucet transport is required');

  return Object.freeze({
    endpoint,
    requestFunds: async (accountInput) => {
      const account = typeof accountInput === 'string'
        ? createDeveloperTestAccount420(accountInput)
        : createDeveloperTestAccount420(accountInput?.address, accountInput?.label ?? 'developer');
      const serviceResponse = await transport.request(endpoint, Object.freeze({ address: account.address }));
      assert420(serviceResponse && typeof serviceResponse === 'object' && !Array.isArray(serviceResponse), 'faucet service returned an invalid response');
      return Object.freeze({
        network: network.name,
        chainId: network.chainIdDecimal,
        address: account.address,
        endpoint,
        submitted: true,
        canonicalBalanceProof: false,
        serviceResponse: structuredClone(serviceResponse)
      });
    }
  });
}
