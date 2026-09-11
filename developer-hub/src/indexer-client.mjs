const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const DIRECTIONS = new Set(['asc', 'desc']);
const API_VERSION = 'v1';

export class IndexerClientError420 extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'IndexerClientError420';
    this.status = status;
    this.code = code;
  }
}

function assert420(condition, message) {
  if (!condition) throw new IndexerClientError420(message);
}

function httpBase420(value) {
  assert420(typeof value === 'string' && value.length > 0, 'selected network exposes no 420Indexer service');
  let url;
  try { url = new URL(value); } catch { throw new IndexerClientError420('420Indexer service URL is invalid'); }
  assert420(url.protocol === 'http:' || url.protocol === 'https:', '420Indexer service must use HTTP(S)');
  assert420(!url.username && !url.password, '420Indexer service URL must not embed credentials');
  return url.toString().replace(/\/$/, '');
}

function chainId420(network) {
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(typeof network.chainIdDecimal === 'string' && /^[1-9][0-9]*$/.test(network.chainIdDecimal), 'discovered network chainId is invalid');
  return network.chainIdDecimal;
}

function page420(options = {}) {
  const out = {};
  if (options.cursor !== undefined) {
    assert420(typeof options.cursor === 'string' && options.cursor.length > 0 && options.cursor.length <= 2048, 'cursor is invalid');
    out.cursor = options.cursor;
  }
  if (options.limit !== undefined) {
    assert420(Number.isInteger(options.limit) && options.limit >= 1 && options.limit <= 200, 'limit must be an integer between 1 and 200');
    out.limit = String(options.limit);
  }
  if (options.direction !== undefined) {
    assert420(DIRECTIONS.has(options.direction), 'direction must be asc or desc');
    out.direction = options.direction;
  }
  return out;
}

function cleanSegment420(value, name) {
  assert420(typeof value === 'string' && value.length > 0 && value.length <= 512, `${name} is invalid`);
  return encodeURIComponent(value);
}

function address420(value) {
  assert420(typeof value === 'string' && ADDRESS_RE.test(value), 'address is invalid');
  return value.toLowerCase();
}

function hash420(value, name = 'hash') {
  assert420(typeof value === 'string' && HASH_RE.test(value), `${name} is invalid`);
  return value.toLowerCase();
}

function qs420(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

function normalizeEnvelope420(payload) {
  assert420(payload && typeof payload === 'object' && !Array.isArray(payload), '420Indexer returned an invalid envelope');
  assert420(payload.apiVersion === API_VERSION, `unsupported 420Indexer API version: ${String(payload.apiVersion)}`);
  if (payload.error) {
    const code = typeof payload.error.code === 'string' ? payload.error.code : 'indexer_error';
    const message = typeof payload.error.message === 'string' ? payload.error.message : '420Indexer request failed';
    throw new IndexerClientError420(message, { code });
  }
  assert420(Object.prototype.hasOwnProperty.call(payload, 'data'), '420Indexer envelope is missing data');
  return payload.data;
}

export function createIndexerClient420({ network, transport }) {
  const chainId = chainId420(network);
  assert420(typeof network.service === 'function', 'discovered network service resolver is required');
  const baseUrl = httpBase420(network.service('indexer'));
  assert420(transport && typeof transport.request === 'function', '420Indexer transport is required');

  async function get420(path, params = {}, { allowStatuses = [200] } = {}) {
    const url = `${baseUrl}${path}${qs420(params)}`;
    const response = await transport.request(url, { method: 'GET' });
    assert420(response && typeof response === 'object', '420Indexer transport returned no response');
    const status = Number(response.status);
    if (!allowStatuses.includes(status)) {
      let code = null;
      let message = `420Indexer HTTP ${status}`;
      if (response.body && typeof response.body === 'object' && response.body.error) {
        code = response.body.error.code ?? null;
        message = response.body.error.message ?? message;
      }
      throw new IndexerClientError420(message, { status, code });
    }
    return normalizeEnvelope420(response.body);
  }

  const chain = (extra = {}) => ({ chainId, ...extra });

  return Object.freeze({
    apiVersion: API_VERSION,
    baseUrl,
    chainId,
    canonicalAuthority: false,
    projectionSource: '420Indexer',
    health: () => get420('/health'),
    readiness: () => get420('/ready', chain(), { allowStatuses: [200, 503] }),
    status: () => get420('/v1/status', chain()),
    blocks: (options = {}) => get420('/v1/blocks', chain(page420(options))),
    block: (id) => get420(`/v1/blocks/${cleanSegment420(id, 'block id')}`, chain()),
    transactions: (options = {}) => get420('/v1/transactions', chain({ ...page420(options), address: options.address ? address420(options.address) : undefined })),
    transaction: (hash) => get420(`/v1/transactions/${cleanSegment420(hash420(hash, 'transaction hash'), 'transaction hash')}`, chain()),
    receipt: (hash) => get420(`/v1/transactions/${cleanSegment420(hash420(hash, 'transaction hash'), 'transaction hash')}/receipt`, chain()),
    logs: (options = {}) => get420('/v1/logs', chain({ ...page420(options), address: options.address ? address420(options.address) : undefined })),
    address: (address) => get420(`/v1/addresses/${cleanSegment420(address420(address), 'address')}`, chain()),
    assetTransfers: (options = {}) => {
      if (options.beforeBlock !== undefined) assert420(typeof options.beforeBlock === 'string' && /^\d+$/.test(options.beforeBlock), 'beforeBlock must be an unsigned decimal string');
      return get420('/v1/assets/transfers', chain({ ...page420(options), assetKey: options.assetKey, address: options.address ? address420(options.address) : undefined, beforeBlock: options.beforeBlock }));
    },
    protocolEvents: (options = {}) => get420('/v1/protocols/events', chain({ ...page420(options), protocol: options.protocol, objectKey: options.objectKey })),
    protocolObject: (protocol, objectKey) => get420(`/v1/protocols/${cleanSegment420(protocol, 'protocol')}/objects/${cleanSegment420(objectKey, 'object key')}`, chain()),
    search: (term, limit) => {
      assert420(typeof term === 'string' && term.trim().length > 0, 'search term is required');
      if (limit !== undefined) assert420(Number.isInteger(limit) && limit >= 1 && limit <= 200, 'limit must be an integer between 1 and 200');
      return get420('/v1/search', chain({ q: term.trim(), limit }));
    },
    diagnostics: async () => Object.freeze({
      schemaVersion: '1.0.0',
      source: '420Indexer',
      canonicalAuthority: false,
      chainId,
      baseUrl,
      health: await get420('/health'),
      readiness: await get420('/ready', chain(), { allowStatuses: [200, 503] }),
      status: await get420('/v1/status', chain())
    })
  });
}

export function createIndexerControlView420(client) {
  assert420(client && client.apiVersion === API_VERSION, 'DEVHUB-11 indexer client is required');
  return Object.freeze({
    title: '420Indexer developer queries',
    apiVersion: client.apiVersion,
    chainId: client.chainId,
    service: client.baseUrl,
    source: '420Indexer',
    canonicalAuthority: false,
    securityRule: 'indexed projections must not authorize protocol state transitions',
    supportedResources: Object.freeze(['blocks', 'transactions', 'receipts', 'logs', 'addresses', 'asset-transfers', 'protocol-events', 'protocol-objects', 'search', 'diagnostics'])
  });
}
