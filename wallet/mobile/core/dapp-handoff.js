import { normalizeMobileDappOrigin420 } from './dapp-connection.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw rpcError(-32600, 'invalid dApp request id');
  return value;
}

function normalizeExpiry(value, nowMs) {
  const expiresAt = Number(value);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw rpcError(-32600, 'invalid dApp request expiry');
  if (expiresAt <= nowMs) throw rpcError(4100, 'dApp request expired');
  if (expiresAt - nowMs > 10 * 60_000) throw rpcError(-32600, 'dApp request expiry exceeds maximum window');
  return expiresAt;
}

function normalizeCallback(value, origin) {
  if (typeof value !== 'string' || !value) throw rpcError(-32600, 'dApp callback URL required');
  let url;
  try { url = new URL(value); } catch { throw rpcError(-32600, 'invalid dApp callback URL'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw rpcError(4100, 'dApp callback must use credential-free https');
  if (url.origin !== origin) throw rpcError(4100, 'dApp callback origin mismatch');
  return url.toString();
}

export function parseMobileDappHandoff420(value, {
  productionHost,
  nowMs = Date.now(),
  allowDevelopmentScheme = false,
} = {}) {
  if (typeof value !== 'string' || !value) throw rpcError(-32600, 'dApp handoff URL required');

  // The WHATWG URL parser rejects schemes beginning with a digit, so recognize
  // the explicit 420wallet development scheme before applying production URL parsing.
  const isDevelopment = value.toLowerCase().startsWith('420wallet://');
  if (isDevelopment && !allowDevelopmentScheme) throw rpcError(4100, 'development wallet scheme is disabled');

  let url;
  try {
    url = new URL(isDevelopment ? `https://${value.slice('420wallet://'.length)}` : value);
  } catch {
    throw rpcError(-32600, 'invalid dApp handoff URL');
  }
  if (url.hash || url.username || url.password) throw rpcError(-32600, 'dApp handoff URL contains forbidden components');

  if (isDevelopment) {
    if (url.hostname !== 'connect' || (url.pathname && url.pathname !== '/')) throw rpcError(-32600, 'invalid development wallet handoff path');
  } else {
    if (url.protocol !== 'https:') throw rpcError(4100, 'production wallet handoff must use https');
    if (typeof productionHost !== 'string' || !productionHost) throw rpcError(-32600, 'production wallet link host required');
    if (url.hostname.toLowerCase() !== productionHost.toLowerCase() || url.pathname !== '/connect') throw rpcError(4100, 'wallet handoff host or path mismatch');
  }

  const origin = normalizeMobileDappOrigin420(url.searchParams.get('origin'));
  const requestId = normalizeRequestId(url.searchParams.get('requestId'));
  const expiresAt = normalizeExpiry(url.searchParams.get('expiresAt'), nowMs);
  const callbackUrl = normalizeCallback(url.searchParams.get('callback'), origin);
  return Object.freeze({ origin, requestId, expiresAt, callbackUrl, transport: isDevelopment ? 'development-scheme' : 'verified-link' });
}

export function createMobileHandoffReplayGuard420({ nowMs = () => Date.now(), maxEntries = 256 } = {}) {
  const seen = new Map();
  function prune() {
    const now = nowMs();
    for (const [key, expiry] of seen) if (expiry <= now) seen.delete(key);
    while (seen.size > maxEntries) seen.delete(seen.keys().next().value);
  }
  return Object.freeze({
    consume(handoff) {
      prune();
      if (!handoff || typeof handoff !== 'object') throw rpcError(-32600, 'dApp handoff required');
      const key = `${handoff.origin}\n${handoff.requestId}`;
      if (seen.has(key)) throw rpcError(4100, 'dApp handoff replay rejected');
      if (!Number.isSafeInteger(handoff.expiresAt) || handoff.expiresAt <= nowMs()) throw rpcError(4100, 'dApp request expired');
      seen.set(key, handoff.expiresAt);
      return handoff;
    },
  });
}
