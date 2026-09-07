import { buildSigningReview420 } from './signing-review.js';

const SIGNING_METHODS = new Set(['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4']);

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  if (data !== undefined) error.data = data;
  return error;
}

export function createExtensionApprovalController420({
  permissionStore,
  getAvailableAccounts,
  promptApproval,
  executeApprovedRequest,
} = {}) {
  if (!permissionStore || typeof permissionStore.accountsFor !== 'function' || typeof permissionStore.grant !== 'function') {
    throw new Error('origin permission store required');
  }
  if (typeof getAvailableAccounts !== 'function') throw new Error('getAvailableAccounts handler required');
  if (typeof promptApproval !== 'function') throw new Error('promptApproval handler required');
  if (typeof executeApprovedRequest !== 'function') throw new Error('executeApprovedRequest handler required');

  return async function requestApproval420(request, context = {}) {
    const origin = context.origin;
    if (!origin) throw rpcError(4100, 'request origin required');

    if (request.method === 'eth_accounts') {
      return permissionStore.accountsFor(origin);
    }

    if (request.method === 'eth_requestAccounts') {
      const existing = await permissionStore.accountsFor(origin);
      if (existing.length) return existing;
      const available = await getAvailableAccounts(context);
      if (!Array.isArray(available) || !available.length) throw rpcError(4100, 'no wallet accounts available');
      const decision = await promptApproval({
        type: 'connect',
        origin,
        accounts: [...available],
        request,
        context,
      });
      if (!decision?.approved) throw rpcError(4001, 'User rejected the request');
      const selected = Array.isArray(decision.accounts) && decision.accounts.length ? decision.accounts : available;
      return permissionStore.grant(origin, selected);
    }

    if (SIGNING_METHODS.has(request.method)) {
      const granted = await permissionStore.accountsFor(origin);
      if (!granted.length) throw rpcError(4100, 'origin is not connected to 420 Wallet');
      const review = buildSigningReview420(request, { ...context, accounts: granted });
      const decision = await promptApproval({
        type: 'sign-or-send',
        origin,
        accounts: granted,
        request,
        review,
        context: { ...context, signingReview: review },
      });
      if (!decision?.approved) throw rpcError(4001, 'User rejected the request');
      return executeApprovedRequest(request, { ...context, accounts: granted, signingReview: review });
    }

    throw rpcError(4200, `unsupported approval method: ${request.method}`);
  };
}

export { SIGNING_METHODS as EXTENSION_SIGNING_METHODS_420 };
