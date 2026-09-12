import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RPC10_POLICY_420,
  RpcMetrics420,
  RpcReadinessTracker420,
  createRpcOperationalSnapshot420,
  evaluateRpcReadiness420,
  type RpcRuntimeObservation420,
} from '../src/observability.js';

const NOW = 1_000_000;

function observation(overrides: Partial<RpcRuntimeObservation420> = {}): RpcRuntimeObservation420 {
  return {
    chainId: 420n,
    environment: 'testnet',
    observedAtMs: NOW - 1000,
    processHeartbeatAtMs: NOW - 500,
    finalityConflict: false,
    executionProviders: [{
      providerId: 'execution-a', reachable: true, eligible: true, circuit: 'closed', chainSafe: true,
      observedChainId: 420n, observationAtMs: NOW - 1000,
    }],
    indexerProviders: [{
      providerId: 'indexer-a', reachable: true, eligible: true, ready: true,
      observedChainId: 420n, observationAtMs: NOW - 1000,
    }],
    websocket: { sessions: 2, subscriptions: 3, queuedMessages: 4, queuedBytes: 512 },
    resources: { trackedClients: 5, activeLeases: 2, globalConcurrentUnits: 2 },
    auth: { credentials: 7, storesBearerSecrets: false },
    ...overrides,
  };
}

test('fresh canonical and derived evidence is ready and healthy', () => {
  const result = evaluateRpcReadiness420(observation(), NOW);
  assert.equal(result.ready, true);
  assert.equal(result.live, true);
  assert.equal(result.canonicalReadsReady, true);
  assert.equal(result.transactionSubmissionReady, true);
  assert.equal(result.subscriptionsReady, true);
  assert.equal(result.derivedReadsReady, true);
  assert.equal(result.state, 'healthy');
  assert.equal(result.reason, 'ready');
  assert.equal(result.canonicalAuthority, false);
});

test('Indexer outage degrades derived reads without disabling canonical RPC', () => {
  const input = observation({ indexerProviders: [{ providerId: 'indexer-a', reachable: false, eligible: true, ready: false, observedChainId: 420n, observationAtMs: NOW - 1000 }] });
  const result = evaluateRpcReadiness420(input, NOW);
  assert.equal(result.ready, true);
  assert.equal(result.canonicalReadsReady, true);
  assert.equal(result.derivedReadsReady, false);
  assert.equal(result.state, 'degraded');
});

test('wrong gateway chain fails closed', () => {
  const result = evaluateRpcReadiness420(observation({ chainId: 1n }), NOW);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'wrong-chain');
});

test('wrong provider chain never counts as canonical readiness', () => {
  const input = observation({ executionProviders: [{ providerId: 'execution-a', reachable: true, eligible: true, circuit: 'closed', chainSafe: true, observedChainId: 1n, observationAtMs: NOW - 1000 }] });
  const result = evaluateRpcReadiness420(input, NOW);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'no-canonical-provider');
});

test('stale observation fails readiness while process can remain live', () => {
  const result = evaluateRpcReadiness420(observation({ observedAtMs: NOW - DEFAULT_RPC10_POLICY_420.maxObservationAgeMs - 1 }), NOW);
  assert.equal(result.live, true);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'observation-stale');
});

test('stale process heartbeat fails liveness and readiness', () => {
  const result = evaluateRpcReadiness420(observation({ processHeartbeatAtMs: NOW - DEFAULT_RPC10_POLICY_420.maxProcessHeartbeatAgeMs - 1 }), NOW);
  assert.equal(result.live, false);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'process-stale');
});

test('open circuit provider does not satisfy readiness', () => {
  const input = observation({ executionProviders: [{ providerId: 'execution-a', reachable: true, eligible: true, circuit: 'open', chainSafe: true, observedChainId: 420n, observationAtMs: NOW - 1000 }] });
  const result = evaluateRpcReadiness420(input, NOW);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'no-canonical-provider');
});

test('finality conflict fails closed even with otherwise healthy providers', () => {
  const result = evaluateRpcReadiness420(observation({ finalityConflict: true }), NOW);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'finality-conflict');
  assert.equal(result.canonicalProviderCount, 1);
});

test('recovery requires consecutive healthy observations', () => {
  const tracker = new RpcReadinessTracker420({ ...DEFAULT_RPC10_POLICY_420, recoverySuccessThreshold: 2 });
  const bad = tracker.observe(observation({ finalityConflict: true }), NOW);
  assert.equal(bad.ready, false);
  const firstGood = tracker.observe(observation(), NOW + 1);
  assert.equal(firstGood.ready, false);
  assert.equal(firstGood.reason, 'recovering');
  const secondGood = tracker.observe(observation({ observedAtMs: NOW + 1, processHeartbeatAtMs: NOW + 1 }), NOW + 2);
  assert.equal(secondGood.ready, true);
  assert.equal(secondGood.reason, 'ready');
  assert.equal(tracker.snapshot().transitions, 1);
});

test('a failed recovery sample resets the success streak', () => {
  const tracker = new RpcReadinessTracker420({ ...DEFAULT_RPC10_POLICY_420, recoverySuccessThreshold: 2 });
  assert.equal(tracker.observe(observation(), NOW).reason, 'recovering');
  assert.equal(tracker.observe(observation({ finalityConflict: true }), NOW + 1).ready, false);
  assert.equal(tracker.observe(observation({ observedAtMs: NOW + 1, processHeartbeatAtMs: NOW + 1 }), NOW + 2).reason, 'recovering');
});

test('metrics use fixed low-cardinality dimensions and bounded samples', () => {
  const metrics = new RpcMetrics420({ ...DEFAULT_RPC10_POLICY_420, maxMetricSamples: 3 });
  metrics.increment('requests_total', 'read', 2);
  metrics.increment('auth_failures_total', 'auth');
  assert.deepEqual(metrics.snapshot(), [
    { name: 'auth_failures_total', dimension: 'auth', value: 1 },
    { name: 'requests_total', dimension: 'read', value: 2 },
  ]);
  assert.throws(() => metrics.increment('requests_total', 'read'), /sample budget exhausted/);
});

test('operational snapshot is explicitly redacted and non-authoritative', () => {
  const metrics = new RpcMetrics420();
  metrics.increment('requests_total', 'read');
  const input = observation();
  const ready = evaluateRpcReadiness420(input, NOW);
  const snapshot = createRpcOperationalSnapshot420(input, ready, metrics);
  assert.equal(snapshot.service, '420RPC');
  assert.equal(snapshot.auth.storesBearerSecrets, false);
  assert.equal(snapshot.containsSecrets, false);
  assert.equal(snapshot.containsPrincipalIdentifiers, false);
  assert.equal(snapshot.canonicalAuthority, false);
  assert.equal(JSON.stringify(snapshot).includes('credential:'), false);
  assert.equal(JSON.stringify(snapshot).includes('Bearer '), false);
});

test('negative operational counters are rejected instead of normalized', () => {
  const input = observation({ websocket: { sessions: -1, subscriptions: 0, queuedMessages: 0, queuedBytes: 0 } });
  assert.throws(() => evaluateRpcReadiness420(input, NOW), /sessions must be a non-negative integer/);
});
