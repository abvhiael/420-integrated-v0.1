import assert from 'node:assert/strict';
import test from 'node:test';
import { GasRecoveryError420, GasRecoveryState420 } from '../src/recovery-state.mjs';

test('GAS-10.4 tracks signer, funding and settlement-observer degraded states without authority', () => {
  const recovery = new GasRecoveryState420({ maxTransitions: 4 });
  recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'signer_latency', observedAt: '2026-09-15T22:00:00Z' });
  recovery.transition({ component: 'funding', state: 'healthy', reasonCode: 'deposit_ready', observedAt: '2026-09-15T22:00:01Z' });
  const snapshot = recovery.snapshot();
  assert.equal(snapshot.state, 'degraded');
  assert.equal(snapshot.sponsorshipAvailable, true);
  assert.equal(snapshot.authority, 'operational-guidance-only');
  assert.equal(snapshot.executionAuthorization, false);
  assert.equal(snapshot.sponsorshipAuthorization, false);
  assert.equal(snapshot.settlementAuthority, false);
  assert.equal(snapshot.accountingAuthority, false);
  assert.equal(snapshot.canonicalProtocolAuthority, false);
});

test('GAS-10.4 unavailable or recovering components fail sponsorship guidance closed', () => {
  const unavailable = new GasRecoveryState420();
  unavailable.transition({ component: 'funding', state: 'unavailable', reasonCode: 'deposit_unavailable', observedAt: '2026-09-15T22:10:00Z' });
  assert.equal(unavailable.snapshot().state, 'unavailable');
  assert.equal(unavailable.snapshot().sponsorshipAvailable, false);

  const recovering = new GasRecoveryState420();
  recovering.transition({ component: 'signer', state: 'recovering', reasonCode: 'signer_recovering', observedAt: '2026-09-15T22:10:00Z' });
  assert.equal(recovering.snapshot().state, 'recovering');
  assert.equal(recovering.snapshot().sponsorshipAvailable, false);
});

test('GAS-10.4 explicit healthy recovery restores operational guidance only', () => {
  const recovery = new GasRecoveryState420();
  recovery.transition({ component: 'signer', state: 'unavailable', reasonCode: 'signer_down', observedAt: '2026-09-15T22:20:00Z' });
  recovery.transition({ component: 'signer', state: 'recovering', reasonCode: 'signer_recovering', observedAt: '2026-09-15T22:21:00Z' });
  recovery.markHealthy('signer', '2026-09-15T22:22:00Z');
  const snapshot = recovery.snapshot();
  assert.equal(snapshot.state, 'healthy');
  assert.equal(snapshot.sponsorshipAvailable, true);
  assert.equal(snapshot.sponsorshipAuthorization, false);
});

test('GAS-10.4 bounds transition history and suppresses duplicate state churn', () => {
  const recovery = new GasRecoveryState420({ maxTransitions: 2 });
  const first = recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'latency', observedAt: '2026-09-15T22:30:00Z' });
  const duplicate = recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'latency', observedAt: '2026-09-15T22:30:01Z' });
  assert.equal(first.changed, true);
  assert.equal(duplicate.changed, false);
  recovery.transition({ component: 'funding', state: 'degraded', reasonCode: 'deposit_low', observedAt: '2026-09-15T22:30:02Z' });
  recovery.transition({ component: 'settlement-observer', state: 'degraded', reasonCode: 'observer_lag', observedAt: '2026-09-15T22:30:03Z' });
  const history = recovery.history();
  assert.equal(history.length, 2);
  assert.equal(history[0].component, 'funding');
  assert.equal(history[1].component, 'settlement-observer');
});

test('GAS-10.4 rejects unbounded or malformed recovery data', () => {
  assert.throws(() => new GasRecoveryState420({ maxTransitions: 0 }), GasRecoveryError420);
  const recovery = new GasRecoveryState420();
  assert.throws(() => recovery.transition({ component: 'wallet', state: 'degraded', reasonCode: 'bad', observedAt: '2026-09-15T22:40:00Z' }), /GAS10_RECOVERY_COMPONENT_INVALID/);
  assert.throws(() => recovery.transition({ component: 'signer', state: 'failed', reasonCode: 'bad', observedAt: '2026-09-15T22:40:00Z' }), /GAS10_RECOVERY_STATE_INVALID/);
  assert.throws(() => recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'account=0xsecret', observedAt: '2026-09-15T22:40:00Z' }), /GAS10_RECOVERY_REASON_INVALID/);
  assert.throws(() => recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'latency', observedAt: 'bad-time' }), /GAS10_RECOVERY_TIME_INVALID/);
});
