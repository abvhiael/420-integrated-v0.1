import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { normalizeCallData, normalizeNativeValue } from './execution.js';
import {
  CANONICAL_CAPABILITY_REGISTRY_420,
  SESSION_EXECUTE_CAPABILITY_420,
  inspectCapabilityGrant,
  readActiveGrantId,
  readCapabilityAuthorization,
} from './capabilities.js';
import { readSessionEpoch, readSessionScope } from './session-management.js';

const SELECTOR_ACCOUNT_NONCE = 'd86f2b3c';
const SELECTOR_EXECUTE_SESSION = 'efff7e19';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const UINT192_MAX = (1n << 192n) - 1n;
const ERC20_TRANSFER = 'a9059cbb';
const ERC20_APPROVE = '095ea7b3';
const ERC20_TRANSFER_FROM = '23b872dd';

function word(value) { return value.replace(/^0x/, '').padStart(64, '0'); }
function addressWord(value) { return normalizeAddress(value).slice(2).padStart(64, '0'); }
function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function bytesData(value) {
  const data = normalizeCallData(value);
  const hex = data.slice(2);
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  return `${uintWord(hex.length / 2)}${padded}`;
}
function decodeUint(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return BigInt(result);
}
function targetSelector(data) {
  return data.length >= 10 ? data.slice(2, 10) : '00000000';
}
function tokenSpend(data) {
  const selector = targetSelector(data);
  const hex = data.slice(10);
  if (selector === ERC20_TRANSFER || selector === ERC20_APPROVE) {
    if (hex.length < 128) throw new Error('malformed ERC20 transfer/approve calldata');
    return BigInt(`0x${hex.slice(64, 128)}`);
  }
  if (selector === ERC20_TRANSFER_FROM) {
    if (hex.length < 192) throw new Error('malformed ERC20 transferFrom calldata');
    return BigInt(`0x${hex.slice(128, 192)}`);
  }
  return 0n;
}
function assertSessionState(smartAccountState, sessionKey) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before session execution preparation');
  if (normalizeAddress(smartAccountState.capabilityRegistry) !== CANONICAL_CAPABILITY_REGISTRY_420) {
    throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  }
  const key = normalizeAddress(sessionKey);
  if (key === normalizeAddress(smartAccountState.owner)) throw new Error('owner is not a delegated session signer');
  return key;
}
function assertSafeTarget(target, smartAccountState) {
  const normalized = normalizeAddress(target);
  const denied = new Set([
    smartAccountState.smartAccount,
    smartAccountState.factoryAddress,
    smartAccountState.entryPoint,
    smartAccountState.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
  if (denied.has(normalized)) throw new Error('session execution target cannot be a wallet authority contract');
  return normalized;
}

export function sessionNonceKey(sessionKey) {
  const key = BigInt(normalizeAddress(sessionKey));
  if (key < 0n || key > UINT192_MAX) throw new Error('session nonce key out of uint192 range');
  return key;
}

export async function readSessionNonce(provider, smartAccount, sessionKey) {
  const key = sessionNonceKey(sessionKey);
  const data = `0x${SELECTOR_ACCOUNT_NONCE}${uintWord(key)}`;
  return decodeUint(await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']), 'session nonce');
}

export function encodeSingleSessionCall(sessionKey, target, value = 0n, data = '0x') {
  const signer = normalizeAddress(sessionKey);
  const to = normalizeAddress(target);
  const amount = normalizeNativeValue(value);
  const payload = normalizeCallData(data);
  const tuple = `${addressWord(to)}${uintWord(amount)}${uintWord(96)}${bytesData(payload)}`;
  const array = `${uintWord(1)}${uintWord(32)}${tuple}`;
  return `0x${SELECTOR_EXECUTE_SESSION}${addressWord(signer)}${uintWord(64)}${array}`;
}

export async function prepareSessionExecution(provider, smartAccountState, sessionKey, request = {}) {
  const signer = assertSessionState(smartAccountState, sessionKey);
  const currentEpoch = BigInt(smartAccountState.authorizationEpoch);
  const keyEpoch = await readSessionEpoch(provider, smartAccountState.smartAccount, signer);
  if (keyEpoch !== currentEpoch) throw new Error('session key is not enabled for the current authorization epoch');

  const target = assertSafeTarget(request.target, smartAccountState);
  const value = normalizeNativeValue(request.value ?? 0n);
  const data = normalizeCallData(request.data ?? '0x');
  const selector = `0x${targetSelector(data)}`;
  const tokenAmount = tokenSpend(data);
  if (tokenAmount !== 0n && value !== 0n) throw new Error('session execution cannot combine token spend and native value');
  const spendAmount = tokenAmount !== 0n ? tokenAmount : value;

  const scopeHash = await readSessionScope(provider, smartAccountState.smartAccount, target, selector);
  const activeGrantId = await readActiveGrantId(provider, smartAccountState, signer, SESSION_EXECUTE_CAPABILITY_420, scopeHash);
  if (activeGrantId === ZERO_BYTES32) throw new Error('no active session execution grant exists for this target and selector');
  const inspection = await inspectCapabilityGrant(provider, smartAccountState, activeGrantId);
  if (!inspection.exists || !inspection.belongsToAccount || inspection.grant.revoked) throw new Error('active session execution grant is invalid');
  if (inspection.grant.principal !== signer) throw new Error('active session execution grant principal mismatch');
  if (inspection.grant.capabilityId !== SESSION_EXECUTE_CAPABILITY_420) throw new Error('active grant is not SESSION_EXECUTE');
  if (inspection.grant.scopeHash !== scopeHash) throw new Error('active session execution grant scope mismatch');

  const authorized = await readCapabilityAuthorization(provider, smartAccountState, signer, SESSION_EXECUTE_CAPABILITY_420, scopeHash, spendAmount);
  if (!authorized) throw new Error('session execution exceeds capability limits or validity window');

  const nonce = await readSessionNonce(provider, smartAccountState.smartAccount, signer);
  const expectedKey = sessionNonceKey(signer);
  if ((nonce >> 64n) !== expectedKey) throw new Error('session nonce is not isolated to the session-key nonce lane');

  const callData = encodeSingleSessionCall(signer, target, value, data);
  return {
    signer,
    target,
    value,
    data,
    selector,
    spendAmount,
    scopeHash,
    activeGrantId: normalizeBytes32(activeGrantId),
    grant: inspection,
    authorizationEpoch: currentEpoch,
    nonce,
    nonceKey: expectedKey,
    callData,
    userOperation: {
      sender: normalizeAddress(smartAccountState.smartAccount),
      nonce,
      initCode: '0x',
      callData,
      accountGasLimits: ZERO_BYTES32,
      preVerificationGas: 0n,
      gasFees: ZERO_BYTES32,
      paymasterAndData: '0x',
      signature: '0x',
    },
    broadcastReady: false,
    blockReason: 'production EntryPoint420 submission/hash transport is not frozen',
  };
}

export function assertSessionBroadcastDisabled(prepared) {
  if (prepared?.broadcastReady !== false) throw new Error('unexpected session broadcast readiness state');
  throw new Error('session execution broadcast is disabled until production EntryPoint420 submission and userOp hashing are finalized');
}
