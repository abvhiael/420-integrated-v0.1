import assert from 'node:assert/strict';
import test from 'node:test';
import type { RpcUpstreamDescriptor420, RpcUpstreamDiscovery420 } from '../src/upstreams.js';
import {
  DEFAULT_RPC3_HEALTH_POLICY_420,
  failoverCandidate420,
  initialUpstreamHealth420,
  recordUpstreamFailure420,
  recordUpstreamSuccess420,
  refreshCircuit420,
  routeCandidates420,
  validateRoutingProviders420,
  type RpcRoutingProvider420,
} from '../src/routing.js';

function descriptor(id: string, priority: number, transport: 'https' | 'wss' = 'https'): RpcUpstreamDescriptor420 {
  return { id, class: 'execution-rpc', endpoint: `${transport}://${id}.example`, transport, expectedChainId: 420n, authoritative: true, allowsTransactionSubmission: true, enabled: true, priority };
}

function discovery(id: string, capabilities: RpcUpstreamDiscovery420['capabilities'] = ['chain-identity', 'head-read', 'transaction-submission']): RpcUpstreamDiscovery420 {
  return { id, class: 'execution-rpc', reachable: true, eligible: true, expectedChainId: 420n, observedChainId: 420n, capabilities, clientVersion: 'node420/test', reasons: [] };
}

function provider(id: string, priority: number, transport: 'https' | 'wss' = 'https', capabilities?: RpcUpstreamDiscovery420['capabilities']): RpcRoutingProvider420 {
  return { descriptor: descriptor(id, priority, transport), discovery: discovery(id, capabilities), health: initialUpstreamHealth420(id) };
}

test('routes deterministically by health then priority then provider ID', () => {
  const providers = [provider('b', 10), provider('c', 5), provider('a', 5)];
  const route = routeCandidates420('eth_blockNumber', 'http', providers);
  assert.equal(route.selected?.descriptor.id, 'a');
  assert.deepEqual(route.candidates.map((p) => p.descriptor.id), ['a', 'c', 'b']);
  assert.equal(route.retryableAcrossProviders, true);
});

test('never routes an ineligible or capability-incompatible upstream', () => {
  const bad = provider('bad', 0);
  bad.discovery = { ...bad.discovery, eligible: false, reasons: ['wrong chain'] };
  const weak = provider('weak', 1, 'https', ['chain-identity']);
  const good = provider('good', 99);
  const route = routeCandidates420('eth_blockNumber', 'http', [bad, weak, good]);
  assert.equal(route.selected?.descriptor.id, 'good');
});

test('opens a circuit after threshold and half-opens only after cooldown', () => {
  let health = initialUpstreamHealth420('a');
  health = recordUpstreamFailure420(health, DEFAULT_RPC3_HEALTH_POLICY_420, 1000);
  health = recordUpstreamFailure420(health, DEFAULT_RPC3_HEALTH_POLICY_420, 2000);
  assert.equal(health.circuit, 'closed');
  health = recordUpstreamFailure420(health, DEFAULT_RPC3_HEALTH_POLICY_420, 3000);
  assert.equal(health.circuit, 'open');
  assert.equal(refreshCircuit420(health, DEFAULT_RPC3_HEALTH_POLICY_420, 32_999).circuit, 'open');
  health = refreshCircuit420(health, DEFAULT_RPC3_HEALTH_POLICY_420, 33_000);
  assert.equal(health.circuit, 'half-open');
  health = recordUpstreamSuccess420(health, 34_000);
  assert.equal(health.circuit, 'closed');
  assert.equal(health.consecutiveFailures, 0);
});

test('open circuits are excluded and reads fail over to the next provider', () => {
  const first = provider('first', 0);
  first.health = { ...first.health, circuit: 'open', openedAt: 1, consecutiveFailures: 3 };
  const second = provider('second', 1);
  const third = provider('third', 2);
  const route = routeCandidates420('eth_getBalance', 'http', [first, second, third]);
  assert.equal(route.selected?.descriptor.id, 'second');
  assert.equal(failoverCandidate420(route, 'second')?.descriptor.id, 'third');
});

test('raw transaction submission is never automatically failed over after dispatch ambiguity', () => {
  const route = routeCandidates420('eth_sendRawTransaction', 'http', [provider('one', 0), provider('two', 1)]);
  assert.equal(route.selected?.descriptor.id, 'one');
  assert.equal(route.retryableAcrossProviders, false);
  assert.equal(failoverCandidate420(route, 'one'), null);
});

test('subscriptions require websocket-capable routing and are not automatically retried', () => {
  const ws = provider('ws', 0, 'wss', ['chain-identity', 'head-read', 'subscriptions']);
  const http = provider('http', 0);
  const wrongTransport = routeCandidates420('eth_subscribe', 'http', [ws, http]);
  assert.equal(wrongTransport.selected, null);
  const route = routeCandidates420('eth_subscribe', 'websocket', [http, ws]);
  assert.equal(route.selected?.descriptor.id, 'ws');
  assert.equal(route.retryableAcrossProviders, false);
});

test('provider identity mismatches fail validation and cannot be silently composed', () => {
  const p = provider('a', 0);
  p.discovery = { ...p.discovery, id: 'other' };
  assert.deepEqual(validateRoutingProviders420([p]), ['routing provider a discovery ID mismatch']);
});

test('unsupported methods fail closed before routing', () => {
  const route = routeCandidates420('debug_traceTransaction', 'http', [provider('a', 0)]);
  assert.equal(route.selected, null);
  assert.match(route.reason ?? '', /outside the public 420RPC surface/);
});
