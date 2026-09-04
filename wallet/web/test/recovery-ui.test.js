import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecoveryUiModel, formatRecoveryCountdown } from '../recovery-ui.js';

const owner = '0x1111111111111111111111111111111111111111';
const authority = '0x2222222222222222222222222222222222222222';
const pending = '0x3333333333333333333333333333333333333333';

function state(overrides = {}) {
  return {
    deployed: true,
    smartAccount: '0x4444444444444444444444444444444444444444',
    owner,
    recoveryAuthority: authority,
    pendingRecoveryOwner: '0x0000000000000000000000000000000000000000',
    recoveryExecutableAt: 0n,
    authorizationEpoch: 7n,
    ...overrides,
  };
}

test('recovery countdown formats the two-day safety window clearly', () => {
  assert.equal(formatRecoveryCountdown(172800n), '2d 0h 0m 0s');
  assert.equal(formatRecoveryCountdown(3661n), '1h 1m 1s');
  assert.equal(formatRecoveryCountdown(0n), 'Ready now');
});

test('owner sees authority and cancellation controls while recovery authority sees propose/finalize controls', () => {
  const idleOwner = buildRecoveryUiModel(state(), owner, 1000);
  assert.equal(idleOwner.canSetAuthority, true);
  assert.equal(idleOwner.canPropose, false);

  const idleAuthority = buildRecoveryUiModel(state(), authority, 1000);
  assert.equal(idleAuthority.canPropose, true);
  assert.equal(idleAuthority.canSetAuthority, false);

  const pendingState = state({ pendingRecoveryOwner: pending, recoveryExecutableAt: 2000n });
  const pendingOwner = buildRecoveryUiModel(pendingState, owner, 1500);
  assert.equal(pendingOwner.stateLabel, 'Timelock active');
  assert.equal(pendingOwner.countdown, '8m 20s');
  assert.equal(pendingOwner.canCancel, true);
  assert.equal(pendingOwner.canFinalize, false);

  const readyAuthority = buildRecoveryUiModel(pendingState, authority, 2000);
  assert.equal(readyAuthority.stateLabel, 'Ready to finalize');
  assert.equal(readyAuthority.countdown, 'Ready now');
  assert.equal(readyAuthority.canFinalize, true);
});
