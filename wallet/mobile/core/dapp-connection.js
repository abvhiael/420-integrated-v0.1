import { normalizeAddress } from '../../web/core/abi.js';
import {
  classifyProviderMethod420,
  WALLET_READ_METHODS_420,
  WALLET_PROVIDER_POLICY_420,
} from '../../web/core/signing-policy.js';
import { buildSigningReview420 } from '../../web/core/signing-review.js';

const APPROVAL_CLASSIFICATIONS = new Set([
  'account-connect',
  'owner-transaction',
  'message-signature',
  'typed-data-signature',
]);
const SIGNING_REVIEW_CLASSIFICATIONS = new Set([
  'owner-transaction',
  'message-signature',
  'typed-data-signature',
]);

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
  const authorityClass = classifyProviderMethod420(request.method);
  if (authorityClass === 'unsupported') throw rpcError(4200, `unsupported provider method: ${request.method}`);
  return Object.freeze({ id: request.id, origin, method: request.method, params: request.params ?? [], authorityClass });
}

export function createMobileDappConnection420({ rpcRequest, requestApproval, accountsFor } = {}) {
  if (typeof rpcRequest !== 'function') throw new Error('rpcRequest handler required');
  if (typeof requestApproval !== 'function') throw new Error('requestApproval handler required');
  if (typeof accountsFor !== 'function') throw new Error('accountsFor handler required');

  return Object.freeze({
    async handle(request, expectedOrigin) {
      const normalized = normalizeMobileDappRequest420(request, expectedOrigin);
      const context = {
        origin: normalized.origin,
        requestId: normalized.id,
        method: normalized.method,
        authorityClass: normalized.authorityClass,
      };
      if (normalized.authorityClass === 'read-only') return rpcRequest(normalized.method, normalized.params, Object.freeze(context));
      if (normalized.authorityClass === 'accounts-read') return accountsFor(normalized.origin);
      if (APPROVAL_CLASSIFICATIONS.has(normalized.authorityClass)) {
        if (SIGNING_REVIEW_CLASSIFICATIONS.has(normalized.authorityClass)) {
          const accounts = await accountsFor(normalized.origin);
          if (!accounts.length) throw rpcError(4100, 'dApp is not connected to 420 Wallet');
          const activeChainId = await rpcRequest('eth_chainId', [], Object.freeze({ ...context, authorityClass: 'read-only' }));
          context.signingReview = buildSigningReview420(
            { method: normalized.method, params: normalized.params },
            { ...context, accounts, chainId: activeChainId },
          );
        }
        return requestApproval({ method: normalized.method, params: normalized.params }, Object.freeze(context));
      }
      throw rpcError(4200, `unsupported provider authority class: ${normalized.authorityClass}`);
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

export const MOBILE_DAPP_READ_METHODS_420 = WALLET_READ_METHODS_420;
export const MOBILE_DAPP_APPROVAL_METHODS_420 = Object.freeze(Object.entries(WALLET_PROVIDER_POLICY_420)
  .filter(([, classification]) => APPROVAL_CLASSIFICATIONS.has(classification))
  .map(([method]) => method));
