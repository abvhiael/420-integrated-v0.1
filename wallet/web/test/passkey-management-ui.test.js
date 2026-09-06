import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePasskeyUiState } from '../passkey-management-ui.js';

test('enrollment remains disabled until runtime policy, ownership and verifier are all ready', () => {
  assert.equal(derivePasskeyUiState({ runtimeEnabled: false, owner: true, verifierConfigured: true }).canEnroll, false);
  assert.equal(derivePasskeyUiState({ runtimeEnabled: true, owner: false, verifierConfigured: true }).canEnroll, false);
  assert.equal(derivePasskeyUiState({ runtimeEnabled: true, owner: true, verifierConfigured: false }).canEnroll, false);
  assert.equal(derivePasskeyUiState({ runtimeEnabled: true, owner: true, verifierConfigured: true }).canEnroll, true);
});

test('stale device is surfaced as stale and may be owner-revoked even with runtime enrollment disabled', () => {
  const model = derivePasskeyUiState({
    runtimeEnabled: false,
    owner: true,
    verifierConfigured: true,
    deviceSummary: { credentialId: 'credential', usable: false, status: 'authorization-epoch-stale' },
  });
  assert.equal(model.stateLabel, 'Stale');
  assert.equal(model.canEnroll, false);
  assert.equal(model.canRevoke, true);
  assert.equal(model.enrollmentLabel, 'Replace passkey');
});

test('revoked local device cannot trigger another revoke', () => {
  const model = derivePasskeyUiState({
    runtimeEnabled: true,
    owner: true,
    verifierConfigured: true,
    deviceSummary: { credentialId: 'credential', usable: false, status: 'device-revoked' },
  });
  assert.equal(model.stateLabel, 'Revoked');
  assert.equal(model.canRevoke, false);
  assert.equal(model.enrollmentLabel, 'Add passkey');
});
