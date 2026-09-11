import type { RpcUpstreamDescriptor420, RpcUpstreamDiscovery420, RpcUpstreamRegistry420 } from './upstreams.js';

export type RpcDerivedResource420 =
  | 'status'
  | 'blocks'
  | 'block'
  | 'transactions'
  | 'transaction'
  | 'receipt'
  | 'logs'
  | 'address'
  | 'asset-transfers'
  | 'protocol-events'
  | 'protocol-object'
  | 'search';

export interface RpcDerivedDefinition420 {
  resource: RpcDerivedResource420;
  route: string;
  paged: boolean;
  requiredParams: readonly string[];
}

export const RPC8_DERIVED_RESOURCES_420: readonly RpcDerivedDefinition420[] = [
  { resource: 'status', route: '/v1/status', paged: false, requiredParams: [] },
  { resource: 'blocks', route: '/v1/blocks', paged: true, requiredParams: [] },
  { resource: 'block', route: '/v1/blocks/:id', paged: false, requiredParams: ['id'] },
  { resource: 'transactions', route: '/v1/transactions', paged: true, requiredParams: [] },
  { resource: 'transaction', route: '/v1/transactions/:hash', paged: false, requiredParams: ['hash'] },
  { resource: 'receipt', route: '/v1/transactions/:hash/receipt', paged: false, requiredParams: ['hash'] },
  { resource: 'logs', route: '/v1/logs', paged: true, requiredParams: [] },
  { resource: 'address', route: '/v1/addresses/:address', paged: false, requiredParams: ['address'] },
  { resource: 'asset-transfers', route: '/v1/assets/transfers', paged: true, requiredParams: [] },
  { resource: 'protocol-events', route: '/v1/protocols/events', paged: true, requiredParams: [] },
  { resource: 'protocol-object', route: '/v1/protocols/:protocol/objects/:key', paged: false, requiredParams: ['protocol', 'key'] },
  { resource: 'search', route: '/v1/search', paged: false, requiredParams: ['q'] },
] as const;

const BY_RESOURCE = new Map(RPC8_DERIVED_RESOURCES_420.map((item) => [item.resource, item] as const));
const PATH_VALUE = /^[A-Za-z0-9._:-]+$/;

export interface RpcDerivedReadInput420 {
  resource: RpcDerivedResource420;
  params?: Readonly<Record<string, string | number | bigint | undefined>>;
}

export interface RpcIndexerHttpRequest420 {
  upstreamId: string;
  endpoint: string;
  path: string;
  query: Readonly<Record<string, string>>;
}

export interface RpcIndexerProjectionMetadata420 {
  chainId: bigint;
  indexedHead: bigint;
  observedAtMs: number;
  ready: boolean;
  authoritative: false;
}

export interface RpcDerivedEnvelope420<T = unknown> {
  source: '420Indexer';
  derived: true;
  authoritative: false;
  chainId: string;
  upstreamId: string;
  indexedHead: string;
  observedAtMs: number;
  data: T;
}

function encodeValue(value: string | number | bigint): string {
  return typeof value === 'bigint' ? value.toString(10) : String(value);
}

function replaceRouteParams(definition: RpcDerivedDefinition420, params: Readonly<Record<string, string | number | bigint | undefined>>): string {
  let route = definition.route;
  for (const name of definition.requiredParams) {
    const raw = params[name];
    if (raw === undefined || raw === '') throw new Error(`missing required derived-read parameter: ${name}`);
    const value = encodeValue(raw);
    if (!PATH_VALUE.test(value)) throw new Error(`invalid derived-read path parameter: ${name}`);
    route = route.replace(`:${name}`, encodeURIComponent(value));
  }
  return route;
}

export function selectIndexerUpstream420(
  registry: RpcUpstreamRegistry420,
  discoveries: readonly RpcUpstreamDiscovery420[],
): RpcUpstreamDescriptor420 {
  const discoveryById = new Map(discoveries.map((item) => [item.id, item] as const));
  const candidates = registry.upstreams
    .filter((descriptor) => {
      const discovery = discoveryById.get(descriptor.id);
      return descriptor.enabled
        && descriptor.class === 'indexer-api'
        && descriptor.authoritative === false
        && descriptor.allowsTransactionSubmission === false
        && (descriptor.transport === 'http' || descriptor.transport === 'https')
        && discovery?.eligible === true
        && discovery.class === 'indexer-api'
        && discovery.observedChainId === registry.expectedChainId
        && discovery.capabilities.includes('derived-read');
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  if (candidates.length === 0) throw new Error('no eligible 420Indexer derived-read upstream is available');
  return candidates[0];
}

export function buildIndexerDerivedRequest420(
  descriptor: RpcUpstreamDescriptor420,
  expectedChainId: bigint,
  input: RpcDerivedReadInput420,
): RpcIndexerHttpRequest420 {
  if (descriptor.class !== 'indexer-api' || descriptor.authoritative || descriptor.allowsTransactionSubmission) {
    throw new Error('derived reads require a non-authoritative read-only indexer upstream');
  }
  if (descriptor.expectedChainId !== expectedChainId) throw new Error('indexer descriptor chain ID does not match gateway chain ID');
  if (descriptor.transport !== 'http' && descriptor.transport !== 'https') throw new Error('derived reads require HTTP(S) indexer transport');

  const definition = BY_RESOURCE.get(input.resource);
  if (!definition) throw new Error(`unsupported derived resource: ${String(input.resource)}`);
  const params = input.params ?? {};
  const path = replaceRouteParams(definition, params);
  const query: Record<string, string> = { chainId: expectedChainId.toString(10) };
  const pathParams = new Set(definition.requiredParams);
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || pathParams.has(key)) continue;
    const value = encodeValue(raw);
    if (value.length === 0 || value.length > 512) throw new Error(`invalid derived-read query parameter: ${key}`);
    query[key] = value;
  }
  return { upstreamId: descriptor.id, endpoint: descriptor.endpoint, path, query };
}

export function validateIndexerProjectionMetadata420(
  metadata: RpcIndexerProjectionMetadata420,
  expectedChainId = 420n,
  nowMs = metadata.observedAtMs,
  maxObservationAgeMs = 30_000,
): string[] {
  const errors: string[] = [];
  if (metadata.chainId !== expectedChainId) errors.push('indexer projection metadata is for the wrong chain');
  if (metadata.authoritative !== false) errors.push('indexer projection metadata must be non-authoritative');
  if (!metadata.ready) errors.push('indexer projection is not ready');
  if (metadata.indexedHead < 0n) errors.push('indexed head must be non-negative');
  if (!Number.isFinite(metadata.observedAtMs) || metadata.observedAtMs < 0) errors.push('observation time must be non-negative and finite');
  if (!Number.isFinite(nowMs) || nowMs < 0) errors.push('current time must be non-negative and finite');
  if (!Number.isInteger(maxObservationAgeMs) || maxObservationAgeMs <= 0) errors.push('maxObservationAgeMs must be a positive integer');
  if (errors.length === 0) {
    if (metadata.observedAtMs > nowMs) errors.push('indexer projection observation is from the future');
    else if (nowMs - metadata.observedAtMs > maxObservationAgeMs) errors.push('indexer projection observation is stale');
  }
  return errors;
}

export function wrapIndexerDerivedResponse420<T>(
  upstreamId: string,
  metadata: RpcIndexerProjectionMetadata420,
  data: T,
  expectedChainId = 420n,
  nowMs = metadata.observedAtMs,
): RpcDerivedEnvelope420<T> {
  if (!upstreamId.trim()) throw new Error('upstreamId must be non-empty');
  const errors = validateIndexerProjectionMetadata420(metadata, expectedChainId, nowMs);
  if (errors.length > 0) throw new Error(`unsafe indexer projection metadata: ${errors.join('; ')}`);
  return {
    source: '420Indexer',
    derived: true,
    authoritative: false,
    chainId: metadata.chainId.toString(10),
    upstreamId,
    indexedHead: metadata.indexedHead.toString(10),
    observedAtMs: metadata.observedAtMs,
    data,
  };
}

export function validateRpc8DerivedProfile420(): string[] {
  const errors: string[] = [];
  const resources = new Set<string>();
  const routes = new Set<string>();
  for (const definition of RPC8_DERIVED_RESOURCES_420) {
    if (resources.has(definition.resource)) errors.push(`duplicate derived resource: ${definition.resource}`);
    if (routes.has(definition.route)) errors.push(`duplicate derived route: ${definition.route}`);
    resources.add(definition.resource);
    routes.add(definition.route);
    if (!definition.route.startsWith('/v1/')) errors.push(`derived route is outside 420Indexer v1: ${definition.route}`);
  }
  return errors;
}
