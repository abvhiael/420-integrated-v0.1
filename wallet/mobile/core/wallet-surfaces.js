import { normalizeAddress } from '../../web/core/abi.js';
import { readDeployedSmartAccountState } from '../../web/core/accounts.js';
import { prepareSmartAccountExecution } from '../../web/core/execution.js';
import { recoveryActionAvailability, summarizeRecoveryState } from '../../web/core/recovery.js';
import {
  prepareSetRecoveryAuthority,
  prepareProposeRecovery,
  prepareCancelRecovery,
  prepareFinalizeRecovery,
} from '../../web/core/recovery-management.js';
import { prepareMobilePasskeyExecution420, sendMobilePasskeyExecution420 } from './passkey-auth.js';
import { createMobileProvider420 } from './runtime-adapter.js';

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

export async function readMobileWalletSurface420({ runtime, smartAccount, controller, nowSeconds } = {}) {
  assertRuntime(runtime);
  const provider = createMobileProvider420(runtime);
  const account = normalizeAddress(smartAccount);
  const state = await readDeployedSmartAccountState(provider, account, controller ? { controller } : {});
  const recovery = summarizeRecoveryState(state, nowSeconds);
  const actions = recoveryActionAvailability(state, controller ?? null, nowSeconds);
  return Object.freeze({
    smartAccount: account,
    owner: state.owner,
    controllerIsOwner: Boolean(state.controllerIsOwner),
    authorizationEpoch: BigInt(state.authorizationEpoch ?? 0n),
    recovery,
    actions,
    state,
  });
}

export async function prepareMobileExecution420({
  runtime,
  mode = 'owner',
  controller,
  smartAccountState,
  request,
  binding,
  rpId,
  origin,
  timeout,
} = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);

  if (mode === 'passkey') {
    return prepareMobilePasskeyExecution420({ runtime, smartAccountState: state, binding, request, rpId, origin, timeout });
  }
  if (mode !== 'owner') throw new Error(`unsupported mobile execution mode: ${mode}`);
  if (!controller) throw new Error('owner controller required');
  return prepareSmartAccountExecution(createMobileProvider420(runtime), controller, state, request);
}

export async function sendMobileExecution420({ runtime, mode = 'owner', controller, smartAccountState, request, prepared } = {}) {
  assertRuntime(runtime);
  if (mode === 'passkey') return sendMobilePasskeyExecution420({ runtime, prepared });
  if (mode !== 'owner') throw new Error(`unsupported mobile execution mode: ${mode}`);
  const state = assertState(smartAccountState);
  if (!controller) throw new Error('owner controller required');
  const fresh = await prepareSmartAccountExecution(createMobileProvider420(runtime), controller, state, request);
  const txHash = normalizeTxHash(await assertNativeSubmit(runtime)(fresh.transaction));
  return Object.freeze({ ...fresh, submitted: true, txHash, nativeSubmitted: true });
}

export async function prepareMobileRecoveryAction420({ runtime, action, actor, smartAccountState, value, nowSeconds } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  if (!actor) throw new Error('recovery actor required');
  const provider = createMobileProvider420(runtime);

  switch (action) {
    case 'setRecoveryAuthority':
      return prepareSetRecoveryAuthority(provider, actor, state, value);
    case 'proposeRecovery':
      return prepareProposeRecovery(provider, actor, state, value);
    case 'cancelRecovery':
      return prepareCancelRecovery(provider, actor, state);
    case 'finalizeRecovery':
      return prepareFinalizeRecovery(provider, actor, state, nowSeconds);
    default:
      throw new Error(`unsupported mobile recovery action: ${action}`);
  }
}

export async function sendMobileRecoveryAction420({ runtime, action, actor, smartAccountState, value, nowSeconds } = {}) {
  assertRuntime(runtime);
  const prepared = await prepareMobileRecoveryAction420({ runtime, action, actor, smartAccountState, value, nowSeconds });
  if (!prepared?.transaction) throw new Error('qualified mobile recovery transaction required');
  const txHash = normalizeTxHash(await assertNativeSubmit(runtime)(prepared.transaction));
  return Object.freeze({ ...prepared, submitted: true, txHash, nativeSubmitted: true });
}
