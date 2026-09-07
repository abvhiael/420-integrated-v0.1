import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMobileHostileState420, assertHostileSignalsNonAuthoritative420, handleLostDevice420 } from '../core/hostile-state-policy.js';

test('root jailbreak and debugger signals raise risk but never become canonical authority', () => {
  for (const signals of [{ rooted: true }, { jailbroken: true }, { debuggerAttached: true }]) {
    const result = evaluateMobileHostileState420({ signals, lifecycle: { phase: 'active' } });
    assert.equal(result.compromised, true);
    assert.equal(result.shouldLocalLock, true);
    assert.equal(result.canonicalAuthorityChanged, false);
    assert.equal(result.canonicalRevocationRequired, false);
    assert.equal(assertHostileSignalsNonAuthoritative420(result), true);
  }
});

test('background sensitive and captured states enable privacy shield', () => {
  assert.equal(evaluateMobileHostileState420({ lifecycle: { phase: 'background' } }).shouldPrivacyShield, true);
  assert.equal(evaluateMobileHostileState420({ lifecycle: { phase: 'active', sensitiveView: true } }).shouldPrivacyShield, true);
  assert.equal(evaluateMobileHostileState420({ signals: { screenCaptureActive: true }, lifecycle: { phase: 'active' } }).shouldPrivacyShield, true);
});

test('lost device requires local session invalidation and canonical recovery path', async () => {
  const result = evaluateMobileHostileState420({ lifecycle: { phase: 'active', lostDevice: true } });
  assert.equal(result.riskLevel, 'critical');
  assert.equal(result.shouldLocalLock, true);
  assert.equal(result.shouldInvalidateLocalSessionMaterial, true);
  assert.equal(result.canonicalRevocationRequired, true);

  const calls = [];
  const handled = await handleLostDevice420({ secureStorage: {} }, {
    invalidateNativeSessionKey: async () => calls.push('session'),
    clearLocalPermissions: async () => calls.push('permissions'),
    beginCanonicalRecovery: async () => calls.push('recovery'),
  });
  assert.deepEqual(calls, ['session', 'permissions', 'recovery']);
  assert.equal(handled.localSessionInvalidated, true);
  assert.equal(handled.recoveryRequested, true);
});
