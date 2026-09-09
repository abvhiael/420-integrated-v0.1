import {
  classifyProviderMethod420,
  WALLET_READ_METHODS_420,
  WALLET_PROVIDER_POLICY_420,
} from './signing-policy.js';

const DEFAULT_CHANNEL = '420-wallet-provider-v1';
const APPROVAL_CLASSIFICATIONS = new Set([
  'account-connect',
  'owner-transaction',
  'message-signature',
  'typed-data-signature',
]);

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  if (data !== undefined) error.data = data;
  return error;
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value) throw rpcError(4100, 'request origin required');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw rpcError(4100, 'invalid request origin');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw rpcError(4100, 'unsupported request origin');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw rpcError(4100, 'insecure request origin');
  }
  return url.origin;
}

function senderOrigin(sender) {
  const source = sender?.url ?? sender?.tab?.url;
  return normalizeOrigin(source);
}

function serializeError(error) {
  return {
    code: Number.isInteger(error?.code) ? error.code : -32603,
    message: typeof error?.message === 'string' && error.message ? error.message : '420 Wallet RPC routing failed',
    ...('data' in (error ?? {}) ? { data: error.data } : {}),
  };
}

export function createExtensionRpcRouter420({
  rpcRequest,
  requestApproval,
  channel = DEFAULT_CHANNEL,
} = {}) {
  if (typeof rpcRequest !== 'function') throw new Error('rpcRequest handler required');
  if (typeof requestApproval !== 'function') throw new Error('requestApproval handler required');

  return async function routeExtensionRpc420(message, sender = {}) {
    const requestId = message?.request?.id;
    const fail = (error) => ({ id: typeof requestId === 'string' ? requestId : null, error: serializeError(error) });

    try {
      if (!message || typeof message !== 'object') throw rpcError(-32600, 'invalid extension message');
      if (message.source !== '420-wallet-content' || message.channel !== channel || message.kind !== 'rpc') {
        throw rpcError(-32600, 'invalid extension RPC envelope');
      }

      const request = message.request;
      if (!request || typeof request !== 'object') throw rpcError(-32600, 'RPC request required');
      if (typeof request.id !== 'string' || !request.id) throw rpcError(-32600, 'RPC request id required');
      if (typeof request.method !== 'string' || !request.method) throw rpcError(-32600, 'RPC method required');
      if (request.params !== undefined && !Array.isArray(request.params) && (typeof request.params !== 'object' || request.params === null)) {
        throw rpcError(-32602, 'RPC params must be array or object');
      }

      const claimedOrigin = normalizeOrigin(message.origin);
      const actualOrigin = senderOrigin(sender);
      if (claimedOrigin !== actualOrigin) throw rpcError(4100, 'request origin does not match extension sender');
      if (sender?.frameId !== undefined && sender.frameId !== 0) throw rpcError(4100, 'subframe provider requests are not authorized');

      const classification = classifyProviderMethod420(request.method);
      if (classification === 'unsupported') throw rpcError(4200, `unsupported provider method: ${request.method}`);

      const context = Object.freeze({
        origin: actualOrigin,
        tabId: Number.isInteger(sender?.tab?.id) ? sender.tab.id : null,
        frameId: sender?.frameId ?? 0,
        method: request.method,
        authorityClass: classification,
      });

      let result;
      if (classification === 'read-only') {
        result = await rpcRequest(request.method, request.params ?? [], context);
      } else if (classification === 'accounts-read') {
        result = await requestApproval({ method: 'eth_accounts', params: [] }, { ...context, passive: true });
      } else if (APPROVAL_CLASSIFICATIONS.has(classification)) {
        result = await requestApproval({ method: request.method, params: request.params ?? [] }, context);
      } else {
        throw rpcError(4200, `unsupported provider authority class: ${classification}`);
      }

      return { id: request.id, result };
    } catch (error) {
      return fail(error);
    }
  };
}

export function attachExtensionRpcRouter420(runtime, router) {
  if (!runtime?.onMessage?.addListener) throw new Error('extension runtime.onMessage required');
  if (typeof router !== 'function') throw new TypeError('extension RPC router required');

  const listener = (message, sender, sendResponse) => {
    Promise.resolve(router(message, sender)).then(sendResponse, (error) => {
      sendResponse({ id: message?.request?.id ?? null, error: serializeError(error) });
    });
    return true;
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener?.(listener);
}

export const EXTENSION_READ_METHODS_420 = WALLET_READ_METHODS_420;
export const EXTENSION_APPROVAL_METHODS_420 = Object.freeze(Object.entries(WALLET_PROVIDER_POLICY_420)
  .filter(([, classification]) => APPROVAL_CLASSIFICATIONS.has(classification))
  .map(([method]) => method));
