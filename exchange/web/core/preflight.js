import {
  decodeBool,
  decodeRevertData,
  decodeUint256,
  encodeAllowance,
  encodeCanBridgeWithdraw,
  encodeCanPlaceLimitOrder,
  encodeCanSwap,
  functionSelector,
  keccak256,
} from './abi.js';
import { normalizeChainId } from './wallet-session.js';

const KNOWN_ERROR_SIGNATURES = Object.freeze([
  'InvalidAddress()','InvalidPath()','PathHashMismatch()','InactiveMarket()','InvalidPair()',
  'UnauthorizedSwap()','UnauthorizedDelegatedExecutor()','UnauthorizedGovernance()','SlippageExceeded()',
  'InvalidAllowanceTarget()','TokenCallFailed()','InitialInputMismatch()','IntermediateInputMismatch()',
  'IntermediateOutputMismatch()','FinalOutputMismatch()','DelegatedInputMismatch()','RepeatedToken()',
  'InvalidNativeValue()','NativeTransferFailed()','UnexpectedNativeSender()','FeePolicyUnavailable()',
  'Reentrancy()','InvalidOrder()','InvalidSignature()','OrderExpired()','OrderCancelled()','NonceInvalid()',
  'NonceAlreadyBound()','OrderFullyFilled()','PartialFillNotAllowed()','FillExceedsRemaining()',
  'UnauthorizedLimitOrder()','InvalidOrderPath()','InputBalanceMismatch()','ResidualBalance()',
  'InvalidNonceFloor()','InvalidQualification()','ExchangeAssetIneligible()','BridgeAssetIneligible()',
  'ChainIneligible()','RouteIneligible()','AdapterMismatch()','ProvenanceMismatch()',
]);
const KNOWN_ERRORS = new Map(KNOWN_ERROR_SIGNATURES.map((signature)=>[functionSelector(signature),signature]));

export class ExchangePreflightError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ExchangePreflightError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function rpcErrorData(error) {
  return error?.data?.data ?? error?.data ?? error?.error?.data ?? error?.cause?.data ?? null;
}

export function classifyExchangeRevert(error) {
  const decoded = decodeRevertData(rpcErrorData(error));
  const signature = decoded.selector ? KNOWN_ERRORS.get(decoded.selector) ?? null : null;
  return Object.freeze({
    ...decoded,
    signature,
    message: decoded.message ?? signature ?? String(error?.message ?? 'execution reverted'),
  });
}

async function request(provider, method, params = []) {
  if (!provider || typeof provider.request !== 'function') {
    throw new ExchangePreflightError('RPC_UNAVAILABLE', 'EIP-1193/RPC provider required');
  }
  try {
    return await provider.request({ method, params });
  } catch (error) {
    throw error;
  }
}

function validAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new ExchangePreflightError('INVALID_CHECK', `invalid ${label}`);
  }
  return value;
}

function validBytes32(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new ExchangePreflightError('INVALID_CHECK', `invalid ${label}`);
  }
  return value;
}

function rawUint(value, label) {
  try {
    const n = BigInt(value);
    if (n < 0n) throw new Error('negative');
    return n;
  } catch {
    throw new ExchangePreflightError('INVALID_CHECK', `invalid ${label}`);
  }
}

export function transactionFingerprint(transaction) {
  if (!transaction?.request || !transaction?.chainId) throw new ExchangePreflightError('INVALID_TRANSACTION', 'transaction envelope required');
  const request = transaction.request;
  const canonical = [
    String(transaction.kind ?? ''),
    normalizeChainId(transaction.chainId),
    String(request.from ?? '').toLowerCase(),
    String(request.to ?? '').toLowerCase(),
    String(request.data ?? '').toLowerCase(),
    String(request.value ?? '0x0').toLowerCase(),
  ].join('|');
  return keccak256(canonical);
}

export function freshnessGate({ observedAt, expiresAt, nowSeconds, maxAgeSeconds = null } = {}) {
  const now = Number(nowSeconds);
  const observed = Number(observedAt);
  const expires = Number(expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(observed) || !Number.isFinite(expires)) {
    return { ok:false, reason:'freshness-unavailable' };
  }
  if (now > expires) return { ok:false, reason:'expired' };
  if (maxAgeSeconds !== null) {
    const maxAge = Number(maxAgeSeconds);
    if (!Number.isFinite(maxAge) || maxAge < 0) return { ok:false, reason:'invalid-max-age' };
    if (now - observed > maxAge) return { ok:false, reason:'stale' };
  }
  return { ok:true, reason:null };
}

export async function checkAllowance({ provider, token, owner, spender, requiredAmountRaw }) {
  validAddress(token, 'allowance token');
  validAddress(owner, 'allowance owner');
  validAddress(spender, 'allowance spender');
  const required = rawUint(requiredAmountRaw, 'required allowance');
  const result = await request(provider, 'eth_call', [{ to:token, data:encodeAllowance(owner, spender) }, 'latest']);
  const allowance = decodeUint256(result);
  return Object.freeze({ ok: allowance >= required, allowance: allowance.toString(), required: required.toString(), token, owner, spender });
}

export async function checkAuthorization({ provider, authorizationContract, principal, action, subjectId, amountRaw }) {
  validAddress(authorizationContract, 'ExchangeAuthorization420');
  validAddress(principal, 'authorization principal');
  validBytes32(subjectId, 'authorization subject');
  const amount = rawUint(amountRaw, 'authorization amount');
  if (amount <= 0n) throw new ExchangePreflightError('INVALID_CHECK', 'authorization amount must be positive');

  let data;
  if (action === 'SWAP') data = encodeCanSwap(principal, subjectId, amount);
  else if (action === 'LIMIT_ORDER') data = encodeCanPlaceLimitOrder(principal, subjectId, amount);
  else if (action === 'BRIDGE_WITHDRAW') data = encodeCanBridgeWithdraw(principal, subjectId, amount);
  else throw new ExchangePreflightError('INVALID_CHECK', 'unsupported authorization action');

  const result = await request(provider, 'eth_call', [{ to:authorizationContract, data }, 'latest']);
  return Object.freeze({ ok:decodeBool(result), action, principal, subjectId, amountRaw:amount.toString() });
}

export async function checkStaticCall({ provider, to, data, label = 'static-call' }) {
  validAddress(to, 'static call target');
  if (typeof data !== 'string' || !/^0x[0-9a-fA-F]+$/.test(data)) {
    throw new ExchangePreflightError('INVALID_CHECK', 'invalid static call data');
  }
  try {
    const result = await request(provider, 'eth_call', [{ to, data }, 'latest']);
    return Object.freeze({ ok:true, label, result });
  } catch (error) {
    const revert = classifyExchangeRevert(error);
    throw new ExchangePreflightError('STATIC_CALL_REVERTED', `${label} reverted: ${revert.message}`, { revert });
  }
}

export async function preflightExchangeTransaction({
  provider,
  transaction,
  runtime,
  freshness = null,
  allowanceChecks = [],
  authorizationChecks = [],
  staticCalls = [],
} = {}) {
  if (!transaction?.request || !transaction?.chainId) {
    throw new ExchangePreflightError('INVALID_TRANSACTION', 'V15.2 transaction envelope required');
  }
  if (runtime?.deployment?.status !== 'RESOLVED') {
    throw new ExchangePreflightError('DEPLOYMENT_UNRESOLVED', 'Exchange deployment is not resolved');
  }

  const expectedChainId = normalizeChainId(transaction.chainId);
  const runtimeChainId = normalizeChainId(runtime.network?.chainId);
  if (runtimeChainId !== expectedChainId) {
    throw new ExchangePreflightError('CHAIN_MISMATCH', 'transaction/runtime chain mismatch', { expectedChainId, runtimeChainId });
  }
  const actualChainId = normalizeChainId(await request(provider, 'eth_chainId'));
  if (actualChainId !== expectedChainId) {
    throw new ExchangePreflightError('CHAIN_MISMATCH', 'RPC chain mismatch', { expectedChainId, actualChainId });
  }

  let freshnessResult = null;
  if (freshness) {
    freshnessResult = freshnessGate(freshness);
    if (!freshnessResult.ok) {
      throw new ExchangePreflightError('STALE_INTENT', `intent freshness check failed: ${freshnessResult.reason}`, { freshness:freshnessResult });
    }
  }

  const allowances = [];
  for (const check of allowanceChecks) {
    const result = await checkAllowance({ provider, ...check });
    allowances.push(result);
    if (!result.ok) {
      throw new ExchangePreflightError('INSUFFICIENT_ALLOWANCE', 'required token allowance is insufficient', { allowance:result });
    }
  }

  const authorizationContract = validAddress(runtime.contracts?.ExchangeAuthorization420, 'ExchangeAuthorization420');
  const authorizations = [];
  for (const check of authorizationChecks) {
    const result = await checkAuthorization({ provider, authorizationContract, ...check });
    authorizations.push(result);
    if (!result.ok) {
      throw new ExchangePreflightError('UNAUTHORIZED', `authorization denied: ${result.action}`, { authorization:result });
    }
  }

  const staticResults = [];
  for (const check of staticCalls) staticResults.push(await checkStaticCall({ provider, ...check }));

  let simulationResult;
  try {
    simulationResult = await request(provider, 'eth_call', [transaction.request, 'latest']);
  } catch (error) {
    const revert = classifyExchangeRevert(error);
    throw new ExchangePreflightError('SIMULATION_REVERTED', `transaction simulation reverted: ${revert.message}`, { revert });
  }

  let gasEstimate;
  try {
    gasEstimate = await request(provider, 'eth_estimateGas', [transaction.request]);
    if (typeof gasEstimate !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gasEstimate) || BigInt(gasEstimate) <= 0n) {
      throw new Error('invalid gas estimate');
    }
  } catch (error) {
    if (error instanceof ExchangePreflightError) throw error;
    const revert = classifyExchangeRevert(error);
    throw new ExchangePreflightError('GAS_ESTIMATE_FAILED', `gas estimation failed: ${revert.message}`, { revert });
  }

  return Object.freeze({
    ok:true,
    kind:transaction.kind,
    chainId:actualChainId,
    account:String(transaction.request.from).toLowerCase(),
    transactionFingerprint:transactionFingerprint(transaction),
    freshness:freshnessResult,
    allowances:Object.freeze(allowances),
    authorizations:Object.freeze(authorizations),
    staticCalls:Object.freeze(staticResults),
    simulationResult,
    gasEstimate,
  });
}
