import assert from 'node:assert/strict';
import test from 'node:test';
import type { RpcUpstreamDescriptor420, RpcUpstreamDiscovery420 } from '../src/upstreams.js';
import { initialUpstreamHealth420, type RpcRoutingProvider420 } from '../src/routing.js';
import {
  DEFAULT_RPC4_SAFETY_POLICY_420,
  evaluateFleetSafety420,
  safeRouteCandidates420,
  validateChainObservation420,
  type RpcChainObservation420,
} from '../src/safety.js';

const hash = (byte: string) => `0x${byte.repeat(64)}`;

function descriptor(id: string, priority = 0): RpcUpstreamDescriptor420 {
  return { id, class: 'execution-rpc', endpoint: `https://${id}.example`, transport: 'https', expectedChainId: 420n, authoritative: true, allowsTransactionSubmission: true, enabled: true, priority };
}

function discovery(id: string): RpcUpstreamDiscovery420 {
  return { id, class: 'execution-rpc', reachable: true, eligible: true, expectedChainId: 420n, observedChainId: 420n, capabilities: ['chain-identity', 'head-read', 'safe-read', 'finalized-read', 'transaction-submission'], clientVersion: 'node420/test', reasons: [] };
}

function provider(id: string, priority = 0): RpcRoutingProvider420 {
  return { descriptor: descriptor(id, priority), discovery: discovery(id), health: initialUpstreamHealth420(id) };
}

function observation(id: string, head = 100n, safe = 98n, finalized = 96n, observedAt = 10_000): RpcChainObservation420 {
  return {
    id,
    chainId: 420n,
    head: { number: head, hash: hash('a') },
    safe: { number: safe, hash: hash('b') },
    finalized: { number: finalized, hash: hash('c') },
    observedAt,
  };
}

test('accepts a fresh, internally consistent chain observation', () => {
  assert.deepEqual(validateChainObservation420(observation('a')), []);
  const fleet = evaluateFleetSafety420([provider('a')], [observation('a')], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(fleet.safe, true);
  assert.equal(fleet.providers[0]?.safe, true);
  assert.equal(fleet.referenceHead, 100n);
});

test('rejects wrong-chain identity even when RPC-1 discovery had been eligible', () => {
  const obs = { ...observation('a'), chainId: 1n };
  const fleet = evaluateFleetSafety420([provider('a')], [obs], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(fleet.providers[0]?.safe, false);
  assert.match(fleet.providers[0]?.reasons.join('; ') ?? '', /wrong chain ID/);
});

test('rejects chain identity changes after RPC-1 discovery', () => {
  const p = provider('a');
  p.discovery = { ...p.discovery, observedChainId: 421n };
  const fleet = evaluateFleetSafety420([p], [observation('a')], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(fleet.providers[0]?.safe, false);
  assert.match(fleet.providers[0]?.reasons.join('; ') ?? '', /identity changed/);
});

test('rejects stale observations and providers too far behind the fleet head', () => {
  const policy = { ...DEFAULT_RPC4_SAFETY_POLICY_420, maxHeadLagBlocks: 4n, maxObservationAgeMs: 1000 };
  const fresh = observation('fresh', 100n, 98n, 96n, 10_000);
  const lagged = observation('lagged', 90n, 88n, 86n, 10_000);
  const stale = observation('stale', 100n, 98n, 96n, 1_000);
  const fleet = evaluateFleetSafety420([provider('fresh'), provider('lagged'), provider('stale')], [fresh, lagged, stale], policy, 10_500);
  assert.equal(fleet.providers.find((p) => p.id === 'fresh')?.safe, true);
  assert.match(fleet.providers.find((p) => p.id === 'lagged')?.reasons.join('; ') ?? '', /too far behind/);
  assert.match(fleet.providers.find((p) => p.id === 'stale')?.reasons.join('; ') ?? '', /stale/);
});

test('fails closed on same-height finalized disagreement', () => {
  const one = observation('one');
  const two = { ...observation('two'), finalized: { number: 96n, hash: hash('d') } };
  const fleet = evaluateFleetSafety420([provider('one'), provider('two')], [one, two], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(fleet.safe, false);
  assert.match(fleet.reasons.join('; '), /finalized checkpoint disagreement at block 96/);
  assert.equal(fleet.providers.every((p) => p.safe === false), true);
});

test('fails closed on same-height safe disagreement', () => {
  const one = observation('one');
  const two = { ...observation('two'), safe: { number: 98n, hash: hash('e') } };
  const fleet = evaluateFleetSafety420([provider('one'), provider('two')], [one, two], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(fleet.safe, false);
  assert.match(fleet.reasons.join('; '), /safe checkpoint disagreement at block 98/);
});

test('rejects impossible checkpoint ordering and future observations', () => {
  const bad = { ...observation('a'), safe: { number: 101n, hash: hash('b') }, observedAt: 20_000 };
  const fleet = evaluateFleetSafety420([provider('a')], [bad], DEFAULT_RPC4_SAFETY_POLICY_420, 10_000);
  assert.equal(fleet.providers[0]?.safe, false);
  assert.match(fleet.providers[0]?.reasons.join('; ') ?? '', /safe checkpoint is ahead of head/);
  assert.match(fleet.providers[0]?.reasons.join('; ') ?? '', /from the future/);
});

test('safe routing excludes unsafe providers before applying RPC-3 priority', () => {
  const primary = provider('primary', 0);
  const backup = provider('backup', 10);
  const stalePrimary = observation('primary', 90n, 88n, 86n, 10_000);
  const freshBackup = observation('backup', 100n, 98n, 96n, 10_000);
  const policy = { ...DEFAULT_RPC4_SAFETY_POLICY_420, maxHeadLagBlocks: 4n };
  const route = safeRouteCandidates420('eth_getBalance', 'http', [primary, backup], [stalePrimary, freshBackup], policy, 10_001);
  assert.equal(route.selected?.descriptor.id, 'backup');
});

test('safe routing returns no provider during finalized conflict', () => {
  const one = observation('one');
  const two = { ...observation('two'), finalized: { number: 96n, hash: hash('f') } };
  const route = safeRouteCandidates420('eth_blockNumber', 'http', [provider('one'), provider('two')], [one, two], DEFAULT_RPC4_SAFETY_POLICY_420, 10_001);
  assert.equal(route.selected, null);
  assert.match(route.reason ?? '', /finalized checkpoint disagreement/);
});
