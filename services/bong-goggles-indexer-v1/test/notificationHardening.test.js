import test from 'node:test';
import assert from 'node:assert/strict';

import { BongGogglesNotificationPipeline } from '../src/notificationPipeline.js';
import {
  NotificationFanoutGuard,
  deliverWithProviderIsolation,
  notificationDivergenceState,
  redactNotificationTelemetry,
  restoreNotificationRuntime,
} from '../src/notificationHardening.js';

function candidate(recipient = '0x00000000000000000000000000000000000000aa') {
  return { recipient };
}

test('fanout guard fails closed on event burst and recipient-rate abuse', () => {
  const guard = new NotificationFanoutGuard({ maxRecipientsPerEvent: 2, maxEventsPerRecipient: 2 });
  assert.throws(() => guard.admit([candidate('a'), candidate('b'), candidate('c')]), /fanout limit exceeded/);

  guard.admit([candidate('a')]);
  guard.admit([candidate('a')]);
  assert.throws(() => guard.admit([candidate('a')]), /recipient rate limit exceeded/);
});

test('fanout guard rejects a batch atomically when one recipient exceeds the window', () => {
  const guard = new NotificationFanoutGuard({ maxRecipientsPerEvent: 5, maxEventsPerRecipient: 1 });
  guard.admit([candidate('a')]);
  assert.throws(() => guard.admit([candidate('b'), candidate('a')]), /recipient rate limit exceeded/);
  assert.deepEqual(guard.snapshot().recipientCounts, [['a', 1]]);
});

test('fanout guard snapshot restore is deterministic and policy-bound', () => {
  const guard = new NotificationFanoutGuard({ maxRecipientsPerEvent: 10, maxEventsPerRecipient: 3 });
  guard.admit([candidate('B'), candidate('a')]);
  const snapshot = guard.snapshot();

  const restored = new NotificationFanoutGuard({ maxRecipientsPerEvent: 10, maxEventsPerRecipient: 3 });
  restored.restore(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);

  const incompatible = new NotificationFanoutGuard({ maxRecipientsPerEvent: 11, maxEventsPerRecipient: 3 });
  assert.throws(() => incompatible.restore(snapshot), /policy mismatch/);
});

test('structured telemetry redaction is recursive and preserves safe diagnostics', () => {
  const input = {
    providerId: 'genesis-push',
    nested: {
      ciphertext: 'secret-cipher',
      envelopeHash: '0xprivate',
      safe: 'visible',
      array: [{ token: 'bearer-x', count: 2 }],
    },
    body: 'private body',
  };
  const redacted = redactNotificationTelemetry(input);
  assert.equal(redacted.providerId, 'genesis-push');
  assert.equal(redacted.nested.safe, 'visible');
  assert.equal(redacted.nested.ciphertext, '[REDACTED]');
  assert.equal(redacted.nested.envelopeHash, '[REDACTED]');
  assert.equal(redacted.nested.array[0].token, '[REDACTED]');
  assert.equal(redacted.body, '[REDACTED]');
});

test('runtime recovery restores both replay dedupe and fanout counters', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const pipelineSnapshot = {
    checkpoint: { sourceKey: '420:10:0:0', chainId: 420, blockNumber: 10, blockHash: '0xabc', authoritative: false },
    deliveredIds: ['n-1'],
    authoritative: false,
  };
  const guard = new NotificationFanoutGuard({ maxRecipientsPerEvent: 10, maxEventsPerRecipient: 2 });
  const fanoutSnapshot = {
    maxRecipientsPerEvent: 10,
    maxEventsPerRecipient: 2,
    recipientCounts: [['0xaa', 1]],
    authoritative: false,
  };

  const restored = restoreNotificationRuntime({ pipeline, pipelineSnapshot, fanoutGuard: guard, fanoutSnapshot });
  assert.equal(restored.checkpoint.blockHash, '0xabc');
  assert.deepEqual(pipeline.snapshot().deliveredIds, ['n-1']);
  assert.deepEqual(guard.snapshot().recipientCounts, [['0xaa', 1]]);
});

test('provider failures are isolated and do not suppress successful channels', async () => {
  const handoffs = [
    { providerId: 'genesis-in-app', channel: 'in_app' },
    { providerId: 'genesis-web', channel: 'web' },
    { providerId: 'genesis-push', channel: 'push' },
  ];
  const results = await deliverWithProviderIsolation(handoffs, async (handoff) => {
    if (handoff.channel === 'web') throw new Error('provider down');
    return `${handoff.channel}:ok`;
  });

  assert.deepEqual(results.map((entry) => entry.ok), [true, false, true]);
  assert.equal(results[1].providerId, 'genesis-web');
  assert.match(results[1].error, /provider down/);
  assert.ok(results.every((entry) => entry.authoritative === false));
});

test('canonical divergence is explicit and cannot remain locally visible', () => {
  const diverged = notificationDivergenceState({
    localCheckpoint: { blockNumber: 100, blockHash: '0xaaa' },
    canonicalCheckpoint: { blockNumber: 100, blockHash: '0xbbb' },
    locallyVisible: true,
  });
  assert.equal(diverged.diverged, true);
  assert.equal(diverged.degraded, true);
  assert.equal(diverged.locallyVisible, false);
  assert.match(diverged.message, /differs from canonical chain state/);

  const converged = notificationDivergenceState({
    localCheckpoint: { blockNumber: 100, blockHash: '0xaaa' },
    canonicalCheckpoint: { blockNumber: 100, blockHash: '0xaaa' },
    locallyVisible: true,
  });
  assert.equal(converged.diverged, false);
  assert.equal(converged.locallyVisible, true);
});
