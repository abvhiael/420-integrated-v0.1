export const DEFAULT_NETWORK = Object.freeze({
  name: '420 Integrated',
  chainId: null,
  rpcUrl: null,
  explorerUrl: null,
});

export const CORE_SERVICES = Object.freeze([
  { id: 'search', name: '420 Search', serviceId: '420/service/search/v1' },
  { id: 'appstore', name: '420 AppStore', serviceId: '420/service/appstore/v1' },
  { id: 'ai', name: '420 AI', serviceId: '420/service/ai/v1' },
  { id: 'token', name: '420 Token', serviceId: '420/service/token/v1' },
  { id: 'explorer', name: '420 Explorer', serviceId: '420/service/explorer/v1' },
  { id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1' },
  { id: 'bridge', name: '420 Bridge', serviceId: '420/service/bridge/v1' },
  { id: 'stake', name: '420 Stake', serviceId: '420/service/stake/v1' },
  { id: 'governance', name: '420 Governance', serviceId: '420/service/governance/v1' },
  { id: 'developers', name: 'Developer Hub', serviceId: '420/service/developers/v1' },
]);

function optionalAddress(value, label) {
  if (value == null) return;
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} must be an address`);
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
  if (!Array.isArray(config.trackedAssets)) throw new TypeError('trackedAssets array required');
  for (const asset of config.trackedAssets) {
    optionalAddress(asset.address, 'tracked asset address');
    if (!asset.address) throw new Error('tracked asset address required');
    if (asset.decimals != null && (!Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 255)) throw new Error('tracked asset decimals invalid');
  }
  return true;
}
