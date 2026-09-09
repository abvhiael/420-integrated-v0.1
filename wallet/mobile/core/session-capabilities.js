import { normalizeAddress, normalizeBytes32 } from '../../web/core/abi.js';
import { createMobileProvider420 } from './runtime-adapter.js';
import {
  readSessionEpoch,
  readSessionScope,
  prepareSessionKeyEnablement,
  prepareSessionKeyRevocation,
  prepareSessionGrantCreation,
} from '../../web/core/session-management.js';
import { inspectCapabilityGrant } from '../../web/core/capabilities.js';
import { prepareCapabilityGrantRevocation } from '../../web/core/capability-management.js';
import {
  prepareNativeMobileSessionTransport420,
  sendNativeMobileSessionTransport420,
  assertNativeMobileSessionGrant420,
} from './native-session-transport.js';

function assertRuntime(runtime) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  return runtime;
}

function assertNativeSubmit(runtime) {
  assertRuntime(runtime);
  if (typeof runtime.transaction?.submit !== 'function') throw new Error('native transaction submission capability required');
  return runtime.transaction.submit;
}

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

function assertState(state) {
  if (!state?.deployed) throw new Error('deployed SmartAccount420 required');
  if (!state.smartAccount) throw new Error('SmartAccount420 address required');
  return state;
}

function assertOwner(controller, state) {
  const normalized = normalizeAddress(controller);
  if (!state.controllerIsOwner || normalizeAddress(state.owner) !== normalized) {
    throw new Error('mobile controller is not the on-chain SmartAccount420 owner');
  }
  return normalized;
}

export function summarizeMobileGrant420(inspection, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!inspection?.exists || !inspection?.belongsToAccount) {
    return Object.freeze({ exists: false, active: false, state: 'unavailable', secondsRemaining: null });
  }
  const grant = inspection.grant;
  const now = BigInt(nowSeconds);
  const validFrom = BigInt(grant.validFrom ?? 0n);
  const validUntil = BigInt(grant.validUntil ?? 0n);
  let state = 'active';
  if (grant.revoked) state = 'revoked';
  else if (validFrom !== 0n && now < validFrom) state = 'scheduled';
  else if (validUntil !== 0n && now >= validUntil) state = 'expired';
  const secondsRemaining = validUntil !== 0n && now < validUntil ? validUntil - now : null;
  return Object.freeze({
    exists: true,
    active: state === 'active',
    state,
    principal: normalizeAddress(grant.principal),
    capabilityId: normalizeBytes32(grant.capabilityId),
    scopeHash: normalizeBytes32(grant.scopeHash),
    perCallLimit: BigInt(grant.perCallLimit ?? 0n),
    periodLimit: BigInt(grant.periodLimit ?? 0n),
    periodSeconds: BigInt(grant.periodSeconds ?? 0n),
    validFrom,
    validUntil,
    secondsRemaining,
    usage: inspection.usage ? Object.freeze({ periodIndex: BigInt(inspection.usage.periodIndex ?? 0n), used: BigInt(inspection.usage.used ?? 0n) }) : null,
  });
}

export async function readMobileSessionSurface420({ runtime, smartAccountState, controller, sessionKey, grantId, target, selector, nowSeconds } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  const provider = createMobileProvider420(runtime);
  const key = normalizeAddress(sessionKey);
  const currentEpoch = BigInt(state.authorizationEpoch ?? 0n);
  const keyEpoch = await readSessionEpoch(provider, state.smartAccount, key);
  let scopeHash = null;
  if (target && selector) scopeHash = await readSessionScope(provider, state.smartAccount, target, selector);
  let grant = null;
  if (grantId) grant = summarizeMobileGrant420(await inspectCapabilityGrant(provider, state, grantId), nowSeconds);
  const isOwner = Boolean(controller && state.controllerIsOwner && normalizeAddress(controller) === normalizeAddress(state.owner));
  return Object.freeze({
    sessionKey: key,
    currentEpoch,
    keyEpoch,
    enabled: keyEpoch === currentEpoch && currentEpoch !== 0n,
    scopeHash,
    grant,
    canAdminister: isOwner,
  });
}

export async function prepareMobileSessionAdmin420({ runtime, action, controller, smartAccountState, sessionKey, grantRequest, grantId } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  assertOwner(controller, state);
  const provider = createMobileProvider420(runtime);
  switch (action) {
    case 'enableSessionKey': return prepareSessionKeyEnablement(provider, controller, state, sessionKey);
    case 'revokeSessionKey': return prepareSessionKeyRevocation(provider, controller, state, sessionKey);
    case 'createSessionGrant': return prepareSessionGrantCreation(provider, controller, state, grantRequest);
    case 'revokeCapabilityGrant': return prepareCapabilityGrantRevocation(provider, controller, state, grantId);
    default: throw new Error(`unsupported mobile session admin action: ${action}`);
  }
}

export async function sendMobileSessionAdmin420(args = {}) {
  const { runtime } = args;
  const prepared = await prepareMobileSessionAdmin420(args);
  if (!prepared?.transaction) throw new Error('qualified mobile session admin transaction required');
  const txHash = normalizeTxHash(await assertNativeSubmit(runtime)(prepared.transaction));
  return Object.freeze({ ...prepared, submitted: true, txHash, nativeSubmitted: true });
}

export async function prepareMobileSessionExecution420({ runtime, smartAccountState, sessionKey, request } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  const provider = createMobileProvider420(runtime);
  const prepared = await prepareNativeMobileSessionTransport420({ runtime, provider, smartAccountState: state, sessionKey, request });
  if (!prepared.broadcastReady || !prepared.entryPointSimulation?.simulationPassed) {
    throw new Error('mobile session execution did not qualify for broadcast');
  }
  return assertNativeMobileSessionGrant420(prepared);
}

export async function sendMobileSessionExecution420({ runtime, prepared } = {}) {
  assertRuntime(runtime);
  if (!prepared?.broadcastReady) throw new Error('prepared mobile session execution required');
  return sendNativeMobileSessionTransport420({ runtime, provider: createMobileProvider420(runtime), prepared });
}
