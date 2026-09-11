import type { IndexerDeliveryPolicy420, IndexerDeliveryRecord420 } from './event-delivery.js';
import { IndexerDeliveryQueue420 } from './event-delivery.js';
import type { IndexerEventBatch420, IndexerEventStream420, IndexerEventStreamRequest420 } from './event-stream.js';
import type { IndexerEventSubscription420 } from './event-subscription.js';
import { matchIndexerEventSubscriptions420, normalizeIndexerEventSubscription420 } from './event-subscription.js';
import type { IndexerEventCanonicalSignal420 } from './event-canonicality.js';

export interface NotificationBinding420 {
  subscription: IndexerEventSubscription420;
  delivery: IndexerDeliveryPolicy420;
}

export interface NotificationReplayCheckpoint420 {
  chainId: string;
  cursor: string | null;
  authoritative: false;
}

export interface NotificationDeliveryFailure420 {
  subscriptionId: string;
  eventId: string;
  code: 'delivery_enqueue_failed';
  message: string;
}

export interface NotificationBatchResult420 {
  chainId: string;
  eventCount: number;
  matchedCount: number;
  enqueued: IndexerDeliveryRecord420[];
  failures: NotificationDeliveryFailure420[];
  nextCursor: string | null;
  authoritative: false;
}

export interface NotificationCanonicalUpdate420 {
  signalId: string;
  kind: IndexerEventCanonicalSignal420['kind'];
  eventId: string;
  replacementEventId: string | null;
  chainId: string;
  blockNumber: string;
  blockHash: string;
  authoritative: false;
}

function safeFailureMessage420(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message ? message.slice(0, 256) : 'delivery_enqueue_failed';
  }
  return 'delivery_enqueue_failed';
}

function normalizedBindings420(bindings: NotificationBinding420[]): Map<string, NotificationBinding420> {
  const normalized = new Map<string, NotificationBinding420>();
  for (const binding of bindings) {
    const subscription = normalizeIndexerEventSubscription420(binding.subscription);
    if (normalized.has(subscription.id)) throw new Error(`duplicate notification subscription id: ${subscription.id}`);
    normalized.set(subscription.id, { subscription, delivery: binding.delivery });
  }
  return normalized;
}

/**
 * 420Notifications consumer adapter over the public/replayable indexer stream.
 * Checkpoints and delivery state are consumer-owned presentation state only.
 */
export class NotificationsConsumerAdapter420 {
  readonly checkpoints = new Map<string, NotificationReplayCheckpoint420>();

  constructor(
    readonly stream: Pick<IndexerEventStream420, 'protocolEvents'>,
    readonly queue: IndexerDeliveryQueue420,
    readonly bindings: NotificationBinding420[]
  ) {
    normalizedBindings420(bindings);
  }

  checkpoint(chainId: bigint): NotificationReplayCheckpoint420 {
    const id = chainId.toString();
    return this.checkpoints.get(id) ?? { chainId: id, cursor: null, authoritative: false };
  }

  restore(checkpoint: NotificationReplayCheckpoint420): void {
    if (!checkpoint.chainId.trim() || checkpoint.authoritative !== false) throw new Error('invalid notification checkpoint');
    if (checkpoint.cursor !== null && !checkpoint.cursor.trim()) throw new Error('invalid notification checkpoint cursor');
    this.checkpoints.set(checkpoint.chainId, { ...checkpoint, authoritative: false });
  }

  async replay(
    chainId: bigint,
    request: Omit<IndexerEventStreamRequest420, 'cursor'> = {},
    now = Date.now()
  ): Promise<NotificationBatchResult420> {
    const chainKey = chainId.toString();
    const current = this.checkpoint(chainId);
    const batch = await this.stream.protocolEvents(chainId, { ...request, cursor: current.cursor ?? undefined });
    const result = this.processBatch(chainKey, batch, now);
    this.checkpoints.set(chainKey, { chainId: chainKey, cursor: batch.nextCursor, authoritative: false });
    return result;
  }

  canonicalUpdate(signal: IndexerEventCanonicalSignal420): NotificationCanonicalUpdate420 {
    if (signal.authoritative !== false) throw new Error('invalid canonicality signal');
    return {
      signalId: signal.id,
      kind: signal.kind,
      eventId: signal.eventId,
      replacementEventId: signal.replacementEventId,
      chainId: signal.chainId,
      blockNumber: signal.blockNumber,
      blockHash: signal.blockHash,
      authoritative: false
    };
  }

  private processBatch(chainId: string, batch: IndexerEventBatch420, now: number): NotificationBatchResult420 {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid notification delivery time');
    const bindings = normalizedBindings420(this.bindings);
    const enqueued: IndexerDeliveryRecord420[] = [];
    const failures: NotificationDeliveryFailure420[] = [];
    let matchedCount = 0;

    for (const event of batch.events) {
      if (event.provenance.chainId !== chainId) throw new Error('notification batch chain mismatch');
      const subscriptions = [...bindings.values()].map((binding) => binding.subscription);
      const matches = matchIndexerEventSubscriptions420(subscriptions, event);
      matchedCount += matches.length;
      for (const match of matches) {
        const binding = bindings.get(match.subscriptionId)!;
        try {
          enqueued.push(this.queue.enqueue(match, event, binding.delivery, now));
        } catch (error) {
          failures.push({
            subscriptionId: match.subscriptionId,
            eventId: event.id,
            code: 'delivery_enqueue_failed',
            message: safeFailureMessage420(error)
          });
        }
      }
    }

    return {
      chainId,
      eventCount: batch.events.length,
      matchedCount,
      enqueued,
      failures,
      nextCursor: batch.nextCursor,
      authoritative: false
    };
  }
}
