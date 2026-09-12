export type RpcOperationalState420 = 'healthy' | 'degraded' | 'unavailable' | 'unknown';
export type RpcReadinessReason420 =
  | 'ready'
  | 'observation-stale'
  | 'wrong-chain'
  | 'no-canonical-provider'
  | 'finality-conflict'
  | 'recovering'
  | 'process-stale';

export interface Rpc10Policy420 {
  expectedChainId: bigint;
  environment: string;
  maxObservationAgeMs: number;
  maxProcessHeartbeatAgeMs: number;
  recoverySuccessThreshold: number;
  maxMetricSamples: number;
}

export const DEFAULT_RPC10_POLICY_420: Rpc10Policy420 = {
  expectedChainId: 420n,
  environment: 'testnet',
  maxObservationAgeMs: 15_000,
  maxProcessHeartbeatAgeMs: 30_000,
  recoverySuccessThreshold: 2,
  maxMetricSamples: 10_000,
};

export interface RpcExecutionProviderObservation420 {
  providerId: string;
  reachable: boolean;
  eligible: boolean;
  circuit: 'closed' | 'open' | 'half-open';
  chainSafe: boolean;
  observedChainId: bigint | null;
  observationAtMs: number;
}

export interface RpcIndexerProviderObservation420 {
  providerId: string;
  reachable: boolean;
  eligible: boolean;
  ready: boolean;
  observedChainId: bigint | null;
  observationAtMs: number;
}

export interface RpcRuntimeObservation420 {
  chainId: bigint;
  environment: string;
  observedAtMs: number;
  processHeartbeatAtMs: number;
  finalityConflict: boolean;
  executionProviders: readonly RpcExecutionProviderObservation420[];
  indexerProviders: readonly RpcIndexerProviderObservation420[];
  websocket: {
    sessions: number;
    subscriptions: number;
    queuedMessages: number;
    queuedBytes: number;
  };
  resources: {
    trackedClients: number;
    activeLeases: number;
    globalConcurrentUnits: number;
  };
  auth: {
    credentials: number;
    storesBearerSecrets: false;
  };
}

export interface RpcReadiness420 {
  live: boolean;
  ready: boolean;
  canonicalReadsReady: boolean;
  transactionSubmissionReady: boolean;
  subscriptionsReady: boolean;
  derivedReadsReady: boolean;
  state: RpcOperationalState420;
  reason: RpcReadinessReason420;
  observedAtMs: number;
  canonicalProviderCount: number;
  derivedProviderCount: number;
  canonicalAuthority: false;
}

export type RpcMetricName420 =
  | 'requests_total'
  | 'requests_rejected_total'
  | 'upstream_failures_total'
  | 'auth_failures_total'
  | 'rate_limits_total'
  | 'ws_disconnects_total'
  | 'readiness_transitions_total';

export type RpcMetricDimension420 =
  | 'read'
  | 'submit'
  | 'subscription'
  | 'derived'
  | 'policy'
  | 'resource'
  | 'auth'
  | 'upstream'
  | 'websocket'
  | 'readiness';

export interface RpcMetricSample420 {
  name: RpcMetricName420;
  dimension: RpcMetricDimension420;
  value: number;
}

export interface RpcOperationalSnapshot420 {
  service: '420RPC';
  chainId: string;
  environment: string;
  observedAtMs: number;
  readiness: RpcReadiness420;
  execution: { total: number; eligible: number; reachable: number };
  indexer: { total: number; eligible: number; ready: number };
  websocket: RpcRuntimeObservation420['websocket'];
  resources: RpcRuntimeObservation420['resources'];
  auth: { credentials: number; storesBearerSecrets: false };
  metrics: readonly RpcMetricSample420[];
  containsSecrets: false;
  containsPrincipalIdentifiers: false;
  canonicalAuthority: false;
}

function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}

function assertPolicy(policy: Rpc10Policy420): void {
  if (policy.expectedChainId <= 0n) throw new Error('expectedChainId must be positive');
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(policy.environment)) throw new Error('environment is invalid');
  for (const [name, value] of Object.entries({
    maxObservationAgeMs: policy.maxObservationAgeMs,
    maxProcessHeartbeatAgeMs: policy.maxProcessHeartbeatAgeMs,
    recoverySuccessThreshold: policy.recoverySuccessThreshold,
    maxMetricSamples: policy.maxMetricSamples,
  })) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  }
}

function validateObservation(input: RpcRuntimeObservation420): void {
  if (input.chainId <= 0n) throw new Error('observation chainId must be positive');
  if (!Number.isFinite(input.observedAtMs) || input.observedAtMs < 0) throw new Error('observedAtMs is invalid');
  if (!Number.isFinite(input.processHeartbeatAtMs) || input.processHeartbeatAtMs < 0) throw new Error('processHeartbeatAtMs is invalid');
  for (const [name, value] of Object.entries({
    sessions: input.websocket.sessions,
    subscriptions: input.websocket.subscriptions,
    queuedMessages: input.websocket.queuedMessages,
    queuedBytes: input.websocket.queuedBytes,
    trackedClients: input.resources.trackedClients,
    activeLeases: input.resources.activeLeases,
    globalConcurrentUnits: input.resources.globalConcurrentUnits,
    credentials: input.auth.credentials,
  })) assertNonNegativeInt(value, name);
}

function fresh(atMs: number, nowMs: number, maxAgeMs: number): boolean {
  return Number.isFinite(atMs) && atMs >= 0 && atMs <= nowMs && nowMs - atMs <= maxAgeMs;
}

export function evaluateRpcReadiness420(
  input: RpcRuntimeObservation420,
  nowMs: number,
  policy: Rpc10Policy420 = DEFAULT_RPC10_POLICY_420,
): RpcReadiness420 {
  assertPolicy(policy);
  validateObservation(input);
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('nowMs is invalid');

  const live = fresh(input.processHeartbeatAtMs, nowMs, policy.maxProcessHeartbeatAgeMs);
  const observationFresh = fresh(input.observedAtMs, nowMs, policy.maxObservationAgeMs);
  const correctNetwork = input.chainId === policy.expectedChainId && input.environment === policy.environment;
  const canonical = input.executionProviders.filter((provider) =>
    provider.reachable && provider.eligible && provider.circuit !== 'open' && provider.chainSafe &&
    provider.observedChainId === policy.expectedChainId && fresh(provider.observationAtMs, nowMs, policy.maxObservationAgeMs));
  const derived = input.indexerProviders.filter((provider) =>
    provider.reachable && provider.eligible && provider.ready && provider.observedChainId === policy.expectedChainId &&
    fresh(provider.observationAtMs, nowMs, policy.maxObservationAgeMs));

  let reason: RpcReadinessReason420 = 'ready';
  if (!live) reason = 'process-stale';
  else if (!observationFresh) reason = 'observation-stale';
  else if (!correctNetwork) reason = 'wrong-chain';
  else if (input.finalityConflict) reason = 'finality-conflict';
  else if (canonical.length === 0) reason = 'no-canonical-provider';

  const canonicalReady = reason === 'ready';
  const ready = live && canonicalReady;
  const state: RpcOperationalState420 = ready ? (derived.length > 0 ? 'healthy' : 'degraded') : (live ? 'unavailable' : 'unavailable');
  return Object.freeze({
    live,
    ready,
    canonicalReadsReady: canonicalReady,
    transactionSubmissionReady: canonicalReady,
    subscriptionsReady: canonicalReady,
    derivedReadsReady: ready && derived.length > 0,
    state,
    reason,
    observedAtMs: input.observedAtMs,
    canonicalProviderCount: canonical.length,
    derivedProviderCount: derived.length,
    canonicalAuthority: false,
  });
}

export class RpcMetrics420 {
  private readonly counters = new Map<string, number>();
  private samples = 0;

  constructor(readonly policy: Rpc10Policy420 = DEFAULT_RPC10_POLICY_420) {
    assertPolicy(policy);
  }

  increment(name: RpcMetricName420, dimension: RpcMetricDimension420, by = 1): void {
    if (!Number.isInteger(by) || by <= 0) throw new Error('metric increment must be a positive integer');
    if (this.samples + by > this.policy.maxMetricSamples) throw new Error('metric sample budget exhausted');
    const key = `${name}:${dimension}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
    this.samples += by;
  }

  snapshot(): readonly RpcMetricSample420[] {
    return Object.freeze([...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
      const split = key.lastIndexOf(':');
      return Object.freeze({ name: key.slice(0, split) as RpcMetricName420, dimension: key.slice(split + 1) as RpcMetricDimension420, value });
    }));
  }
}

export class RpcReadinessTracker420 {
  private lastReady = false;
  private recoveringSuccesses = 0;
  private transitions = 0;

  constructor(readonly policy: Rpc10Policy420 = DEFAULT_RPC10_POLICY_420) {
    assertPolicy(policy);
  }

  observe(input: RpcRuntimeObservation420, nowMs: number): RpcReadiness420 {
    const raw = evaluateRpcReadiness420(input, nowMs, this.policy);
    let next = raw;
    if (!raw.ready) {
      this.recoveringSuccesses = 0;
    } else if (!this.lastReady) {
      this.recoveringSuccesses += 1;
      if (this.recoveringSuccesses < this.policy.recoverySuccessThreshold) {
        next = Object.freeze({ ...raw, ready: false, canonicalReadsReady: false, transactionSubmissionReady: false, subscriptionsReady: false, derivedReadsReady: false, state: 'degraded' as const, reason: 'recovering' as const });
      }
    }
    if (next.ready !== this.lastReady) this.transitions += 1;
    this.lastReady = next.ready;
    return next;
  }

  snapshot(): { ready: boolean; recoveringSuccesses: number; transitions: number } {
    return { ready: this.lastReady, recoveringSuccesses: this.recoveringSuccesses, transitions: this.transitions };
  }
}

export function createRpcOperationalSnapshot420(
  input: RpcRuntimeObservation420,
  readiness: RpcReadiness420,
  metrics: RpcMetrics420,
): RpcOperationalSnapshot420 {
  validateObservation(input);
  return Object.freeze({
    service: '420RPC',
    chainId: input.chainId.toString(),
    environment: input.environment,
    observedAtMs: input.observedAtMs,
    readiness,
    execution: Object.freeze({
      total: input.executionProviders.length,
      eligible: input.executionProviders.filter((p) => p.eligible).length,
      reachable: input.executionProviders.filter((p) => p.reachable).length,
    }),
    indexer: Object.freeze({
      total: input.indexerProviders.length,
      eligible: input.indexerProviders.filter((p) => p.eligible).length,
      ready: input.indexerProviders.filter((p) => p.ready).length,
    }),
    websocket: Object.freeze({ ...input.websocket }),
    resources: Object.freeze({ ...input.resources }),
    auth: Object.freeze({ credentials: input.auth.credentials, storesBearerSecrets: false }),
    metrics: metrics.snapshot(),
    containsSecrets: false,
    containsPrincipalIdentifiers: false,
    canonicalAuthority: false,
  });
}
