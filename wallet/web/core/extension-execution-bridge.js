import { normalizeAddress } from './abi.js';
import { discoverSmartAccount } from './accounts.js';
import { sendSmartAccountExecution } from './execution.js';

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  if (data !== undefined) error.data = data;
  return error;
}

function normalizeTxRequest(request = {}) {
  const tx = Array.isArray(request.params) ? request.params[0] : request.params?.transaction ?? request.params?.[0];
  if (!tx || typeof tx !== 'object') throw rpcError(-32602, 'transaction object required');
  if (!tx.to) throw rpcError(-32602, 'transaction target required');
  return {
    from: tx.from ? normalizeAddress(tx.from) : null,
    target: normalizeAddress(tx.to),
    value: tx.value ?? '0x0',
    data: tx.data ?? '0x',
  };
}

function assertGrantedFrom(granted, from) {
  if (!from) return granted[0];
  const normalized = normalizeAddress(from);
  if (!granted.includes(normalized)) throw rpcError(4100, 'transaction/signing account is not granted to this origin');
  return normalized;
}

export function createApprovedExtensionExecution420({
  provider,
  smartAccountConfig,
  signMessage,
  signTypedData,
  executeWithPasskey,
} = {}) {
  if (!provider || typeof provider.request !== 'function') throw new Error('extension execution provider required');
  if (typeof signMessage !== 'function') throw new Error('signMessage handler required');
  if (typeof signTypedData !== 'function') throw new Error('signTypedData handler required');

  return async function executeApprovedExtensionRequest420(request, context = {}) {
    const granted = Array.isArray(context.accounts) ? context.accounts.map(normalizeAddress) : [];
    if (!granted.length) throw rpcError(4100, 'origin has no granted wallet accounts');

    if (request.method === 'eth_sendTransaction') {
      const tx = normalizeTxRequest(request);
      const controller = assertGrantedFrom(granted, tx.from);
      const smartAccount = await discoverSmartAccount(provider, controller, smartAccountConfig);
      if (!smartAccount?.deployed || !smartAccount.controllerIsOwner) throw rpcError(4100, 'granted account is not the current SmartAccount420 owner');

      if (typeof executeWithPasskey === 'function' && context.preferPasskey === true) {
        const passkeyResult = await executeWithPasskey({ provider, controller, smartAccount, request: tx, context });
        if (!passkeyResult?.txHash) throw rpcError(-32603, 'passkey execution did not return a transaction hash');
        return passkeyResult.txHash;
      }

      const submitted = await sendSmartAccountExecution(provider, controller, smartAccount, tx);
      return submitted.txHash;
    }

    if (request.method === 'personal_sign') {
      const params = Array.isArray(request.params) ? request.params : [];
      if (params.length < 2) throw rpcError(-32602, 'personal_sign requires message and account');
      const account = assertGrantedFrom(granted, params[1]);
      return signMessage({ provider, account, message: params[0], context });
    }

    if (request.method === 'eth_signTypedData_v4') {
      const params = Array.isArray(request.params) ? request.params : [];
      if (params.length < 2) throw rpcError(-32602, 'eth_signTypedData_v4 requires account and typed data');
      const account = assertGrantedFrom(granted, params[0]);
      return signTypedData({ provider, account, typedData: params[1], context });
    }

    throw rpcError(4200, `unsupported approved execution method: ${request.method}`);
  };
}
