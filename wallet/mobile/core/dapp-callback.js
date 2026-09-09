import { normalizeMobileDappOrigin420 } from './dapp-connection.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !value) throw rpcError(-32600, 'dApp request id required');
  return value;
}

function normalizeCallbackBase(value) {
  if (typeof value !== 'string' || !value) throw rpcError(-32600, 'callback URL required');
  let url;
  try { url = new URL(value); } catch { throw rpcError(-32600, 'invalid callback URL'); }
  if (url.protocol !== 'https:') throw rpcError(4100, 'mobile dApp callback must use https');
  return url;
}

function serializePayload(payload) {
  const json = JSON.stringify(payload);
  return encodeURIComponent(json);
}

export function buildMobileDappCallback420({ callbackUrl, origin, requestId, result, error } = {}) {
  const url = normalizeCallbackBase(callbackUrl);
  const normalizedOrigin = normalizeMobileDappOrigin420(origin);
  const id = normalizeRequestId(requestId);
  if ((result === undefined) === (error === undefined)) throw rpcError(-32600, 'callback must include exactly one of result or error');
  url.searchParams.set('origin', normalizedOrigin);
  url.searchParams.set('requestId', id);
  if (error !== undefined) {
    const code = Number.isInteger(error?.code) ? error.code : -32603;
    const message = typeof error?.message === 'string' && error.message ? error.message : '420 Wallet request failed';
    url.searchParams.set('error', serializePayload({ code, message, ...(error?.data !== undefined ? { data: error.data } : {}) }));
  } else {
    url.searchParams.set('result', serializePayload(result));
  }
  return url.toString();
}

export function parseMobileDappCallback420(value, expected = {}) {
  const url = normalizeCallbackBase(value);
  const origin = normalizeMobileDappOrigin420(url.searchParams.get('origin'));
  const requestId = normalizeRequestId(url.searchParams.get('requestId'));
  if (expected.origin && origin !== normalizeMobileDappOrigin420(expected.origin)) throw rpcError(4100, 'callback origin mismatch');
  if (expected.requestId && requestId !== normalizeRequestId(expected.requestId)) throw rpcError(-32600, 'callback request id mismatch');
  const resultRaw = url.searchParams.get('result');
  const errorRaw = url.searchParams.get('error');
  if ((resultRaw == null) === (errorRaw == null)) throw rpcError(-32600, 'callback must contain exactly one payload');
  try {
    return Object.freeze({
      origin,
      requestId,
      ...(resultRaw != null ? { result: JSON.parse(decodeURIComponent(resultRaw)) } : { error: JSON.parse(decodeURIComponent(errorRaw)) }),
    });
  } catch {
    throw rpcError(-32600, 'invalid callback payload');
  }
}
