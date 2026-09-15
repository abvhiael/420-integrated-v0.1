import test from 'node:test';
import assert from 'node:assert/strict';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import { IndexerDeliveryQueue420 } from '../src/event-delivery.js';
import { NotificationsConsumerAdapter420 } from '../src/notifications-adapter.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const EVENT_420: ProtocolEventDto420 = {
  chainId: '420',
  blockNumber: '100',
  blockHash: '0xBlock100',
  transactionHash: '0xTx100',
  transactionIndex: 0,
  logIndex: 1,
  contractAddress: '0xContract',
  protocol: '420Pay',
  eventName: 'PaymentSettled',
  objectKey: 'payment:100',
  lifecycleState: 'COMPLETED',
  fields: { paymentId: '100' }
};

function streamWithPages420() {
  const calls: Array<{ chainId: bigint; cursor?: string }> = [];
  const event = indexerEventEnvelope420(EVENT_420);
  return {
    calls,
    stream: {
      async protocolEvents(chainId: bigint, request: { cursor?: string }) {
        calls.push({ chainId, cursor: request.cursor });
        return {
          streamVersion: 'v1' as const,
          events: [event],
          nextCursor: request.cursor ? null : 'cursor-1',
          authoritative: false as const
        };
      }
    }
  };
}

test('420Notifications adapter replays from consumer-owned checkpoints', async () => {
  const { calls, stream } = streamWithPages420();
  const adapter = new NotificationsConsumerAdapter420(stream, new IndexerDeliveryQueue420(), [{
    subscription: { id: 'pay-complete', enabled: true, protocols: ['420Pay'], lifecycleStates: ['COMPLETED'] },
    delivery: { provider: 'push', destination: 'device:abc' }
  }]);

  const first = await adapter.replay(420n, {}, 1_000);
  assert.equal(first.eventCount, 1);
  assert.equal(first.matchedCount, 1);
  assert.equal(first.enqueued.length, 1);
  assert.equal(first.failures.length, 0);
  assert.deepEqual(adapter.checkpoint(420n), { chainId: '420', cursor: 'cursor-1', authoritative: false });

  const second = await adapter.replay(420n, {}, 2_000);
  assert.equal(calls[1].cursor, 'cursor-1');
  assert.equal(second.nextCursor, null);
  assert.deepEqual(adapter.checkpoint(420n), { chainId: '420', cursor: null, authoritative: false });
});

test('restored checkpoints resume replay without re-binding to index database state', async () => {
  const { calls, stream } = streamWithPages420();
  const adapter = new NotificationsConsumerAdapter420(stream, new IndexerDeliveryQueue420(), [{
    subscription: { id: 'pay', enabled: true, topics: ['420Pay.PaymentSettled'] },
    delivery: { provider: 'push', destination: 'device:abc' }
  }]);

  adapter.restore({ chainId: '420', cursor: 'cursor-1', authoritative: false });
  await adapter.replay(420n, {}, 3_000);
  assert.equal(calls[0].cursor, 'cursor-1');
});

test('delivery enqueue failure is isolated and does not block other matching subscriptions', async () => {
  const { stream } = streamWithPages420();
  const queue = new IndexerDeliveryQueue420();
  const adapter = new NotificationsConsumerAdapter420(stream, queue, [
    {
      subscription: { id: 'bad', enabled: true, protocols: ['420Pay'] },
      delivery: { provider: 'push', destination: '' }
    },
    {
      subscription: { id: 'good', enabled: true, protocols: ['420Pay'] },
      delivery: { provider: 'webhook', destination: 'endpoint:ok' }
    }
  ]);

  const result = await adapter.replay(420n, {}, 4_000);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.enqueued.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].subscriptionId, 'bad');
  assert.equal(result.failures[0].code, 'delivery_enqueue_failed');
  assert.equal(adapter.checkpoint(420n).cursor, 'cursor-1');
});

test('replaying the same event after restart remains delivery-idempotent', async () => {
  const event = indexerEventEnvelope420(EVENT_420);
  const stream = {
    async protocolEvents() {
      return { streamVersion: 'v1' as const, events: [event], nextCursor: null, authoritative: false as const };
    }
  };
  const queue = new IndexerDeliveryQueue420();
  const bindings = [{
    subscription: { id: 'pay', enabled: true, protocols: ['420Pay'] },
    delivery: { provider: 'push', destination: 'device:abc' }
  }];

  const first = new NotificationsConsumerAdapter420(stream, queue, bindings);
  const result1 = await first.replay(420n, {}, 5_000);
  const restarted = new NotificationsConsumerAdapter420(stream, queue, bindings);
  const result2 = await restarted.replay(420n, {}, 6_000);

  assert.equal(result1.enqueued[0].id, result2.enqueued[0].id);
  assert.equal(queue.records.size, 1);
});

test('canonicality signals map to non-authoritative notification updates', () => {
  const adapter = new NotificationsConsumerAdapter420({ protocolEvents: async () => {
    throw new Error('unused');
  } }, new IndexerDeliveryQueue420(), [{
    subscription: { id: 'pay', enabled: true, protocols: ['420Pay'] },
    delivery: { provider: 'push', destination: 'device:abc' }
  }]);

  const update = adapter.canonicalUpdate({
    id: 'signal-1',
    kind: 'superseded',
    eventId: 'old',
    replacementEventId: 'new',
    reason: 'reorg',
    chainId: '420',
    blockNumber: '100',
    blockHash: '0xBlock100',
    authoritative: false
  });
  assert.deepEqual(update, {
    signalId: 'signal-1',
    kind: 'superseded',
    eventId: 'old',
    replacementEventId: 'new',
    chainId: '420',
    blockNumber: '100',
    blockHash: '0xBlock100',
    authoritative: false
  });
});

test('batch chain mismatch fails closed before checkpoint advancement', async () => {
  const event = indexerEventEnvelope420({ ...EVENT_420, chainId: '421' });
  const adapter = new NotificationsConsumerAdapter420({
    async protocolEvents() {
      return { streamVersion: 'v1' as const, events: [event], nextCursor: 'bad-cursor', authoritative: false as const };
    }
  }, new IndexerDeliveryQueue420(), [{
    subscription: { id: 'pay', enabled: true, protocols: ['420Pay'] },
    delivery: { provider: 'push', destination: 'device:abc' }
  }]);

  await assert.rejects(() => adapter.replay(420n, {}, 7_000), /notification batch chain mismatch/);
  assert.deepEqual(adapter.checkpoint(420n), { chainId: '420', cursor: null, authoritative: false });
});
