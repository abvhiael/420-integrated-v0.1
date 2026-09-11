import test from 'node:test';
import assert from 'node:assert/strict';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import { IndexerDeliveryQueue420, IndexerRateLimiter420, indexerRetryDelay420 } from '../src/event-delivery.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const EVENT_420: ProtocolEventDto420 = {
  chainId: '420',
  blockNumber: '88',
  blockHash: '0xBlock',
  transactionHash: '0xTx',
  transactionIndex: 1,
  logIndex: 3,
  contractAddress: '0xContract',
  protocol: '420Pay',
  eventName: 'PaymentSettled',
  objectKey: 'payment:42',
  lifecycleState: 'COMPLETED',
  fields: { paymentId: '42' }
};

test('delivery queue deduplicates equivalent handoffs', () => {
  const event = indexerEventEnvelope420(EVENT_420);
  const match = { subscriptionId: 'sub-1', eventId: event.id, matched: true as const };
  const queue = new IndexerDeliveryQueue420();
  const first = queue.enqueue(match, event, { provider: 'push', destination: 'device:abc' }, 1_000);
  const replay = queue.enqueue(match, event, { provider: 'PUSH', destination: 'device:abc' }, 2_000);

  assert.equal(first.id, replay.id);
  assert.equal(queue.records.size, 1);
  assert.equal(first.authoritative, false);
});

test('delivery queue produces provider-neutral handoff and acknowledges success', () => {
  const event = indexerEventEnvelope420(EVENT_420);
  const match = { subscriptionId: 'sub-2', eventId: event.id, matched: true as const };
  const queue = new IndexerDeliveryQueue420();
  const record = queue.enqueue(match, event, {
    provider: 'webhook', destination: 'endpoint-7', priority: 'high', severity: 'warning'
  }, 5_000);

  const handoff = queue.claim(record.id, 5_000);
  assert.equal(handoff?.provider, 'webhook');
  assert.equal(handoff?.destination, 'endpoint-7');
  assert.equal(handoff?.priority, 'high');
  assert.equal(handoff?.severity, 'warning');
  assert.equal(handoff?.authoritative, false);

  const delivered = queue.acknowledge(record.id);
  assert.equal(delivered.state, 'delivered');
  assert.equal(queue.claim(record.id, 6_000), null);
});

test('delivery failures back off deterministically then dead-letter at bounded attempts', () => {
  const event = indexerEventEnvelope420(EVENT_420);
  const match = { subscriptionId: 'sub-3', eventId: event.id, matched: true as const };
  const queue = new IndexerDeliveryQueue420();
  const record = queue.enqueue(match, event, { provider: 'email', destination: 'opaque-user', maxAttempts: 2 }, 10_000);

  assert.ok(queue.claim(record.id, 10_000));
  const retry = queue.fail(record.id, 'temporary outage', 10_100, { baseRetryMs: 1_000, maxRetryMs: 10_000 });
  assert.equal(retry.state, 'retry_wait');
  assert.equal(retry.nextAttemptAt, 11_100);
  assert.equal(queue.claim(record.id, 11_099), null);
  assert.ok(queue.claim(record.id, 11_100));

  const dead = queue.fail(record.id, 'still down', 11_200, { baseRetryMs: 1_000, maxRetryMs: 10_000 });
  assert.equal(dead.state, 'dead_letter');
  assert.equal(dead.attempts, 2);
});

test('retry delay is exponential and capped', () => {
  assert.equal(indexerRetryDelay420(1, 1_000, 5_000), 1_000);
  assert.equal(indexerRetryDelay420(2, 1_000, 5_000), 2_000);
  assert.equal(indexerRetryDelay420(4, 1_000, 5_000), 5_000);
});

test('rate limiter produces deterministic allow/deny decisions', () => {
  const limiter = new IndexerRateLimiter420();
  const policy = { maxDeliveries: 2, windowMs: 1_000 };
  assert.deepEqual(limiter.decide('provider:user', 100, policy), { allowed: true, remaining: 1, retryAfterMs: 0 });
  assert.deepEqual(limiter.decide('provider:user', 200, policy), { allowed: true, remaining: 0, retryAfterMs: 0 });
  assert.deepEqual(limiter.decide('provider:user', 300, policy), { allowed: false, remaining: 0, retryAfterMs: 800 });
  assert.deepEqual(limiter.decide('provider:user', 1_101, policy), { allowed: true, remaining: 1, retryAfterMs: 0 });
});

test('delivery identity mismatch fails closed', () => {
  const event = indexerEventEnvelope420(EVENT_420);
  const queue = new IndexerDeliveryQueue420();
  assert.throws(() => queue.enqueue(
    { subscriptionId: 'sub-4', eventId: 'wrong', matched: true },
    event,
    { provider: 'push', destination: 'device' },
    1
  ), /delivery event identity mismatch/);
});
