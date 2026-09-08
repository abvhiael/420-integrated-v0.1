import { normalizeMobileDappOrigin420, normalizeMobileDappRequest420 } from './dapp-connection.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw rpcError(-32600, 'invalid push request id');
  return value;
}

export function normalizePushReference420(payload = {}, { nowMs = Date.now() } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw rpcError(-32600, 'push reference required');
  const allowed = new Set(['origin', 'requestId', 'expiresAt']);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) throw rpcError(-32600, `push contains forbidden field: ${key}`);
  const origin = normalizeMobileDappOrigin420(payload.origin);
  const requestId = normalizeRequestId(payload.requestId);
  const expiresAt = Number(payload.expiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowMs) throw rpcError(4100, 'push request expired');
  if (expiresAt - nowMs > 10 * 60_000) throw rpcError(-32600, 'push expiry exceeds maximum window');
  return Object.freeze({ origin, requestId, expiresAt });
}

export function normalizePushRegistration420(registration = {}) {
  const platform = registration.platform;
  if (platform !== 'apns' && platform !== 'fcm') throw rpcError(-32600, 'unsupported push platform');
  if (typeof registration.token !== 'string' || !/^[A-Za-z0-9:_\-.]{16,4096}$/.test(registration.token)) throw rpcError(-32600, 'invalid push token');
  return Object.freeze({ platform, token: registration.token });
}

export async function rehydratePushAuthorization420(reference, {
  fetchRequest,
  securityContext,
  nowMs = Date.now(),
} = {}) {
  const normalizedReference = normalizePushReference420(reference, { nowMs });
  if (typeof fetchRequest !== 'function') throw rpcError(-32603, 'canonical push request fetcher required');
  if (typeof securityContext !== 'function') throw rpcError(-32603, 'wallet security context required');

  const request = await fetchRequest(Object.freeze({ origin: normalizedReference.origin, requestId: normalizedReference.requestId }));
  const normalizedRequest = normalizeMobileDappRequest420(request, normalizedReference.origin);
  if (normalizedRequest.id !== normalizedReference.requestId) throw rpcError(-32600, 'rehydrated push request id mismatch');

  const context = await securityContext();
  if (!context || typeof context !== 'object') throw rpcError(4100, 'wallet security context unavailable');
  const requestAccount = typeof request.account === 'string' ? request.account.toLowerCase() : null;
  const activeAccount = typeof context.account === 'string' ? context.account.toLowerCase() : null;
  if (!requestAccount || !activeAccount || requestAccount !== activeAccount) throw rpcError(4100, 'push account drift');
  if (String(request.chainId).toLowerCase() !== String(context.chainId).toLowerCase()) throw rpcError(4901, 'push chain drift');
  if (!Number.isSafeInteger(request.authorizationEpoch) || request.authorizationEpoch !== context.authorizationEpoch) throw rpcError(4100, 'push authorization epoch drift');
  if (normalizedReference.expiresAt <= Date.now() && nowMs === undefined) throw rpcError(4100, 'push request expired');

  return Object.freeze({ reference: normalizedReference, request: normalizedRequest, securityContext: Object.freeze({
    account: activeAccount,
    chainId: context.chainId,
    authorizationEpoch: context.authorizationEpoch,
  }) });
}
