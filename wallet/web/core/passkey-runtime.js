import { ZERO_ADDRESS } from './abi.js';

export function passkeyRuntimeState(config, smartAccountState, binding = null, navigatorLike = globalThis.navigator) {
  if (config?.features?.passkeys !== true) return { enabled: false, reason: 'Passkeys are disabled by runtime policy', canEnroll: false, canReenroll: false, canExecute: false };
  if (!navigatorLike?.credentials || typeof navigatorLike.credentials.create !== 'function' || typeof navigatorLike.credentials.get !== 'function') {
    return { enabled: false, reason: 'This browser does not expose WebAuthn credentials.create/get', canEnroll: false, canReenroll: false, canExecute: false };
  }
  if (!smartAccountState?.deployed) return { enabled: true, reason: 'Deploy SmartAccount420 before enabling a passkey', canEnroll: false, canReenroll: false, canExecute: false };
  if (!smartAccountState.controllerIsOwner) return { enabled: true, reason: 'Connected controller is not the current SmartAccount420 owner', canEnroll: false, canReenroll: false, canExecute: false };
  const pending = (smartAccountState.pendingRecoveryOwner || ZERO_ADDRESS).toLowerCase();
  if (pending !== ZERO_ADDRESS) return { enabled: true, reason: 'Passkeys are blocked while recovery is pending', canEnroll: false, canReenroll: false, canExecute: false };
  if (!binding) return { enabled: true, reason: 'No passkey is bound in this browser session', canEnroll: true, canReenroll: false, canExecute: false };
  const currentEpoch = BigInt(smartAccountState.authorizationEpoch);
  const boundEpoch = BigInt(binding.authorizationEpoch);
  if (boundEpoch !== currentEpoch) return { enabled: true, reason: 'Passkey binding is stale after an authorization epoch change', canEnroll: false, canReenroll: true, canExecute: false };
  return { enabled: true, reason: 'Passkey is active for the current authorization epoch', canEnroll: false, canReenroll: false, canExecute: true };
}
