import type { RpcUpstreamDescriptor420, RpcUpstreamDiscovery420 } from './upstreams.js';
import { classifyRpcMethod420, upstreamSupportsMethod420, type RpcMethodProfile420 } from './methods.js';

export type RpcCircuitState420 = 'closed' | 'open' | 'half-open';
export type RpcRequestTransport420 = 'http' | 'websocket';

export interface RpcHealthPolicy420 {
  failureThreshold: number;
  cooldownMs: number;
}

export interface RpcUpstreamHealth420 {
  id: string;
  circuit: RpcCircuitState420;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  openedAt: number | null;
}

export interface RpcRoutingProvider420 {
  descriptor: RpcUpstreamDescriptor420;
  discovery: RpcUpstreamDiscovery420;
  health: RpcUpstreamHealth420;
}

export interface RpcRouteDecision420 {
  method: string;
  profile: RpcMethodProfile420 | null;
  selected: RpcRoutingProvider420 | null;
  candidates: readonly RpcRoutingProvider420[];
  retryableAcrossProviders: boolean;
  reason: string | null;
}

export const DEFAULT_RPC3_HEALTH_POLICY_420: RpcHealthPolicy420 = {
  failureThreshold: 3,
  cooldownMs: 30_000,
};

export function initialUpstreamHealth420(id: string): RpcUpstreamHealth420 {
  return { id, circuit: 'closed', consecutiveFailures: 0, lastSuccessAt: null, lastFailureAt: null, openedAt: null };
}

export function validateHealthPolicy420(policy: RpcHealthPolicy420): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(policy.failureThreshold) || policy.failureThreshold < 1) errors.push('failureThreshold must be a positive integer');
  if (!Number.isInteger(policy.cooldownMs) || policy.cooldownMs < 1) errors.push('cooldownMs must be a positive integer');
  return errors;
}

export function recordUpstreamSuccess420(health: RpcUpstreamHealth420, now = Date.now()): RpcUpstreamHealth420 {
  return { ...health, circuit: 'closed', consecutiveFailures: 0, lastSuccessAt: now, openedAt: null };
}

export function recordUpstreamFailure420(
  health: RpcUpstreamHealth420,
  policy: RpcHealthPolicy420 = DEFAULT_RPC3_HEALTH_POLICY_420,
  now = Date.now(),
): RpcUpstreamHealth420 {
  if (validateHealthPolicy420(policy).length > 0) throw new Error('invalid RPC-3 health policy');
  const failures = health.consecutiveFailures + 1;
  const shouldOpen = health.circuit === 'half-open' || failures >= policy.failureThreshold;
  return {
    ...health,
    circuit: shouldOpen ? 'open' : health.circuit,
    consecutiveFailures: failures,
    lastFailureAt: now,
    openedAt: shouldOpen ? now : health.openedAt,
  };
}

export function refreshCircuit420(
  health: RpcUpstreamHealth420,
  policy: RpcHealthPolicy420 = DEFAULT_RPC3_HEALTH_POLICY_420,
  now = Date.now(),
): RpcUpstreamHealth420 {
  if (health.circuit !== 'open' || health.openedAt === null) return health;
  if (now - health.openedAt < policy.cooldownMs) return health;
  return { ...health, circuit: 'half-open' };
}

function transportAllowed420(descriptor: RpcUpstreamDescriptor420, requestTransport: RpcRequestTransport420): boolean {
  if (requestTransport === 'http') return descriptor.transport === 'http' || descriptor.transport === 'https';
  return descriptor.transport === 'ws' || descriptor.transport === 'wss';
}

function healthRank420(state: RpcCircuitState420): number {
  if (state === 'closed') return 0;
  if (state === 'half-open') return 1;
  return 2;
}

export function routeCandidates420(
  method: string,
  requestTransport: RpcRequestTransport420,
  providers: readonly RpcRoutingProvider420[],
): RpcRouteDecision420 {
  const methodDecision = classifyRpcMethod420(method);
  if (!methodDecision.supported || methodDecision.definition === null) {
    return { method, profile: null, selected: null, candidates: [], retryableAcrossProviders: false, reason: methodDecision.reason };
  }

  if (methodDecision.definition.transport === 'websocket' && requestTransport !== 'websocket') {
    return { method, profile: methodDecision.definition.profile, selected: null, candidates: [], retryableAcrossProviders: false, reason: `${method} requires websocket transport` };
  }

  const candidates = providers
    .filter((provider) => provider.descriptor.id === provider.discovery.id && provider.health.id === provider.descriptor.id)
    .filter((provider) => provider.descriptor.enabled)
    .filter((provider) => provider.health.circuit !== 'open')
    .filter((provider) => transportAllowed420(provider.descriptor, requestTransport))
    .filter((provider) => upstreamSupportsMethod420(provider.discovery, method).supported)
    .sort((a, b) => {
      const health = healthRank420(a.health.circuit) - healthRank420(b.health.circuit);
      if (health !== 0) return health;
      const priority = a.descriptor.priority - b.descriptor.priority;
      if (priority !== 0) return priority;
      return a.descriptor.id.localeCompare(b.descriptor.id);
    });

  const retryableAcrossProviders = methodDecision.definition.profile === 'metadata' || methodDecision.definition.profile === 'read';
  return {
    method,
    profile: methodDecision.definition.profile,
    selected: candidates[0] ?? null,
    candidates,
    retryableAcrossProviders,
    reason: candidates.length > 0 ? null : `no healthy eligible upstream can serve ${method}`,
  };
}

export function failoverCandidate420(decision: RpcRouteDecision420, failedProviderId: string): RpcRoutingProvider420 | null {
  if (!decision.retryableAcrossProviders) return null;
  const index = decision.candidates.findIndex((provider) => provider.descriptor.id === failedProviderId);
  if (index < 0) return decision.candidates[0] ?? null;
  return decision.candidates[index + 1] ?? null;
}

export function validateRoutingProviders420(providers: readonly RpcRoutingProvider420[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const provider of providers) {
    const id = provider.descriptor.id;
    if (ids.has(id)) errors.push(`duplicate routing provider ID: ${id}`);
    ids.add(id);
    if (provider.discovery.id !== id) errors.push(`routing provider ${id} discovery ID mismatch`);
    if (provider.health.id !== id) errors.push(`routing provider ${id} health ID mismatch`);
    if (provider.discovery.class !== provider.descriptor.class) errors.push(`routing provider ${id} class mismatch`);
    if (provider.discovery.expectedChainId !== provider.descriptor.expectedChainId) errors.push(`routing provider ${id} chain binding mismatch`);
  }
  return errors;
}
