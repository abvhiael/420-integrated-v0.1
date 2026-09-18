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
    return url.protocol === 'https:' || url.protocol === 'wss:';
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
