import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RPC8_DERIVED_RESOURCES_420,
  buildIndexerDerivedRequest420,
  selectIndexerUpstream420,
  validateIndexerProjectionMetadata420,
  validateRpc8DerivedProfile420,
  wrapIndexerDerivedResponse420,
  type RpcIndexerProjectionMetadata420,
} from '../src/indexer-reads.js';
import type { RpcUpstreamDiscovery420, RpcUpstreamRegistry420 } from '../src/upstreams.js';

function registry(): RpcUpstreamRegistry420 {
  return {
    expectedChainId: 420n,
    upstreams: [
      { id: 'exec', class: 'execution-rpc', endpoint: 'https://exec.invalid', transport: 'https', expectedChainId: 420n, authoritative: true, allowsTransactionSubmission: true, enabled: true, priority: 0 },
      { id: 'idx-b', class: 'indexer-api', endpoint: 'https://idx-b.invalid', transport: 'https', expectedChainId: 420n, authoritative: false, allowsTransactionSubmission: false, enabled: true, priority: 20 },
      { id: 'idx-a', class: 'indexer-api', endpoint: 'https://idx-a.invalid', transport: 'https', expectedChainId: 420n, authoritative: false, allowsTransactionSubmission: false, enabled: true, priority: 10 },
    ],
  };
}

function discovery(id: string, overrides: Partial<RpcUpstreamDiscovery420> = {}): RpcUpstreamDiscovery420 {
  return {
    id,
    class: 'indexer-api',
    reachable: true,
    eligible: true,
    expectedChainId: 420n,
    observedChainId: 420n,
    capabilities: ['chain-identity', 'derived-read'],
    clientVersion: null,
    reasons: [],
    ...overrides,
  };
}

const metadata: RpcIndexerProjectionMetadata420 = {
  chainId: 420n,
  indexedHead: 1234n,
  observedAtMs: 10_000,
  ready: true,
  authoritative: false,
};

test('RPC-8 derived profile is explicit and valid', () => {
  assert.deepEqual(validateRpc8DerivedProfile420(), []);
  assert.ok(RPC8_DERIVED_RESOURCES_420.length >= 10);
  assert.ok(RPC8_DERIVED_RESOURCES_420.every((item) => item.route.startsWith('/v1/')));
});

test('selects only eligible derived-read indexers using deterministic priority', () => {
  const selected = selectIndexerUpstream420(registry(), [discovery('idx-a'), discovery('idx-b')]);
  assert.equal(selected.id, 'idx-a');
});

test('execution RPC can never satisfy a derived indexer read', () => {
  const discoveries: RpcUpstreamDiscovery420[] = [{
    id: 'exec', class: 'execution-rpc', reachable: true, eligible: true, expectedChainId: 420n,
    observedChainId: 420n, capabilities: ['chain-identity', 'head-read'], clientVersion: 'node420', reasons: [],
  }];
  assert.throws(() => selectIndexerUpstream420(registry(), discoveries), /no eligible 420Indexer/);
});

test('wrong-chain, unready or capability-missing indexers fail closed', () => {
  assert.throws(() => selectIndexerUpstream420(registry(), [discovery('idx-a', { observedChainId: 1n })]), /no eligible 420Indexer/);
  assert.throws(() => selectIndexerUpstream420(registry(), [discovery('idx-a', { eligible: false })]), /no eligible 420Indexer/);
  assert.throws(() => selectIndexerUpstream420(registry(), [discovery('idx-a', { capabilities: ['chain-identity'] })]), /no eligible 420Indexer/);
});

test('builds chain-scoped v1 requests and separates path params from query params', () => {
  const descriptor = registry().upstreams[2];
  const request = buildIndexerDerivedRequest420(descriptor, 420n, {
    resource: 'protocol-object',
    params: { protocol: '420Registry', key: 'alice', limit: 25n },
  });
  assert.equal(request.path, '/v1/protocols/420Registry/objects/alice');
  assert.deepEqual(request.query, { chainId: '420', limit: '25' });
  assert.equal(request.upstreamId, 'idx-a');
});

test('derived requests reject missing or unsafe path parameters', () => {
  const descriptor = registry().upstreams[2];
  assert.throws(() => buildIndexerDerivedRequest420(descriptor, 420n, { resource: 'block' }), /missing required/);
  assert.throws(() => buildIndexerDerivedRequest420(descriptor, 420n, { resource: 'block', params: { id: '../admin' } }), /invalid derived-read path/);
});

test('derived requests reject authoritative or transaction-capable indexer descriptors', () => {
  const bad = { ...registry().upstreams[2], authoritative: true };
  assert.throws(() => buildIndexerDerivedRequest420(bad, 420n, { resource: 'status' }), /non-authoritative read-only indexer/);
});

test('projection metadata rejects wrong-chain, stale, future and unready observations', () => {
  assert.deepEqual(validateIndexerProjectionMetadata420(metadata, 420n, 10_001), []);
  assert.match(validateIndexerProjectionMetadata420({ ...metadata, chainId: 1n }, 420n, 10_001).join(';'), /wrong chain/);
  assert.match(validateIndexerProjectionMetadata420({ ...metadata, ready: false }, 420n, 10_001).join(';'), /not ready/);
  assert.match(validateIndexerProjectionMetadata420(metadata, 420n, 50_001, 30_000).join(';'), /stale/);
  assert.match(validateIndexerProjectionMetadata420({ ...metadata, observedAtMs: 20_000 }, 420n, 10_001).join(';'), /future/);
});

test('every wrapped response is visibly derived and non-authoritative', () => {
  const wrapped = wrapIndexerDerivedResponse420('idx-a', metadata, { address: '0xabc', txCount: 7 }, 420n, 10_001);
  assert.deepEqual(wrapped, {
    source: '420Indexer',
    derived: true,
    authoritative: false,
    chainId: '420',
    upstreamId: 'idx-a',
    indexedHead: '1234',
    observedAtMs: 10_000,
    data: { address: '0xabc', txCount: 7 },
  });
});
