import { normalizeAccount, normalizeChainId } from './wallet-session.js';
import { transactionFingerprint } from './preflight.js';

export class WalletExecutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WalletExecutionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function providerRequest(provider, method, params = []) {
  if (!provider || typeof provider.request !== 'function') {
    throw new WalletExecutionError('PROVIDER_UNAVAILABLE', 'EIP-1193 provider required');
  }
  return provider.request({ method, params });
}

function sameAccount(left, right) {
  try { return normalizeAccount(left) === normalizeAccount(right); } catch { return false; }
}

function classifyWalletError(error) {
  const code = Number(error?.code);
  if (code === 4001) return new WalletExecutionError('USER_REJECTED', 'wallet request rejected by user', { providerCode:code });
  if (code === 4100) return new WalletExecutionError('UNAUTHORIZED', 'wallet request is not authorized', { providerCode:code });
  if (code === 4200) return new WalletExecutionError('UNSUPPORTED_METHOD', 'wallet does not support the requested method', { providerCode:code });
  if (code === 4900) return new WalletExecutionError('DISCONNECTED', 'wallet provider is disconnected', { providerCode:code });
  if (code === 4901) return new WalletExecutionError('CHAIN_DISCONNECTED', 'wallet is not connected to the required chain', { providerCode:code });
  return new WalletExecutionError('PROVIDER_ERROR', String(error?.message ?? 'wallet provider error'), { providerCode:Number.isFinite(code)?code:null });
}

async function liveWalletState(provider) {
  let chainId;
  let accounts;
  try {
    chainId = normalizeChainId(await providerRequest(provider, 'eth_chainId'));
    accounts = await providerRequest(provider, 'eth_accounts');
  } catch (error) {
    if (error instanceof WalletExecutionError) throw error;
    throw classifyWalletError(error);
  }
  const account = accounts?.[0] ? normalizeAccount(accounts[0]) : null;
  return { chainId, account };
}

function assertSession({ session, expectedChainId, expectedGeneration, expectedAccount }) {
  if (!session || session.status !== 'CONNECTED' || !session.account) {
    throw new WalletExecutionError('WALLET_DISCONNECTED', 'wallet session is not connected');
  }
  const chainId = normalizeChainId(expectedChainId);
  if (normalizeChainId(session.chainId) !== chainId) {
    throw new WalletExecutionError('CHAIN_MISMATCH', 'wallet session chain changed after preflight');
  }
  if (session.generation !== expectedGeneration) {
    throw new WalletExecutionError('STALE_SESSION', 'wallet session changed after review/preflight');
  }
  if (!sameAccount(session.account, expectedAccount)) {
    throw new WalletExecutionError('ACCOUNT_MISMATCH', 'wallet session account changed after preflight');
  }
  return { chainId, account:normalizeAccount(session.account) };
}

export function walletTransactionGate({ session, expectedChainId, expectedGeneration, transaction, preflight }) {
  if (!preflight?.ok) return { ok:false, reason:'preflight-required' };
  if (!transaction?.request) return { ok:false, reason:'transaction-required' };
  try {
    const expected = assertSession({
      session,
      expectedChainId,
      expectedGeneration,
      expectedAccount:transaction.request.from,
    });
    if (normalizeChainId(transaction.chainId) !== expected.chainId) return { ok:false, reason:'transaction-chain-mismatch' };
    if (normalizeChainId(preflight.chainId) !== expected.chainId) return { ok:false, reason:'preflight-chain-mismatch' };
    if (!sameAccount(preflight.account, expected.account)) return { ok:false, reason:'preflight-account-mismatch' };
    if (preflight.transactionFingerprint !== transactionFingerprint(transaction)) return { ok:false, reason:'preflight-transaction-mismatch' };
    return { ok:true, reason:null };
  } catch (error) {
    return { ok:false, reason:error.code ?? 'wallet-gate-failed' };
  }
}

export async function submitPreflightedTransaction({
  provider,
  session,
  expectedChainId,
  expectedGeneration,
  transaction,
  preflight,
} = {}) {
  const gate = walletTransactionGate({ session, expectedChainId, expectedGeneration, transaction, preflight });
  if (!gate.ok) throw new WalletExecutionError('SUBMISSION_BLOCKED', `transaction submission unavailable: ${gate.reason}`);

  const live = await liveWalletState(provider);
  const expected = assertSession({
    session,
    expectedChainId,
    expectedGeneration,
    expectedAccount:transaction.request.from,
  });
  if (live.chainId !== expected.chainId) {
    throw new WalletExecutionError('CHAIN_MISMATCH', 'live wallet chain changed after preflight', { expected:expected.chainId, actual:live.chainId });
  }
  if (!live.account || live.account !== expected.account) {
    throw new WalletExecutionError('ACCOUNT_MISMATCH', 'live wallet account changed after preflight', { expected:expected.account, actual:live.account });
  }

  const request = Object.freeze({
    ...transaction.request,
    gas: preflight.gasEstimate,
  });

  let txHash;
  try {
    txHash = await providerRequest(provider, 'eth_sendTransaction', [request]);
  } catch (error) {
    if (error instanceof WalletExecutionError) throw error;
    throw classifyWalletError(error);
  }
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new WalletExecutionError('INVALID_TX_HASH', 'wallet returned an invalid transaction hash');
  }

  return Object.freeze({
    kind:transaction.kind,
    account:expected.account,
    chainId:expected.chainId,
    generation:expectedGeneration,
    transactionFingerprint:preflight.transactionFingerprint,
    txHash:txHash.toLowerCase(),
    request,
  });
}

export function walletTypedDataGate({
  session,
  expectedChainId,
  expectedGeneration,
  signingRequest,
  qualification,
} = {}) {
  if (!qualification?.ok) return { ok:false, reason:'qualification-required' };
  if (!signingRequest?.typedData || signingRequest.method !== 'eth_signTypedData_v4') return { ok:false, reason:'typed-data-required' };
  try {
    const expected=assertSession({
      session,
      expectedChainId,
      expectedGeneration,
      expectedAccount:signingRequest.account,
    });
    if (normalizeChainId(signingRequest.chainId) !== expected.chainId) return { ok:false, reason:'signing-chain-mismatch' };
    if (normalizeChainId(qualification.chainId) !== expected.chainId) return { ok:false, reason:'qualification-chain-mismatch' };
    if (!sameAccount(qualification.account, expected.account)) return { ok:false, reason:'qualification-account-mismatch' };
    return { ok:true, reason:null };
  } catch (error) {
    return { ok:false, reason:error.code ?? 'wallet-gate-failed' };
  }
}

export async function signQualifiedLimitOrder({
  provider,
  session,
  expectedChainId,
  expectedGeneration,
  signingRequest,
  qualification,
} = {}) {
  const gate=walletTypedDataGate({session,expectedChainId,expectedGeneration,signingRequest,qualification});
  if(!gate.ok) throw new WalletExecutionError('SIGNING_BLOCKED', `limit-order signing unavailable: ${gate.reason}`);

  const expected=assertSession({
    session,
    expectedChainId,
    expectedGeneration,
    expectedAccount:signingRequest.account,
  });
  const live=await liveWalletState(provider);
  if(live.chainId!==expected.chainId) throw new WalletExecutionError('CHAIN_MISMATCH','live wallet chain changed before signing');
  if(!live.account||live.account!==expected.account) throw new WalletExecutionError('ACCOUNT_MISMATCH','live wallet account changed before signing');

  const typedDataJson=JSON.stringify(signingRequest.typedData);
  let signature;
  try{
    signature=await providerRequest(provider,'eth_signTypedData_v4',[expected.account,typedDataJson]);
  }catch(error){
    if(error instanceof WalletExecutionError) throw error;
    throw classifyWalletError(error);
  }
  if(typeof signature!=='string'||!/^0x[0-9a-fA-F]+$/.test(signature)||signature.length<4){
    throw new WalletExecutionError('INVALID_SIGNATURE','wallet returned an invalid typed-data signature');
  }
  return Object.freeze({
    kind:'LIMIT_ORDER',
    account:expected.account,
    chainId:expected.chainId,
    generation:expectedGeneration,
    signature:signature.toLowerCase(),
    typedData:signingRequest.typedData,
    order:signingRequest.order,
  });
}
