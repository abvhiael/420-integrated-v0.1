const HOSTILE_SIGNAL_KEYS = Object.freeze(['rooted', 'jailbroken', 'debuggerAttached', 'screenCaptureActive', 'deviceCompromised']);

function normalizeSignals(signals = {}) {
  const normalized = {};
  for (const key of HOSTILE_SIGNAL_KEYS) normalized[key] = Boolean(signals[key]);
  return Object.freeze(normalized);
}

function normalizeLifecycle(state = {}) {
  const phase = state.phase ?? 'active';
  if (!['active', 'background', 'inactive', 'locked'].includes(phase)) throw new Error(`unsupported mobile lifecycle phase: ${phase}`);
  return Object.freeze({ phase, sensitiveView: Boolean(state.sensitiveView), lostDevice: Boolean(state.lostDevice) });
}

export function evaluateMobileHostileState420(input = {}) {
  const signals = normalizeSignals(input.signals);
  const lifecycle = normalizeLifecycle(input.lifecycle);
  const compromiseSignals = [signals.rooted, signals.jailbroken, signals.debuggerAttached, signals.deviceCompromised].filter(Boolean).length;
  const compromised = compromiseSignals > 0;
  const shouldPrivacyShield = lifecycle.phase !== 'active' || lifecycle.sensitiveView || signals.screenCaptureActive;
  const shouldLocalLock = lifecycle.phase === 'locked' || lifecycle.lostDevice || compromised;
  const shouldInvalidateLocalSessionMaterial = lifecycle.lostDevice || signals.deviceCompromised;

  return Object.freeze({
    signals,
    lifecycle,
    compromised,
    riskLevel: lifecycle.lostDevice ? 'critical' : compromised ? 'elevated' : 'normal',
    shouldPrivacyShield,
    shouldLocalLock,
    shouldInvalidateLocalSessionMaterial,
    canonicalAuthorityChanged: false,
    canonicalRevocationRequired: lifecycle.lostDevice,
  });
}

export function assertHostileSignalsNonAuthoritative420(result) {
  if (!result || result.canonicalAuthorityChanged !== false) throw new Error('hostile-state signals must not become canonical authority');
  return true;
}

export async function handleLostDevice420(runtime, handlers = {}) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  if (typeof handlers.invalidateNativeSessionKey === 'function') await handlers.invalidateNativeSessionKey();
  if (typeof handlers.clearLocalPermissions === 'function') await handlers.clearLocalPermissions();
  if (typeof handlers.beginCanonicalRecovery === 'function') await handlers.beginCanonicalRecovery();
  return Object.freeze({ localSessionInvalidated: true, recoveryRequested: typeof handlers.beginCanonicalRecovery === 'function' });
}

export const MOBILE_HOSTILE_SIGNAL_KEYS_420 = HOSTILE_SIGNAL_KEYS;
