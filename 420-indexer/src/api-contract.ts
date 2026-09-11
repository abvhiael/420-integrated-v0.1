export type IndexerApiRouteScope420 = 'global' | 'chain';

export interface IndexerApiRoute420 {
  id: string;
  method: 'GET';
  path: string;
  scope: IndexerApiRouteScope420;
  paged: boolean;
  description: string;
}

export const INDEXER_V1_ROUTES_420: readonly IndexerApiRoute420[] = [
  { id: 'health', method: 'GET', path: '/health', scope: 'global', paged: false, description: 'process liveness' },
  { id: 'readiness', method: 'GET', path: '/ready', scope: 'chain', paged: false, description: 'database and indexed-head readiness' },
  { id: 'version', method: 'GET', path: '/v1', scope: 'global', paged: false, description: 'public API version metadata' },
  { id: 'status', method: 'GET', path: '/v1/status', scope: 'chain', paged: false, description: 'indexed head and finality metadata' },
  { id: 'blocks', method: 'GET', path: '/v1/blocks', scope: 'chain', paged: true, description: 'paged canonical block projection' },
  { id: 'block', method: 'GET', path: '/v1/blocks/:id', scope: 'chain', paged: false, description: 'block by number or hash' },
  { id: 'transactions', method: 'GET', path: '/v1/transactions', scope: 'chain', paged: true, description: 'paged transaction projection' },
  { id: 'transaction', method: 'GET', path: '/v1/transactions/:hash', scope: 'chain', paged: false, description: 'transaction by hash' },
  { id: 'receipt', method: 'GET', path: '/v1/transactions/:hash/receipt', scope: 'chain', paged: false, description: 'transaction receipt by hash' },
  { id: 'logs', method: 'GET', path: '/v1/logs', scope: 'chain', paged: true, description: 'paged canonical log projection' },
  { id: 'address', method: 'GET', path: '/v1/addresses/:address', scope: 'chain', paged: false, description: 'indexed address metadata' },
  { id: 'asset-transfers', method: 'GET', path: '/v1/assets/transfers', scope: 'chain', paged: true, description: 'paged normalized asset transfers' },
  { id: 'protocol-events', method: 'GET', path: '/v1/protocols/events', scope: 'chain', paged: true, description: 'paged typed protocol events' },
  { id: 'protocol-object', method: 'GET', path: '/v1/protocols/:protocol/objects/:key', scope: 'chain', paged: false, description: 'latest typed protocol object state' },
  { id: 'search', method: 'GET', path: '/v1/search', scope: 'chain', paged: false, description: 'bounded deterministic index search' }
] as const;

export const INDEXER_API_CONSUMERS_420 = [
  '420Explorer',
  '420Search',
  '420Analytics',
  '420Wallet',
  '420Notifications',
  'Developer Hub'
] as const;
