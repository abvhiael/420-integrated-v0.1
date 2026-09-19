export const EXCHANGE_TESTNET_SCHEMA = '420-exchange-testnet-runtime-v15.1';
export const EXCHANGE_TESTNET_STATUS = Object.freeze({
  UNRESOLVED: 'UNRESOLVED_UNTIL_DEPLOYMENT',
  RESOLVED: 'RESOLVED',
});

export const REQUIRED_EXCHANGE_CONTRACTS = Object.freeze([
  'ExchangeAtomicRouter420',
  'ExchangeLimitOrderSettlement420',
  'ExchangeBridgeQualification420',
  'Wrapped420',
  'ExchangeAssetRegistry420',
  'ExchangeMarketRegistry420',
  'ExchangeRouteRegistry420',
  'ExchangeOracleGuard420',
  'ExchangeEmergencyControl420',
]);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function fail(message) {
  throw new Error(`invalid Exchange testnet deployment: ${message}`);
}

function secureUrl(value, label, { stream = false } = {}) {
  if (typeof value !== 'string' || !value) fail(`missing ${label}`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`invalid ${label}`);
  }
  const allowed = stream ? new Set(['https:', 'wss:']) : new Set(['https:']);
  if (!allowed.has(url.protocol) || url.username || url.password) fail(`insecure ${label}`);
  return value;
}

function address(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) fail(`invalid ${label}`);
  if (value.toLowerCase() === ZERO_ADDRESS) fail(`zero ${label}`);
  return value;
}

function chainId(value) {
  if (typeof value !== 'string' || !/^0x[1-9a-fA-F][0-9a-fA-F]*$/.test(value)) fail('invalid chainId');
  return '0x' + BigInt(value).toString(16);
}

export function inspectExchangeTestnetDeployment(input) {
  if (!input || input.schema !== EXCHANGE_TESTNET_SCHEMA) fail('schema');
  if (input.environment !== 'testnet') fail('environment');
  if (!Object.values(EXCHANGE_TESTNET_STATUS).includes(input.status)) fail('status');

  const unresolved = input.status === EXCHANGE_TESTNET_STATUS.UNRESOLVED;
  if (unresolved) {
    return Object.freeze({
      resolved: false,
      status: input.status,
      blockers: Object.freeze([
        'chain identity',
        'RPC endpoint',
        'Explorer endpoint',
        'V13 Exchange API endpoint',
        'V13 Exchange stream endpoint',
        'Exchange contract addresses',
      ]),
    });
  }

  const normalizedContracts = {};
  for (const name of REQUIRED_EXCHANGE_CONTRACTS) {
    normalizedContracts[name] = address(input.contracts?.[name], name);
  }

  if (!Array.isArray(input.marketSubjects)) fail('marketSubjects');
  if (new Set(input.marketSubjects).size !== input.marketSubjects.length) fail('duplicate market subject');
  for (const subject of input.marketSubjects) {
    if (typeof subject !== 'string' || !subject) fail('invalid market subject');
  }

  return Object.freeze({
    resolved: true,
    status: input.status,
    environment: 'testnet',
    network: Object.freeze({
      name: String(input.network?.name || '420 Integrated Testnet'),
      chainId: chainId(input.network?.chainId),
      rpcUrl: secureUrl(input.network?.rpcUrl, 'RPC URL'),
      explorerUrl: secureUrl(input.network?.explorerUrl, 'Explorer URL'),
    }),
    services: Object.freeze({
      exchangeApiUrl: secureUrl(input.services?.exchangeApiUrl, 'Exchange API URL'),
      exchangeStreamUrl: secureUrl(input.services?.exchangeStreamUrl, 'Exchange stream URL', { stream: true }),
    }),
    contracts: Object.freeze(normalizedContracts),
    marketSubjects: Object.freeze([...input.marketSubjects]),
  });
}

export function bindExchangeRuntime(template, deployment) {
  const resolved = inspectExchangeTestnetDeployment(deployment);
  if (!resolved.resolved) fail('testnet deployment is unresolved');
  if (!template || template.schema !== '420-exchange-web-runtime-v14.1') fail('runtime template');

  return {
    ...template,
    network: {
      ...template.network,
      name: resolved.network.name,
      chainId: resolved.network.chainId,
      rpcUrl: resolved.network.rpcUrl,
      explorerUrl: resolved.network.explorerUrl,
    },
    api: {
      ...template.api,
      baseUrl: resolved.services.exchangeApiUrl,
      streamUrl: resolved.services.exchangeStreamUrl,
      marketSubjects: [...resolved.marketSubjects],
    },
    contracts: { ...resolved.contracts },
    deployment: {
      schema: EXCHANGE_TESTNET_SCHEMA,
      environment: resolved.environment,
      status: resolved.status,
    },
  };
}
