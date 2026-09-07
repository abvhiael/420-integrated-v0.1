import { normalizeAddress } from '../../web/core/abi.js';
import { readDeployedSmartAccountState } from '../../web/core/accounts.js';
import { prepareSmartAccountExecution, sendSmartAccountExecution } from '../../web/core/execution.js';
import { recoveryActionAvailability, summarizeRecoveryState } from '../../web/core/recovery.js';
import {
  prepareSetRecoveryAuthority,
  prepareProposeRecovery,
  prepareCancelRecovery,
  prepareFinalizeRecovery,
  sendSetRecoveryAuthority,
  sendProposeRecovery,
  sendCancelRecovery,
  sendFinalizeRecovery,
} from '../../web/core/recovery-management.js';
import { prepareMobilePasskeyExecution420, sendMobilePasskeyExecution420 } from './passkey-auth.js';

function assertRuntime(runtime) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  return runtime;
}

function assertState(state) {
  if (!state?.deployed) throw new Error('deployed SmartAccount420 required');
  if (!state.smartAccount) throw new Error('SmartAccount420 address required');
  return state;
}

export async function readMobileWalletSurface420({ runtime, smartAccount, controller, nowSeconds } = {}) {
  assertRuntime(runtime);
  const account = normalizeAddress(smartAccount);
  const state = await readDeployedSmartAccountState(runtime, account, controller ? { controller } : {});
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
  return prepareSmartAccountExecution(runtime, controller, state, request);
}

export async function sendMobileExecution420({ runtime, mode = 'owner', controller, smartAccountState, request, prepared, transactionSender } = {}) {
  assertRuntime(runtime);
  if (mode === 'passkey') return sendMobilePasskeyExecution420({ runtime, prepared, transactionSender });
  if (mode !== 'owner') throw new Error(`unsupported mobile execution mode: ${mode}`);
  assertState(smartAccountState);
  if (!controller) throw new Error('owner controller required');
  return sendSmartAccountExecution(runtime, controller, smartAccountState, request);
}

export async function prepareMobileRecoveryAction420({ runtime, action, actor, smartAccountState, value, nowSeconds } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  if (!actor) throw new Error('recovery actor required');

  switch (action) {
    case 'setRecoveryAuthority':
      return prepareSetRecoveryAuthority(runtime, actor, state, value);
    case 'proposeRecovery':
      return prepareProposeRecovery(runtime, actor, state, value);
    case 'cancelRecovery':
      return prepareCancelRecovery(runtime, actor, state);
    case 'finalizeRecovery':
      return prepareFinalizeRecovery(runtime, actor, state, nowSeconds);
    default:
      throw new Error(`unsupported mobile recovery action: ${action}`);
  }
}

export async function sendMobileRecoveryAction420({ runtime, action, actor, smartAccountState, value, nowSeconds } = {}) {
  assertRuntime(runtime);
  const state = assertState(smartAccountState);
  if (!actor) throw new Error('recovery actor required');

  switch (action) {
    case 'setRecoveryAuthority':
      return sendSetRecoveryAuthority(runtime, actor, state, value);
    case 'proposeRecovery':
      return sendProposeRecovery(runtime, actor, state, value);
    case 'cancelRecovery':
      return sendCancelRecovery(runtime, actor, state);
    case 'finalizeRecovery':
      return sendFinalizeRecovery(runtime, actor, state, nowSeconds);
    default:
      throw new Error(`unsupported mobile recovery action: ${action}`);
  }
}
