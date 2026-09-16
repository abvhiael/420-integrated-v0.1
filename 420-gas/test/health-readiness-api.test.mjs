import assert from 'node:assert/strict';
import test from 'node:test';
import { createGasHealthReadinessProjection420, GasHealthReadinessError420 } from '../src/health-readiness-api.mjs';

function baseInputs() {
  return {
    readiness: { state: 'ready', sponsor: 'ready', detailCode: 'deposit_ready', account: '0xsecret', signature: 'secret' },
    recovery: { state: 'healthy', sponsorshipAvailable: true, components: { signer: { reasonCode: 'private-detail' } } },
    settlementSummary: { entries: 4, finalizedCount: 4, discrepancyCount: 0, observedActualCostWei: 999n },
    observedAt: '2026-09-15T22:30:00Z',
  };
}

test('GAS-10.5 returns a stable redacted healthy projection', () => {
  const status = createGasHealthReadinessProjection420(baseInputs());
  assert.equal(status.state, 'ready');
  assert.equal(status.reasonCode, 'healthy');
  assert.equal(status.sponsorshipAvailable, true);
  assert.deepEqual(status.settlement, { retainedEntries: 4, finalizedEntries: 4, discrepancyCount: 0 });
  assert.equal(status.authority, 'status-projection-only');
  assert.equal(status.executionAuthorization, false);
  assert.equal(status.sponsorshipAuthorization, false);
  assert.equal(status.settlementAuthority, false);
  assert.equal(status.accountingAuthority, false);
  assert.equal(status.canonicalProtocolAuthority, false);
  assert.equal('account' in status, false);
  assert.equal('signature' in status, false);
  assert.equal('components' in status, false);
  assert.equal('observedActualCostWei' in status.settlement, false);
});

test('GAS-10.5 degrades on settlement discrepancy without treating projection as settlement truth', () => {
  const input = baseInputs();
  input.settlementSummary = { entries: 3, finalizedCount: 2, discrepancyCount: 1 };
  const status = createGasHealthReadinessProjection420(input);
  assert.equal(status.state, 'degraded');
  assert.equal(status.reasonCode, 'settlement_discrepancy_observed');
  assert.equal(status.sponsorshipAvailable, true);
  assert.equal(status.settlementAuthority, false);
  assert.equal(status.accountingAuthority, false);
});

test('GAS-10.5 fails readiness closed for unavailable or recovering components', () => {
  for (const recoveryState of ['unavailable', 'recovering']) {
    const input = baseInputs();
    input.recovery = { state: recoveryState, sponsorshipAvailable: false };
    const status = createGasHealthReadinessProjection420(input);
    assert.equal(status.state, 'not-ready');
    assert.equal(status.sponsorshipAvailable, false);
    assert.equal(status.reasonCode, recoveryState === 'unavailable' ? 'component_unavailable' : 'component_recovering');
  }
});

test('GAS-10.5 preserves stable funding reason codes for degraded and not-ready states', () => {
  const degraded = baseInputs();
  degraded.readiness = { state: 'degraded', sponsor: 'low', detailCode: 'deposit_low' };
  const degradedStatus = createGasHealthReadinessProjection420(degraded);
  assert.equal(degradedStatus.state, 'degraded');
  assert.equal(degradedStatus.reasonCode, 'deposit_low');

  const blocked = baseInputs();
  blocked.readiness = { state: 'not-ready', sponsor: 'unavailable', detailCode: 'reservation_exceeds_deposit' };
  const blockedStatus = createGasHealthReadinessProjection420(blocked);
  assert.equal(blockedStatus.state, 'not-ready');
  assert.equal(blockedStatus.reasonCode, 'reservation_exceeds_deposit');
  assert.equal(blockedStatus.sponsorshipAvailable, false);
});

test('GAS-10.5 rejects arbitrary reason strings and inconsistent settlement counts', () => {
  const badReason = baseInputs();
  badReason.readiness = { state: 'degraded', sponsor: 'low', detailCode: 'account_0xsecret' };
  assert.throws(() => createGasHealthReadinessProjection420(badReason), /GAS10_HEALTH_READINESS_REASON_INVALID/);

  const badCounts = baseInputs();
  badCounts.settlementSummary = { entries: 1, finalizedCount: 2, discrepancyCount: 0 };
  assert.throws(() => createGasHealthReadinessProjection420(badCounts), GasHealthReadinessError420);
});
