import { normalizeAddress, ZERO_ADDRESS } from './abi.js';

export const RECOVERY_DELAY_SECONDS = 2 * 24 * 60 * 60;

function asUint(value, label) {
  try {
    const parsed = typeof value === 'bigint' ? value : BigInt(value ?? 0);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

export function summarizeRecoveryState(smartAccountState, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!smartAccountState?.deployed) {
    return {
      enabled: false,
      state: 'unavailable',
      reason: 'SmartAccount420 is not deployed',
      pendingOwner: null,
      executableAt: 0n,
      secondsRemaining: null,
    };
  }

  const authority = normalizeAddress(smartAccountState.recoveryAuthority || ZERO_ADDRESS);
  const pendingOwner = normalizeAddress(smartAccountState.pendingRecoveryOwner || ZERO_ADDRESS);
  const executableAt = asUint(smartAccountState.recoveryExecutableAt ?? 0n, 'recoveryExecutableAt');
  const now = asUint(nowSeconds, 'current time');
  const hasAuthority = authority !== ZERO_ADDRESS;
  const hasPending = pendingOwner !== ZERO_ADDRESS;

  if (!hasAuthority) {
    return {
      enabled: false,
      state: 'disabled',
      reason: 'No recovery authority is configured',
      authority,
      pendingOwner: null,
      executableAt: 0n,
      secondsRemaining: null,
    };
  }

  if (!hasPending) {
    return {
      enabled: true,
      state: 'idle',
      authority,
      pendingOwner: null,
      executableAt: 0n,
      secondsRemaining: null,
    };
  }

  if (executableAt === 0n) throw new Error('pending recovery owner exists without executable timestamp');
  const ready = now >= executableAt;
  return {
    enabled: true,
    state: ready ? 'ready' : 'pending',
    authority,
    pendingOwner,
    executableAt,
    secondsRemaining: ready ? 0n : executableAt - now,
  };
}

export function recoveryActionAvailability(smartAccountState, connectedAddress, nowSeconds = Math.floor(Date.now() / 1000)) {
  const summary = summarizeRecoveryState(smartAccountState, nowSeconds);
  const connected = connectedAddress ? normalizeAddress(connectedAddress) : null;
  const owner = smartAccountState?.owner ? normalizeAddress(smartAccountState.owner) : null;
  const authority = smartAccountState?.recoveryAuthority ? normalizeAddress(smartAccountState.recoveryAuthority) : null;

  return {
    summary,
    canSetAuthority: Boolean(smartAccountState?.deployed && connected && owner && connected === owner),
    canPropose: Boolean(summary.enabled && summary.state === 'idle' && connected && authority && connected === authority),
    canCancel: Boolean((summary.state === 'pending' || summary.state === 'ready') && connected && owner && connected === owner),
    canFinalize: Boolean(summary.state === 'ready' && connected && authority && connected === authority),
  };
}
