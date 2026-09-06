import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePasskeyExecutionUiState } from '../passkey-execution-ui.js';

test('passkey execution requires runtime enablement, deployed account and usable device', () => {
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: false, deployed: true, deviceSummary: { usable: true, status: 'ready' } }).canSign, false);
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: true, deployed: false, deviceSummary: { usable: true, status: 'ready' } }).canSign, false);
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: true, deployed: true, deviceSummary: { usable: false, status: 'authorization-epoch-stale' } }).canSign, false);
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: true, deployed: true, deviceSummary: { usable: true, status: 'ready' } }).canSign, true);
});

test('execution UX surfaces stale and revoked devices distinctly', () => {
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: true, deployed: true, deviceSummary: { usable: false, status: 'authorization-epoch-stale' } }).stateLabel, 'Device stale');
  assert.equal(derivePasskeyExecutionUiState({ runtimeEnabled: true, deployed: true, deviceSummary: { usable: false, status: 'device-revoked' } }).stateLabel, 'Device revoked');
});
