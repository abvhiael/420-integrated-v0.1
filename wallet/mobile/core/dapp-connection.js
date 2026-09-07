import { normalizeAddress } from '../../web/core/abi.js';

const READ_METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_getBalance',
  'eth_getCode', 'eth_getTransactionCount', 'eth_getTransactionReceipt',
  'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getLogs', 'net_version',
]);
const APPROVAL_METHODS = new Set(['eth_requestAccounts', 'eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4']);

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function normalizeMobileDappOrigin420(value) {
  if (typeof value !== 'string' || !value) throw rpcError(4100, 'dApp origin required');
  let url;
  try { url = new URL(value); } catch { throw rpcError(4100, 'invalid dApp origin'); }
  if (url.protocol !== 'https:') throw rpcError(4100, 'mobile dApp origin must use https');
  return url.origin;
}

export function parseMobileDappLink420(value) {
  if (typeof value !== 'string' || !value) throw rpcError(-32600, 'dApp link required');
  let url;
  try { url = new URL(value); } catch { throw rpcError(-32600, 'invalid dApp link'); }
  if (url.protocol !== 'https:') throw rpcError(4100, 'mobile dApp links must use https');
  const origin = normalizeMobileDappOrigin420(url.searchParams.get('origin'));
  const requestId = url.searchParams.get('requestId');
  if (!requestId) throw rpcError(-32600, 'dApp request id required');
  return Object.freeze({ origin, requestId, href: url.toString() });
}

export function normalizeMobileDappRequest420(request = {}, expectedOrigin) {
  const origin = normalizeMobileDappOrigin420(request.origin);
  if (expectedOrigin && origin !== normalizeMobileDappOrigin420(expectedOrigin)) throw rpcError(4100, 'dApp request origin mismatch');
  if (typeof request.id !== 'string' || !request.id) throw rpcError(-32600, 'RPC request id required');
  if (typeof request.method !== 'string' || !request.method) throw rpcError(-32600, 'RPC method required');
  if (request.params !== undefined && !Array.isArray(request.params) && (typeof request.params !== 'object' || request.params === null)) {
    throw rpcError(-32602, 'RPC params must be array or object');
  }
  if (!READ_METHODS.has(request.method) && !APPROVAL_METHODS.has(request.method) && request.method !== 'eth_accounts') {
    throw rpcError(4200, `unsupported provider method: ${request.method}`);
  }
  return Object.freeze({ id: request.id, origin, method: request.method, params: request.params ?? [] });
}

export function createMobileDappConnection420({ rpcRequest, requestApproval, accountsFor } = {}) {
  if (typeof rpcRequest !== 'function') throw new Error('rpcRequest handler required');
  if (typeof requestApproval !== 'function') throw new Error('requestApproval handler required');
  if (typeof accountsFor !== 'function') throw new Error('accountsFor handler required');

  return Object.freeze({
    async handle(request, expectedOrigin) {
      const normalized = normalizeMobileDappRequest420(request, expectedOrigin);
      const context = Object.freeze({ origin: normalized.origin, requestId: normalized.id, method: normalized.method });
      if (READ_METHODS.has(normalized.method)) return rpcRequest(normalized.method, normalized.params, context);
      if (normalized.method === 'eth_accounts') return accountsFor(normalized.origin);
      return requestApproval({ method: normalized.method, params: normalized.params }, context);
    },
    async assertAccountAccess(origin, account) {
      const normalizedOrigin = normalizeMobileDappOrigin420(origin);
      const accounts = await accountsFor(normalizedOrigin);
      const target = normalizeAddress(account);
      if (!accounts.map(normalizeAddress).includes(target)) throw rpcError(4100, 'dApp is not authorized for this wallet account');
      return target;
    },
  });
}

export const MOBILE_DAPP_READ_METHODS_420 = Object.freeze([...READ_METHODS]);
export const MOBILE_DAPP_APPROVAL_METHODS_420 = Object.freeze([...APPROVAL_METHODS]);
