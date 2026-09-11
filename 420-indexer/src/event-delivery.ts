import type { IndexerEventEnvelope420 } from './event-stream.js';
import type { IndexerEventMatch420 } from './event-subscription.js';

export type IndexerDeliveryPriority420 = 'low' | 'normal' | 'high' | 'critical';
export type IndexerDeliverySeverity420 = 'info' | 'notice' | 'warning' | 'critical';
export type IndexerDeliveryState420 = 'queued' | 'in_flight' | 'delivered' | 'retry_wait' | 'dead_letter';

export interface IndexerDeliveryPolicy420 {
  provider: string;
  destination: string;
  priority?: IndexerDeliveryPriority420;
  severity?: IndexerDeliverySeverity420;
  maxAttempts?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
}

export interface IndexerDeliveryRecord420 {
  id: string;
  deduplicationKey: string;
  subscriptionId: string;
  eventId: string;
  provider: string;
  destination: string;
  priority: IndexerDeliveryPriority420;
  severity: IndexerDeliverySeverity420;
  state: IndexerDeliveryState420;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  event: IndexerEventEnvelope420;
  authoritative: false;
}

export interface IndexerDeliveryHandoff420 {
  deliveryId: string;
  provider: string;
  destination: string;
  priority: IndexerDeliveryPriority420;
  severity: IndexerDeliverySeverity420;
  event: IndexerEventEnvelope420;
  authoritative: false;
}

export interface IndexerRateLimitPolicy420 {
  maxDeliveries: number;
  windowMs: number;
}

export interface IndexerRateLimitDecision420 {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function requiredNonEmpty420(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} must not be empty`);
  return normalized;
}

function boundedInteger420(value: number | undefined, fallback: number, min: number, max: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw new Error(`invalid ${name}`);
  return resolved;
}

function safeError420(error: unknown): string {
  if (typeof error !== 'string') return 'delivery_failed';
  const normalized = error.trim();
  return normalized ? normalized.slice(0, 256) : 'delivery_failed';
}

export function indexerDeliveryDeduplicationKey420(match: IndexerEventMatch420, policy: IndexerDeliveryPolicy420): string {
  return [
    '420delivery:v1',
    requiredNonEmpty420(match.subscriptionId, 'subscription id'),
    requiredNonEmpty420(match.eventId, 'event id'),
    requiredNonEmpty420(policy.provider, 'provider').toLowerCase(),
    requiredNonEmpty420(policy.destination, 'destination')
  ].map(encodeURIComponent).join(':');
}

export function indexerRetryDelay420(attempts: number, baseRetryMs = 1_000, maxRetryMs = 60_000): number {
  const attempt = boundedInteger420(attempts, 0, 0, 31, 'attempts');
  const base = boundedInteger420(baseRetryMs, 1_000, 1, 3_600_000, 'baseRetryMs');
  const cap = boundedInteger420(maxRetryMs, 60_000, base, 86_400_000, 'maxRetryMs');
  return Math.min(cap, base * (2 ** Math.max(0, attempt - 1)));
}

export class IndexerDeliveryQueue420 {
  readonly records = new Map<string, IndexerDeliveryRecord420>();
  readonly deduplication = new Map<string, string>();

  enqueue(match: IndexerEventMatch420, event: IndexerEventEnvelope420, policy: IndexerDeliveryPolicy420, now: number): IndexerDeliveryRecord420 {
    if (match.eventId !== event.id) throw new Error('delivery event identity mismatch');
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid delivery time');
    const key = indexerDeliveryDeduplicationKey420(match, policy);
    const existingId = this.deduplication.get(key);
    if (existingId) return this.records.get(existingId)!;

    const provider = requiredNonEmpty420(policy.provider, 'provider');
    const destination = requiredNonEmpty420(policy.destination, 'destination');
    const maxAttempts = boundedInteger420(policy.maxAttempts, 5, 1, 32, 'maxAttempts');
    const id = `420delivery:v1:${encodeURIComponent(match.subscriptionId)}:${encodeURIComponent(event.id)}:${this.records.size + 1}`;
    const record: IndexerDeliveryRecord420 = {
      id,
      deduplicationKey: key,
      subscriptionId: match.subscriptionId,
      eventId: event.id,
      provider,
      destination,
      priority: policy.priority ?? 'normal',
      severity: policy.severity ?? 'info',
      state: 'queued',
      attempts: 0,
      maxAttempts,
      nextAttemptAt: now,
      lastError: null,
      event,
      authoritative: false
    };
    this.records.set(id, record);
    this.deduplication.set(key, id);
    return record;
  }

  claim(deliveryId: string, now: number): IndexerDeliveryHandoff420 | null {
    const record = this.records.get(deliveryId);
    if (!record) throw new Error('delivery not found');
    if (record.state === 'delivered' || record.state === 'dead_letter' || record.state === 'in_flight') return null;
    if (now < record.nextAttemptAt) return null;
    record.state = 'in_flight';
    record.attempts += 1;
    return {
      deliveryId: record.id,
      provider: record.provider,
      destination: record.destination,
      priority: record.priority,
      severity: record.severity,
      event: record.event,
      authoritative: false
    };
  }

  acknowledge(deliveryId: string): IndexerDeliveryRecord420 {
    const record = this.records.get(deliveryId);
    if (!record) throw new Error('delivery not found');
    if (record.state !== 'in_flight') throw new Error('delivery is not in flight');
    record.state = 'delivered';
    record.lastError = null;
    return record;
  }

  fail(deliveryId: string, error: unknown, now: number, policy: Pick<IndexerDeliveryPolicy420, 'baseRetryMs' | 'maxRetryMs'> = {}): IndexerDeliveryRecord420 {
    const record = this.records.get(deliveryId);
    if (!record) throw new Error('delivery not found');
    if (record.state !== 'in_flight') throw new Error('delivery is not in flight');
    record.lastError = safeError420(error);
    if (record.attempts >= record.maxAttempts) {
      record.state = 'dead_letter';
      record.nextAttemptAt = now;
      return record;
    }
    record.state = 'retry_wait';
    record.nextAttemptAt = now + indexerRetryDelay420(record.attempts, policy.baseRetryMs, policy.maxRetryMs);
    return record;
  }
}

export class IndexerRateLimiter420 {
  readonly attempts = new Map<string, number[]>();

  decide(key: string, now: number, policy: IndexerRateLimitPolicy420): IndexerRateLimitDecision420 {
    const normalizedKey = requiredNonEmpty420(key, 'rate limit key');
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid rate limit time');
    const maxDeliveries = boundedInteger420(policy.maxDeliveries, 1, 1, 1_000_000, 'maxDeliveries');
    const windowMs = boundedInteger420(policy.windowMs, 1, 1, 86_400_000, 'windowMs');
    const cutoff = now - windowMs;
    const active = (this.attempts.get(normalizedKey) ?? []).filter((timestamp) => timestamp > cutoff);
    if (active.length >= maxDeliveries) {
      this.attempts.set(normalizedKey, active);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, active[0] + windowMs - now) };
    }
    active.push(now);
    this.attempts.set(normalizedKey, active);
    return { allowed: true, remaining: maxDeliveries - active.length, retryAfterMs: 0 };
  }
}
