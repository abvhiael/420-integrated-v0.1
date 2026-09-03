import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { inspectCapabilityGrant, CANONICAL_CAPABILITY_REGISTRY_420 } from './capabilities.js';

const SELECTOR_ENABLE_SESSION_KEY = '8d08b1a4';
const SELECTOR_REVOKE_KEY = '5ae7ab32';
const SELECTOR_CREATE_SESSION_GRANT = '388c930c';
const SELECTOR_SESSION_EPOCH = 'd557e335';
const SELECTOR_SESSION_SCOPE = 'fdb3c749';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;

function addressWord(value) { return normalizeAddress(value).slice(2).padStart(64, '0'); }
function bytes4Word(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{8}$/.test(value)) throw new Error('selector must be bytes4');
  return `${value.slice(2).toLowerCase()}${'0'.repeat(56)}`;
}
function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}
function normalizeUint(value, label, max = UINT256_MAX) {
  let n;
  try { n = typeof value === 'bigint' ? value : BigInt(value === '' ? '0' : value); }
  catch { throw new Error(`${label} must be an unsigned integer`); }
  if (n < 0n || n > max) throw new Error(`${label} out of range`);
  return n;
}
function decodeUint(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return BigInt(result);
}
function decodeBytes32(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return normalizeBytes32(result);
}
async function accountCall(provider, account, data) {
  return provider.request('eth_call', [{ to: normalizeAddress(account), data }, 'latest']);
}
async function simulate(provider, transaction, label) {
  let result;
  try { result = await provider.request('eth_call', [transaction, 'latest']); }
  catch (error) { throw new Error(`${label} simulation reverted: ${error?.message || 'eth_call failed'}`); }
  let gas;
  try { gas = await provider.request('eth_estimateGas', [transaction]); }
  catch (error) { throw new Error(`${label} gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`); }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid gas estimate');
  return { result, gas: gas.toLowerCase() };
}
function assertOwnerBoundary(controller, smartAccountState) {
  const owner = normalizeAddress(controller);
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before session-key administration');
  if (!smartAccountState.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== owner) {
    throw new Error('connected controller is not the on-chain SmartAccount420 owner');
  }
  if (normalizeAddress(smartAccountState.capabilityRegistry) !== CANONICAL_CAPABILITY_REGISTRY_420) {
    throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  }
  return owner;
}
function assertSessionKeyCandidate(key, smartAccountState) {
  const normalized = normalizeAddress(key);
  if (normalized === ZERO_ADDRESS) throw new Error('session key must be non-zero');
  if (normalized === normalizeAddress(smartAccountState.owner)) throw new Error('owner cannot be used as a session key');
  if (smartAccountState.recoveryAuthority && normalized === normalizeAddress(smartAccountState.recoveryAuthority)) {
    throw new Error('recovery authority cannot be used as a session key');
  }
  return normalized;
}
function assertSafeSessionTarget(target, smartAccountState) {
  const normalized = normalizeAddress(target);
  if (normalized === ZERO_ADDRESS) throw new Error('session target must be non-zero');
  const denied = new Set([
    smartAccountState.smartAccount,
    smartAccountState.factoryAddress,
    smartAccountState.entryPoint,
    smartAccountState.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
  if (denied.has(normalized)) throw new Error('session grant target cannot be a wallet authority contract');
  return normalized;
}

export async function readSessionEpoch(provider, smartAccount, key) {
  const data = `0x${SELECTOR_SESSION_EPOCH}${addressWord(key)}`;
  return decodeUint(await accountCall(provider, smartAccount, data), 'session epoch');
}

export async function readSessionScope(provider, smartAccount, target, selector) {
  const data = `0x${SELECTOR_SESSION_SCOPE}${addressWord(target)}${bytes4Word(selector)}`;
  return decodeBytes32(await accountCall(provider, smartAccount, data), 'session scope');
}

export async function prepareSessionKeyEnablement(provider, controller, smartAccountState, key) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const sessionKey = assertSessionKeyCandidate(key, smartAccountState);
  const currentEpoch = BigInt(smartAccountState.authorizationEpoch);
  const keyEpoch = await readSessionEpoch(provider, smartAccountState.smartAccount, sessionKey);
  if (keyEpoch === currentEpoch) throw new Error('session key is already enabled for the current authorization epoch');
  const transaction = {
    from: owner,
    to: normalizeAddress(smartAccountState.smartAccount),
    value: '0x0',
    data: `0x${SELECTOR_ENABLE_SESSION_KEY}${addressWord(sessionKey)}`,
  };
  const simulation = await simulate(provider, transaction, 'session key enablement');
  return { sessionKey, currentEpoch, previousEpoch: keyEpoch, transaction, simulation: { passed: true, ...simulation } };
}

export async function sendSessionKeyEnablement(provider, controller, smartAccountState, key) {
  const prepared = await prepareSessionKeyEnablement(provider, controller, smartAccountState, key);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function prepareSessionKeyRevocation(provider, controller, smartAccountState, key) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const sessionKey = assertSessionKeyCandidate(key, smartAccountState);
  const keyEpoch = await readSessionEpoch(provider, smartAccountState.smartAccount, sessionKey);
  if (keyEpoch === 0n) throw new Error('session key is not enabled');
  const transaction = {
    from: owner,
    to: normalizeAddress(smartAccountState.smartAccount),
    value: '0x0',
    data: `0x${SELECTOR_REVOKE_KEY}${addressWord(sessionKey)}`,
  };
  const simulation = await simulate(provider, transaction, 'session key revocation');
  return { sessionKey, previousEpoch: keyEpoch, transaction, simulation: { passed: true, ...simulation } };
}

export async function sendSessionKeyRevocation(provider, controller, smartAccountState, key) {
  const prepared = await prepareSessionKeyRevocation(provider, controller, smartAccountState, key);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export function normalizeSessionGrantRequest(request = {}, smartAccountState) {
  const key = assertSessionKeyCandidate(request.key, smartAccountState);
  const target = assertSafeSessionTarget(request.target, smartAccountState);
  if (typeof request.selector !== 'string' || !/^0x[0-9a-fA-F]{8}$/.test(request.selector)) throw new Error('selector must be bytes4');
  const selector = request.selector.toLowerCase();
  const perCallLimit = normalizeUint(request.perCallLimit ?? 0n, 'per-call limit');
  const periodLimit = normalizeUint(request.periodLimit ?? 0n, 'period limit');
  const periodSeconds = normalizeUint(request.periodSeconds ?? 0n, 'period seconds', UINT64_MAX);
  const validFrom = normalizeUint(request.validFrom ?? 0n, 'valid from', UINT64_MAX);
  const validUntil = normalizeUint(request.validUntil ?? 0n, 'valid until', UINT64_MAX);
  if ((periodLimit === 0n) !== (periodSeconds === 0n)) throw new Error('period limit and period seconds must both be zero or both be non-zero');
  if (validUntil !== 0n && validUntil <= validFrom) throw new Error('valid until must be zero or greater than valid from');
  return { key, target, selector, perCallLimit, periodLimit, periodSeconds, validFrom, validUntil };
}

export async function prepareSessionGrantCreation(provider, controller, smartAccountState, request = {}) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const normalized = normalizeSessionGrantRequest(request, smartAccountState);
  const currentEpoch = BigInt(smartAccountState.authorizationEpoch);
  const keyEpoch = await readSessionEpoch(provider, smartAccountState.smartAccount, normalized.key);
  if (keyEpoch !== currentEpoch) throw new Error('session key is not enabled for the current authorization epoch');
  const expectedScope = await readSessionScope(provider, smartAccountState.smartAccount, normalized.target, normalized.selector);
  if (expectedScope === ZERO_BYTES32) throw new Error('session scope resolved to zero');

  const transaction = {
    from: owner,
    to: normalizeAddress(smartAccountState.smartAccount),
    value: '0x0',
    data: `0x${SELECTOR_CREATE_SESSION_GRANT}${addressWord(normalized.key)}${addressWord(normalized.target)}${bytes4Word(normalized.selector)}${uintWord(normalized.perCallLimit)}${uintWord(normalized.periodLimit)}${uintWord(normalized.periodSeconds)}${uintWord(normalized.validFrom)}${uintWord(normalized.validUntil)}`,
  };
  const simulation = await simulate(provider, transaction, 'session grant creation');
  const expectedGrantId = decodeBytes32(simulation.result, 'session grant ID');
  if (expectedGrantId === ZERO_BYTES32) throw new Error('session grant simulation returned zero grant ID');
  return { ...normalized, currentEpoch, expectedScope, expectedGrantId, transaction, simulation: { passed: true, ...simulation } };
}

export async function sendSessionGrantCreation(provider, controller, smartAccountState, request = {}) {
  const prepared = await prepareSessionGrantCreation(provider, controller, smartAccountState, request);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmSessionManagementTransaction(provider, txHash, smartAccountState, expected = {}, options = {}) {
  const normalizedHash = normalizeTxHash(txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let receipt = null;
  for (let i = 0; i < attempts; i += 1) {
    receipt = await provider.request('eth_getTransactionReceipt', [normalizedHash]);
    if (receipt) break;
    if (i + 1 < attempts) await sleep(delayMs);
  }
  if (!receipt) throw new Error('session management transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('session management transaction reverted');

  if (expected.enabledKey) {
    const epoch = await readSessionEpoch(provider, smartAccountState.smartAccount, expected.enabledKey);
    const currentEpoch = BigInt(smartAccountState.authorizationEpoch);
    if (epoch !== currentEpoch) throw new Error('session key enablement failed post-confirmation verification');
    return { txHash: normalizedHash, receipt, sessionKey: normalizeAddress(expected.enabledKey), epoch };
  }
  if (expected.revokedKey) {
    const epoch = await readSessionEpoch(provider, smartAccountState.smartAccount, expected.revokedKey);
    if (epoch !== 0n) throw new Error('session key revocation failed post-confirmation verification');
    return { txHash: normalizedHash, receipt, sessionKey: normalizeAddress(expected.revokedKey), epoch };
  }
  if (expected.createdGrantId) {
    const inspection = await inspectCapabilityGrant(provider, smartAccountState, expected.createdGrantId);
    if (!inspection.exists || !inspection.belongsToAccount || inspection.grant.revoked) {
      throw new Error('created session grant failed post-confirmation verification');
    }
    if (expected.key && inspection.grant.principal !== normalizeAddress(expected.key)) throw new Error('created session grant principal mismatch');
    if (expected.scopeHash && inspection.grant.scopeHash !== normalizeBytes32(expected.scopeHash)) throw new Error('created session grant scope mismatch');
    return { txHash: normalizedHash, receipt, inspection };
  }
  return { txHash: normalizedHash, receipt };
}
