import { normalizePushReference420, rehydratePushAuthorization420 } from './push-authorization.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const DELIVERY_STATES = new Set(['foreground', 'background', 'terminated']);

export function normalizePushDelivery420(delivery = {}, { nowMs = Date.now() } = {}) {
  if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) throw rpcError(-32600, 'push delivery required');
  if (!DELIVERY_STATES.has(delivery.state)) throw rpcError(-32600, 'invalid push delivery state');
  const reference = normalizePushReference420(delivery.reference, { nowMs });
  return Object.freeze({ state: delivery.state, reference });
}

export function createPushReplayGuard420({ nowMs = () => Date.now(), maxEntries = 256 } = {}) {
  const consumed = new Map();
  function prune() {
    const now = nowMs();
    for (const [key, expiry] of consumed) if (expiry <= now) consumed.delete(key);
    while (consumed.size > maxEntries) consumed.delete(consumed.keys().next().value);
  }
  return Object.freeze({
    consume(reference) {
      prune();
      const normalized = normalizePushReference420(reference, { nowMs: nowMs() });
      const key = `${normalized.origin}\n${normalized.requestId}`;
      if (consumed.has(key)) throw rpcError(4100, 'push request replay rejected');
      consumed.set(key, normalized.expiresAt);
      return normalized;
    },
  });
}

/**
 * All app lifecycle states converge here. Push is reference-only and is never authorization.
 * Canonical request/security context are rehydrated only after the app is active.
 */
export function createPushDeliveryCoordinator420({
  fetchRequest,
  securityContext,
  nowMs = () => Date.now(),
  replayGuard = createPushReplayGuard420({ nowMs }),
} = {}) {
  return Object.freeze({
    async activate(delivery) {
      const normalized = normalizePushDelivery420(delivery, { nowMs: nowMs() });
      const reference = replayGuard.consume(normalized.reference);
      const hydrated = await rehydratePushAuthorization420(reference, {
        fetchRequest,
        securityContext,
        nowMs: nowMs(),
      });
      return Object.freeze({ state: normalized.state, ...hydrated });
    },
  });
}
