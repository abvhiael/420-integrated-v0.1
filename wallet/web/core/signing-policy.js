const READ_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_getCode',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getBlockByNumber',
  'eth_getLogs',
  'net_version',
]);

const PROVIDER_POLICY = Object.freeze({
  eth_accounts: 'accounts-read',
  eth_requestAccounts: 'account-connect',
  eth_sendTransaction: 'owner-transaction',
  personal_sign: 'message-signature',
  eth_signTypedData_v4: 'typed-data-signature',
});

const INTERNAL_POLICY = Object.freeze({
  'owner-execution': 'owner-transaction',
  'passkey-userop': 'passkey',
  'session-userop': 'session',
  'recovery-set-authority': 'recovery',
  'recovery-propose': 'recovery',
  'recovery-cancel': 'recovery',
  'recovery-finalize': 'recovery',
  'session-enable': 'capability-admin',
  'session-revoke': 'capability-admin',
  'capability-grant': 'capability-admin',
  'capability-revoke': 'capability-admin',
  'passkey-enroll': 'capability-admin',
  'passkey-revoke': 'capability-admin',
});

export function classifyProviderMethod420(method) {
  if (typeof method !== 'string' || !method) return 'unsupported';
  if (READ_METHODS.has(method)) return 'read-only';
  return PROVIDER_POLICY[method] ?? 'unsupported';
}

export function classifyWalletAuthorityOperation420(operation) {
  if (typeof operation !== 'string' || !operation) return 'unsupported';
  return INTERNAL_POLICY[operation] ?? 'unsupported';
}

export function requiresWalletApproval420(classification) {
  return new Set([
    'account-connect',
    'owner-transaction',
    'message-signature',
    'typed-data-signature',
    'passkey',
    'session',
    'recovery',
    'capability-admin',
  ]).has(classification);
}

export function assertKnownWalletAuthority420({ method = null, operation = null } = {}) {
  const classification = method != null
    ? classifyProviderMethod420(method)
    : classifyWalletAuthorityOperation420(operation);
  if (classification === 'unsupported') {
    const value = method ?? operation ?? '<missing>';
    const error = new Error(`unsupported wallet authority action: ${value}`);
    error.code = 4200;
    throw error;
  }
  return classification;
}

export const WALLET_READ_METHODS_420 = Object.freeze([...READ_METHODS]);
export const WALLET_PROVIDER_POLICY_420 = PROVIDER_POLICY;
export const WALLET_INTERNAL_POLICY_420 = INTERNAL_POLICY;
