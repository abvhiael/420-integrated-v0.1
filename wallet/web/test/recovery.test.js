import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS } from '../core/abi.js';
import { RECOVERY_DELAY_SECONDS, recoveryActionAvailability, summarizeRecoveryState } from '../core/recovery.js';

const owner = '0x1111111111111111111111111111111111111111';
const authority = '0x2222222222222222222222222222222222222222';
const pending = '0x3333333333333333333333333333333333333333';
const base = {
  deployed: true,
  owner,
  recoveryAuthority: authority,
  pendingRecoveryOwner: ZERO_ADDRESS,
  recoveryExecutableAt: 0n,
};

test('recovery delay constant matches SmartAccount420 two-day delay', () => {
  assert.equal(RECOVERY_DELAY_SECONDS, 172800);
});

test('recovery summary distinguishes disabled, idle, pending and ready states', () => {
  assert.equal(summarizeRecoveryState({ ...base, recoveryAuthority: ZERO_ADDRESS }, 1000).state, 'disabled');
  assert.equal(summarizeRecoveryState(base, 1000).state, 'idle');

  const pendingState = summarizeRecoveryState({ ...base, pendingRecoveryOwner: pending, recoveryExecutableAt: 1100n }, 1000);
  assert.equal(pendingState.state, 'pending');
  assert.equal(pendingState.secondsRemaining, 100n);

  const readyState = summarizeRecoveryState({ ...base, pendingRecoveryOwner: pending, recoveryExecutableAt: 1100n }, 1200);
  assert.equal(readyState.state, 'ready');
  assert.equal(readyState.secondsRemaining, 0n);
});

test('pending recovery without executable timestamp fails closed', () => {
  assert.throws(() => summarizeRecoveryState({ ...base, pendingRecoveryOwner: pending, recoveryExecutableAt: 0n }, 1000), /without executable timestamp/i);
});

test('recovery actions are strictly separated between owner and recovery authority', () => {
  const idleOwner = recoveryActionAvailability(base, owner, 1000);
  assert.equal(idleOwner.canSetAuthority, true);
  assert.equal(idleOwner.canPropose, false);

  const idleAuthority = recoveryActionAvailability(base, authority, 1000);
  assert.equal(idleAuthority.canPropose, true);
  assert.equal(idleAuthority.canSetAuthority, false);

  const pendingState = { ...base, pendingRecoveryOwner: pending, recoveryExecutableAt: 1100n };
  const pendingOwner = recoveryActionAvailability(pendingState, owner, 1000);
  assert.equal(pendingOwner.canCancel, true);
  assert.equal(pendingOwner.canFinalize, false);

  const readyAuthority = recoveryActionAvailability(pendingState, authority, 1200);
  assert.equal(readyAuthority.canFinalize, true);
  assert.equal(readyAuthority.canCancel, false);
});
