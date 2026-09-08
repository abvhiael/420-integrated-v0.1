import { normalizeMobileDappRequest420 } from './dapp-connection.js';
import { buildMobileDappCallback420 } from './dapp-callback.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertLiveHandoff(handoff, nowMs) {
  if (!handoff || typeof handoff !== 'object') throw rpcError(-32600, 'dApp handoff required');
  if (!Number.isSafeInteger(handoff.expiresAt) || handoff.expiresAt <= nowMs) throw rpcError(4100, 'dApp request expired');
  if (typeof handoff.origin !== 'string' || typeof handoff.requestId !== 'string' || typeof handoff.callbackUrl !== 'string') {
    throw rpcError(-32600, 'malformed dApp handoff');
  }
}

/** Rehydrates the canonical request from the dApp/origin. The handoff remains reference-only. */
export async function rehydrateMobileDappRequest420(handoff, {
  fetchRequest,
  nowMs = Date.now(),
} = {}) {
  assertLiveHandoff(handoff, nowMs);
  if (typeof fetchRequest !== 'function') throw rpcError(-32603, 'canonical dApp request fetcher required');
  const request = await fetchRequest(Object.freeze({ origin: handoff.origin, requestId: handoff.requestId }));
  const normalized = normalizeMobileDappRequest420(request, handoff.origin);
  if (normalized.id !== handoff.requestId) throw rpcError(-32600, 'rehydrated dApp request id mismatch');
  return Object.freeze({ handoff, request: normalized });
}

/**
 * Completion is single-shot, expiry-bound, and tied to the original origin/request callback.
 * The callback contains only the result/error envelope, never wallet secrets.
 */
export function createMobileDappCompletion420({ nowMs = () => Date.now() } = {}) {
  const completed = new Set();
  return Object.freeze({
    complete(handoff, { result, error } = {}) {
      const now = nowMs();
      assertLiveHandoff(handoff, now);
      const key = `${handoff.origin}\n${handoff.requestId}`;
      if (completed.has(key)) throw rpcError(4100, 'dApp request already completed');
      const callback = buildMobileDappCallback420({
        callbackUrl: handoff.callbackUrl,
        origin: handoff.origin,
        requestId: handoff.requestId,
        result,
        error,
      });
      completed.add(key);
      return callback;
    },
  });
}
