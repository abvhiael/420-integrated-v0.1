import { GENESIS_APP_SERVICES } from './genesis-app-catalog.js';

export const DEFAULT_NETWORK = Object.freeze({
  name: '420 Integrated',
  chainId: null,
  rpcUrl: null,
  explorerUrl: null,
});

export const CORE_SERVICES = GENESIS_APP_SERVICES;

function optionalAddress(value, label) {
  if (value == null) return;
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} must be an address`);
}

function validateGasQuoteConfig420(gasQuote) {
  if (gasQuote == null) return;
  if (typeof gasQuote !== 'object' || Array.isArray(gasQuote)) throw new TypeError('gasQuote config must be an object');
  if (gasQuote.enabled != null && typeof gasQuote.enabled !== 'boolean') throw new Error('gasQuote.enabled must be boolean');
  if (gasQuote.enabled === true) {
    if (typeof gasQuote.endpoint !== 'string' || !gasQuote.endpoint) throw new Error('gasQuote.endpoint is required when sponsorship is enabled');
    let url;
    try { url = new URL(gasQuote.endpoint); } catch { throw new Error('gasQuote.endpoint must be a valid URL'); }
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('gasQuote.endpoint must use HTTPS outside localhost');
  }
  for (const forbidden of ['token', 'credential', 'secret', 'apiKey', 'authorization']) {
    if (Object.prototype.hasOwnProperty.call(gasQuote, forbidden)) throw new Error(`gasQuote.${forbidden} must not be stored in Wallet runtime config`);
  }
}

export function validateRuntimeConfig(config) {
  if (!config || typeof config !== 'object') throw new TypeError('wallet runtime config required');
  if (!config.network || typeof config.network !== 'object') throw new TypeError('network config required');
  if (!Array.isArray(config.services)) throw new TypeError('services array required');
  if (config.network.rpcUrl && !/^https?:\/\//.test(config.network.rpcUrl)) throw new Error('rpcUrl must be http(s)');
  if (config.network.chainId != null && !/^0x[0-9a-fA-F]+$/.test(config.network.chainId)) throw new Error('chainId must be hex');
  if (!config.smartAccount || typeof config.smartAccount !== 'object') throw new TypeError('smartAccount config required');
  optionalAddress(config.smartAccount.factoryAddress, 'smartAccount.factoryAddress');
  optionalAddress(config.smartAccount.recoveryAuthority, 'smartAccount.recoveryAuthority');
  if (config.smartAccount.salt != null && !/^0x[0-9a-fA-F]{64}$/.test(config.smartAccount.salt)) throw new Error('smartAccount.salt must be bytes32');
  validateGasQuoteConfig420(config.gasQuote);
  if (!Array.isArray(config.trackedAssets)) throw new TypeError('trackedAssets array required');
  for (const asset of config.trackedAssets) {
    optionalAddress(asset.address, 'tracked asset address');
    if (!asset.address) throw new Error('tracked asset address required');
    if (asset.decimals != null && (!Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 255)) throw new Error('tracked asset decimals invalid');
  }
  return true;
}
