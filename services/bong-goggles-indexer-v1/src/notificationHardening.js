const SENSITIVE_KEYS = new Set([
  'plaintext',
  'ciphertext',
  'payload',
  'body',
  'content',
  'envelopehash',
  'storagerefhash',
  'epochcommitment',
  'keycommitment',
  'privatekey',
  'secret',
  'token',
  'authorization',
  'cookie',
  'rawattention',
  'attentiontelemetry',
]);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function finitePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

export function redactNotificationTelemetry(value) {
  if (Array.isArray(value)) return value.map((entry) => redactNotificationTelemetry(entry));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    out[key] = SENSITIVE_KEYS.has(normalized) ? '[REDACTED]' : redactNotificationTelemetry(entry);
  }
  return out;
}

export class NotificationFanoutGuard {
  constructor({ maxRecipientsPerEvent = 500, maxEventsPerRecipient = 60 } = {}) {
    this.maxRecipientsPerEvent = finitePositiveInteger(maxRecipientsPerEvent, 'maxRecipientsPerEvent');
    this.maxEventsPerRecipient = finitePositiveInteger(maxEventsPerRecipient, 'maxEventsPerRecipient');
    this.recipientCounts = new Map();
  }

  admit(candidates) {
    if (!Array.isArray(candidates)) throw new Error('notification candidates must be an array');
    if (candidates.length > this.maxRecipientsPerEvent) throw new Error('notification fanout limit exceeded');

    const projected = new Map(this.recipientCounts);
    for (const candidate of candidates) {
      const recipient = String(required(candidate?.recipient, 'recipient')).trim().toLowerCase();
      const next = (projected.get(recipient) ?? 0) + 1;
      if (next > this.maxEventsPerRecipient) throw new Error('notification recipient rate limit exceeded');
      projected.set(recipient, next);
    }
    this.recipientCounts = projected;
    return candidates;
  }

  resetRecipientWindow() {
    this.recipientCounts.clear();
  }

  snapshot() {
    return {
      maxRecipientsPerEvent: this.maxRecipientsPerEvent,
      maxEventsPerRecipient: this.maxEventsPerRecipient,
      recipientCounts: [...this.recipientCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
      authoritative: false,
    };
  }

  restore(snapshot) {
    if (!snapshot || snapshot.authoritative !== false) throw new Error('invalid fanout guard snapshot');
    if (snapshot.maxRecipientsPerEvent !== this.maxRecipientsPerEvent || snapshot.maxEventsPerRecipient !== this.maxEventsPerRecipient) {
      throw new Error('fanout guard snapshot policy mismatch');
    }
    if (!Array.isArray(snapshot.recipientCounts)) throw new Error('invalid recipientCounts snapshot');
    const restored = new Map();
    for (const entry of snapshot.recipientCounts) {
      if (!Array.isArray(entry) || entry.length !== 2) throw new Error('invalid recipient count entry');
      const recipient = String(entry[0]).trim().toLowerCase();
      const count = Number(entry[1]);
      if (!recipient || !Number.isInteger(count) || count < 0 || count > this.maxEventsPerRecipient) throw new Error('invalid recipient count value');
      restored.set(recipient, count);
    }
    this.recipientCounts = restored;
  }
}

export function restoreNotificationRuntime({ pipeline, pipelineSnapshot, fanoutGuard, fanoutSnapshot }) {
  if (!pipeline || typeof pipeline.restore !== 'function') throw new Error('notification pipeline restore interface required');
  if (!fanoutGuard || typeof fanoutGuard.restore !== 'function') throw new Error('fanout guard restore interface required');
  pipeline.restore(pipelineSnapshot);
  fanoutGuard.restore(fanoutSnapshot);
  return Object.freeze({
    checkpoint: pipeline.snapshot().checkpoint,
    authoritative: false,
  });
}

export async function deliverWithProviderIsolation(handoffs, deliver) {
  if (!Array.isArray(handoffs)) throw new Error('notification handoffs must be an array');
  if (typeof deliver !== 'function') throw new Error('notification deliver function required');

  const results = [];
  for (const handoff of handoffs) {
    try {
      const result = await deliver(handoff);
      results.push(Object.freeze({
        providerId: handoff.providerId,
        channel: handoff.channel,
        ok: true,
        result,
        authoritative: false,
      }));
    } catch (error) {
      results.push(Object.freeze({
        providerId: handoff.providerId,
        channel: handoff.channel,
        ok: false,
        error: String(error?.message ?? error),
        authoritative: false,
      }));
    }
  }
  return Object.freeze(results);
}

export function notificationDivergenceState({
  localCheckpoint,
  canonicalCheckpoint,
  locallyVisible = true,
} = {}) {
  const local = required(localCheckpoint, 'localCheckpoint');
  const canonical = required(canonicalCheckpoint, 'canonicalCheckpoint');
  const sameHeight = Number(local.blockNumber) === Number(canonical.blockNumber);
  const sameHash = String(local.blockHash ?? '').toLowerCase() === String(canonical.blockHash ?? '').toLowerCase();
  const diverged = !sameHeight || !sameHash;

  return Object.freeze({
    diverged,
    degraded: diverged,
    locallyVisible: diverged ? false : locallyVisible === true,
    localCheckpoint: Object.freeze({ blockNumber: local.blockNumber, blockHash: local.blockHash }),
    canonicalCheckpoint: Object.freeze({ blockNumber: canonical.blockNumber, blockHash: canonical.blockHash }),
    message: diverged
      ? 'Notification state differs from canonical chain state. Local notification presentation is degraded until replay converges.'
      : '',
    authoritative: false,
  });
}
