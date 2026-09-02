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

export function validateRuntimeConfig(config) {
  if (!config || typeof config !== 'object') throw new TypeError('wallet runtime config required');
  if (!config.network || typeof config.network !== 'object') throw new TypeError('network config required');
  if (!Array.isArray(config.services)) throw new TypeError('services array required');
  if (config.network.rpcUrl && !/^https?:\/\//.test(config.network.rpcUrl)) throw new Error('rpcUrl must be http(s)');
  return true;
}
