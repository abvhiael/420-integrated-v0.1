const REQUIRED_FEATURES = [
  'markets',
  'marketDetail',
  'swap',
  'limitOrders',
  'bridge',
  'portfolio',
  'walletConnection',
];

function isNullableUrl(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    if (!(url.protocol === 'https:' || url.protocol === 'wss:')) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function validateRuntimeConfig(config) {
  if (!config || config.schema !== '420-exchange-web-runtime-v14.1') {
    throw new Error('invalid exchange runtime schema');
  }
  if (config.site?.productionOrigin !== 'https://exchange.420integrated.org') {
    throw new Error('invalid exchange production origin');
  }
  if (config.api?.schemaMajor !== 14 || config.api?.schemaMinor !== 0) {
    throw new Error('unsupported V14 client schema');
  }
  if (!['websocket-or-sse', 'websocket', 'sse'].includes(config.api?.transport)) {
    throw new Error('invalid stream transport');
  }
  if (config.network?.chainId !== null && config.network?.chainId !== undefined) {
    if (typeof config.network.chainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(config.network.chainId)) {
      throw new Error('invalid chainId');
    }
  }
  if (config.api?.marketSubjects !== undefined) {
    if (!Array.isArray(config.api.marketSubjects) || config.api.marketSubjects.some((value) => typeof value !== 'string' || value.length === 0)) {
      throw new Error('invalid market subject list');
    }
    if (new Set(config.api.marketSubjects).size !== config.api.marketSubjects.length) {
      throw new Error('duplicate market subject');
    }
  }
  for (const key of REQUIRED_FEATURES) {
    if (typeof config.features?.[key] !== 'boolean') {
      throw new Error(`missing feature flag: ${key}`);
    }
  }
  for (const value of [
    config.network?.rpcUrl,
    config.network?.explorerUrl,
    config.api?.baseUrl,
    config.api?.streamUrl,
  ]) {
    if (!isNullableUrl(value)) throw new Error('invalid runtime URL');
  }
  return config;
}

export function availability(config, feature) {
  return Boolean(config?.features?.[feature]);
}
