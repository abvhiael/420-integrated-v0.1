import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BongGogglesProductionDelivery,
  DeliveryMetrics,
  deliveryCachePolicy,
  immutableObjectCacheKey,
  launchReadiness,
  redactStructuredLog,
  runFailureDrill,
  runLoadQualification,
  selectResponsiveSources,
} from '../src/deliveryOperations.js';

const H = (c) => `0x${c.repeat(64)}`;
const OWNER = `0x${'1'.repeat(40)}`;

function object(id, size) {
  return { objectId: H(id), manifestId: H('9'), shardIndex: Number.parseInt(id, 16) % 4, shardRoot: H(id), sizeBytes: size, commitmentId: H('8') };
}

function descriptor() {
  return {
    version: 'bg-media-manifest-v1', owner: OWNER, mediaType: 'IMAGE',
    items: [
      { itemId: H('2'), role: 'ORIGINAL', mimeType: 'image/jpeg', byteSize: 4000, width: 1920, height: 1080, storageObject: object('2', 4000) },
      { itemId: H('3'), role: 'THUMBNAIL', mimeType: 'image/jpeg', byteSize: 400, width: 320, height: 180, derivativeOf: H('2'), storageObject: object('3', 400) },
      { itemId: H('4'), role: 'PREVIEW', mimeType: 'image/jpeg', byteSize: 1200, width: 960, height: 540, derivativeOf: H('2'), storageObject: object('4', 1200) },
    ],
  };
}

test('immutable cache key is derived only from canonical storage identity', () => {
  const key = immutableObjectCacheKey(object('A', 42));
  assert.equal(key, `${H('a')}:${H('9')}:2:${'a'.repeat(64)}:42:${H('8')}`);
});

test('verified public media is immutable-cacheable while private or unverified media is not', () => {
  assert.equal(deliveryCachePolicy({ accessMode: 'public', verified: true })['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(deliveryCachePolicy({ accessMode: 'private', verified: true })['cache-control'], 'private, no-store');
  assert.equal(deliveryCachePolicy({ accessMode: 'public', verified: false })['cache-control'], 'no-store');
});

test('responsive source selection is deterministic and preserves canonical object identity', () => {
  const sources = selectResponsiveSources({ descriptor: descriptor(), itemId: H('2') });
  assert.deepEqual(sources.map((source) => source.width), [320, 960, 1920]);
  assert.deepEqual(sources.map((source) => source.role), ['THUMBNAIL', 'PREVIEW', 'ORIGINAL']);
  assert.ok(sources.every((source) => source.authoritative === false && source.cacheKey));
});

test('structured logging redacts credentials, sessions and authorization values', () => {
  const redacted = redactStructuredLog({
    authorization: 'Bearer abc.def',
    nested: { sessionId: 'session-secret', message: 'upstream said Bearer xyz' },
    providerId: 'provider-1',
  });
  assert.equal(redacted.authorization, '[REDACTED]');
  assert.equal(redacted.nested.sessionId, '[REDACTED]');
  assert.equal(redacted.nested.message, 'upstream said [REDACTED]');
  assert.equal(redacted.providerId, 'provider-1');
});

test('production wrapper records cache/store metrics and applies safe cache policy', async () => {
  const metrics = new DeliveryMetrics();
  const logs = [];
  const service = {
    async deliver() {
      return { verified: true, headers: { 'content-type': 'image/jpeg' }, route: { tier: 'cache' }, body: Buffer.from('ok') };
    },
  };
  const delivery = new BongGogglesProductionDelivery({ deliveryService: service, metrics, log: (record) => logs.push(record) });
  const result = await delivery.deliver({ descriptor: descriptor(), itemId: H('2'), access: { mode: 'public' } });
  assert.equal(result.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(metrics.snapshot().cacheHits, 1);
  assert.equal(metrics.snapshot().successes, 1);
  assert.equal(logs[0].event, 'media.delivery.success');
});

test('integrity and route failures are separately observable', async () => {
  const metrics = new DeliveryMetrics();
  const integrity = new BongGogglesProductionDelivery({ deliveryService: { deliver: async () => { throw new Error('storage retrieval shard root mismatch'); } }, metrics });
  await assert.rejects(() => integrity.deliver({ descriptor: descriptor(), itemId: H('2') }), /shard root mismatch/);
  const route = new BongGogglesProductionDelivery({ deliveryService: { deliver: async () => { throw new Error('gateway route failure'); } }, metrics });
  await assert.rejects(() => route.deliver({ descriptor: descriptor(), itemId: H('2') }), /gateway route failure/);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.integrityFailures, 1);
  assert.equal(snapshot.routeFailures, 1);
});

test('provider/cache/retrieval drills explicitly require the expected failure to occur', async () => {
  const providerLoss = await runFailureDrill({ name: 'provider-loss', operation: async () => { throw new Error('provider unavailable'); } });
  const cacheLoss = await runFailureDrill({ name: 'cache-loss', operation: async () => { throw new Error('gateway route failure'); } });
  const missingFailure = await runFailureDrill({ name: 'retrieval-failure', operation: async () => true });
  assert.equal(providerLoss.passed, true);
  assert.equal(cacheLoss.passed, true);
  assert.equal(missingFailure.passed, false);
});

test('bounded load qualification and launch readiness fail closed', async () => {
  const load = await runLoadQualification({ operation: async () => true, requests: 24, concurrency: 4, maxP95LatencyMs: 1000 });
  assert.equal(load.passed, true);
  const metrics = new DeliveryMetrics();
  metrics.recordSuccess({ latencyMs: 5, tier: 'store' });
  const readiness = launchReadiness({ drills: [{ passed: true }], loadQualifications: [load], metrics });
  assert.equal(readiness.ready, true);
  metrics.recordFailure({ latencyMs: 2, integrity: true });
  assert.equal(launchReadiness({ drills: [{ passed: true }], loadQualifications: [load], metrics }).ready, false);
});
