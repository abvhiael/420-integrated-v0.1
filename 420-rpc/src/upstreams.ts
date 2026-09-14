import type { RpcTransport420, RpcUpstreamClass420 } from './architecture.js';

export type RpcUpstreamCapability420 =
  | 'chain-identity'
  | 'client-version'
  | 'head-read'
  | 'safe-read'
  | 'finalized-read'
  | 'transaction-submission'
  | 'subscriptions'
  | 'derived-read';

export interface RpcUpstreamDescriptor420 {
  id: string;
  class: RpcUpstreamClass420;
  endpoint: string;
  transport: RpcTransport420;
  expectedChainId: bigint;
  authoritative: boolean;
  allowsTransactionSubmission: boolean;
  enabled: boolean;
  priority: number;
}

export interface JsonRpcRequester420 {
  request(method: string, params?: readonly unknown[]): Promise<unknown>;
}

export interface IndexerMetadata420 {
  chainId: bigint;
  service: string;
  ready: boolean;
  authoritative: false;
}

export interface IndexerMetadataReader420 {
  metadata(): Promise<IndexerMetadata420>;
}

export interface RpcUpstreamDiscovery420 {
  id: string;
  class: RpcUpstreamClass420;
  reachable: boolean;
  eligible: boolean;
  expectedChainId: bigint;
  observedChainId: bigint | null;
  capabilities: readonly RpcUpstreamCapability420[];
  clientVersion: string | null;
  reasons: readonly string[];
}

export interface RpcUpstreamRegistry420 {
  expectedChainId: bigint;
  upstreams: readonly RpcUpstreamDescriptor420[];
}

function isHttpTransport(transport: RpcTransport420): boolean {
  return transport === 'http' || transport === 'https';
}

function isWsTransport(transport: RpcTransport420): boolean {
  return transport === 'ws' || transport === 'wss';
}

function endpointScheme420(endpoint: string): string | null {
  try {
    return new URL(endpoint).protocol.replace(':', '');
  } catch {
    return null;
  }
}

function parseQuantity420(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function validateUpstreamDescriptor420(descriptor: RpcUpstreamDescriptor420, expectedChainId = 420n): string[] {
  const errors: string[] = [];
  if (!descriptor.id.trim()) errors.push('upstream ID must be non-empty');
  if (!descriptor.endpoint.trim()) errors.push(`upstream ${descriptor.id || '<empty>'} endpoint must be non-empty`);
  if (!Number.isInteger(descriptor.priority) || descriptor.priority < 0) errors.push(`upstream ${descriptor.id} priority must be a non-negative integer`);
  if (descriptor.expectedChainId !== expectedChainId) errors.push(`upstream ${descriptor.id} is pinned to the wrong chain ID`);

  const scheme = endpointScheme420(descriptor.endpoint);
  if (scheme !== descriptor.transport) errors.push(`upstream ${descriptor.id} endpoint scheme does not match transport ${descriptor.transport}`);
  if (descriptor.class === 'indexer-api' && !isHttpTransport(descriptor.transport)) errors.push(`indexer upstream ${descriptor.id} must use HTTP(S)`);

  if (descriptor.class === 'execution-rpc') {
    if (!descriptor.authoritative) errors.push(`execution upstream ${descriptor.id} must represent canonical execution reads`);
  } else {
    if (descriptor.authoritative) errors.push(`indexer upstream ${descriptor.id} must remain non-authoritative`);
    if (descriptor.allowsTransactionSubmission) errors.push(`indexer upstream ${descriptor.id} must not accept transaction submission`);
  }

  return errors;
}

export function validateUpstreamRegistry420(registry: RpcUpstreamRegistry420): string[] {
  const errors: string[] = [];
  if (registry.expectedChainId <= 0n) errors.push('registry expected chain ID must be positive');
  const ids = new Set<string>();
  for (const upstream of registry.upstreams) {
    errors.push(...validateUpstreamDescriptor420(upstream, registry.expectedChainId));
    if (ids.has(upstream.id)) errors.push(`duplicate upstream ID: ${upstream.id}`);
    ids.add(upstream.id);
  }
  if (!registry.upstreams.some((upstream) => upstream.enabled && upstream.class === 'execution-rpc')) {
    errors.push('at least one enabled execution-rpc upstream is required');
  }
  return errors;
}

async function supportsBlockTag420(requester: JsonRpcRequester420, tag: 'safe' | 'finalized'): Promise<boolean> {
  try {
    const value = await requester.request('eth_getBlockByNumber', [tag, false]);
    return value !== null && typeof value === 'object';
  } catch {
    return false;
  }
}

export async function discoverExecutionUpstream420(
  descriptor: RpcUpstreamDescriptor420,
  requester: JsonRpcRequester420,
): Promise<RpcUpstreamDiscovery420> {
  const reasons = validateUpstreamDescriptor420(descriptor, descriptor.expectedChainId);
  const capabilities = new Set<RpcUpstreamCapability420>();
  let observedChainId: bigint | null = null;
  let clientVersion: string | null = null;

  if (descriptor.class !== 'execution-rpc') reasons.push(`upstream ${descriptor.id} is not an execution-rpc descriptor`);
  if (!descriptor.enabled) reasons.push(`upstream ${descriptor.id} is disabled`);
  if (reasons.length > 0) {
    return { id: descriptor.id, class: descriptor.class, reachable: false, eligible: false, expectedChainId: descriptor.expectedChainId, observedChainId, capabilities: [], clientVersion, reasons };
  }

  try {
    observedChainId = parseQuantity420(await requester.request('eth_chainId'));
    if (observedChainId === null) reasons.push(`upstream ${descriptor.id} returned an invalid chain ID`);
    else if (observedChainId !== descriptor.expectedChainId) reasons.push(`upstream ${descriptor.id} reported wrong chain ID ${observedChainId}`);
    else capabilities.add('chain-identity');

    try {
      const version = await requester.request('web3_clientVersion');
      if (typeof version === 'string' && version.length > 0) {
        clientVersion = version;
        capabilities.add('client-version');
      }
    } catch {}

    try {
      const head = parseQuantity420(await requester.request('eth_blockNumber'));
      if (head !== null) capabilities.add('head-read');
    } catch {}

    if (await supportsBlockTag420(requester, 'safe')) capabilities.add('safe-read');
    if (await supportsBlockTag420(requester, 'finalized')) capabilities.add('finalized-read');
    if (descriptor.allowsTransactionSubmission) capabilities.add('transaction-submission');
    if (isWsTransport(descriptor.transport)) capabilities.add('subscriptions');

    return {
      id: descriptor.id,
      class: descriptor.class,
      reachable: true,
      eligible: reasons.length === 0 && capabilities.has('chain-identity'),
      expectedChainId: descriptor.expectedChainId,
      observedChainId,
      capabilities: [...capabilities],
      clientVersion,
      reasons,
    };
  } catch (error) {
    reasons.push(`upstream ${descriptor.id} discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    return { id: descriptor.id, class: descriptor.class, reachable: false, eligible: false, expectedChainId: descriptor.expectedChainId, observedChainId, capabilities: [...capabilities], clientVersion, reasons };
  }
}

export async function discoverIndexerUpstream420(
  descriptor: RpcUpstreamDescriptor420,
  reader: IndexerMetadataReader420,
): Promise<RpcUpstreamDiscovery420> {
  const reasons = validateUpstreamDescriptor420(descriptor, descriptor.expectedChainId);
  const capabilities: RpcUpstreamCapability420[] = [];
  let observedChainId: bigint | null = null;

  if (descriptor.class !== 'indexer-api') reasons.push(`upstream ${descriptor.id} is not an indexer-api descriptor`);
  if (!descriptor.enabled) reasons.push(`upstream ${descriptor.id} is disabled`);
  if (reasons.length > 0) {
    return { id: descriptor.id, class: descriptor.class, reachable: false, eligible: false, expectedChainId: descriptor.expectedChainId, observedChainId, capabilities, clientVersion: null, reasons };
  }

  try {
    const metadata = await reader.metadata();
    observedChainId = metadata.chainId;
    if (metadata.chainId !== descriptor.expectedChainId) reasons.push(`upstream ${descriptor.id} reported wrong chain ID ${metadata.chainId}`);
    else capabilities.push('chain-identity');
    if (metadata.authoritative !== false) reasons.push(`indexer upstream ${descriptor.id} must report non-authoritative metadata`);
    if (!metadata.ready) reasons.push(`indexer upstream ${descriptor.id} is not ready`);
    if (!metadata.service.trim()) reasons.push(`indexer upstream ${descriptor.id} did not identify its service`);
    if (reasons.length === 0) capabilities.push('derived-read');

    return {
      id: descriptor.id,
      class: descriptor.class,
      reachable: true,
      eligible: reasons.length === 0,
      expectedChainId: descriptor.expectedChainId,
      observedChainId,
      capabilities,
      clientVersion: null,
      reasons,
    };
  } catch (error) {
    reasons.push(`upstream ${descriptor.id} discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    return { id: descriptor.id, class: descriptor.class, reachable: false, eligible: false, expectedChainId: descriptor.expectedChainId, observedChainId, capabilities, clientVersion: null, reasons };
  }
}

export function eligibleUpstreams420(discoveries: readonly RpcUpstreamDiscovery420[], className?: RpcUpstreamClass420): RpcUpstreamDiscovery420[] {
  return discoveries.filter((item) => item.eligible && (className === undefined || item.class === className));
}
