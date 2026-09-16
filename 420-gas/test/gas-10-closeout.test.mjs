import assert from 'node:assert/strict';
import test from 'node:test';
import { GasMetrics420 } from '../src/observability.mjs';
import { evaluateGasSponsorReadiness420 } from '../src/readiness.mjs';
import { GasSettlementJournal420 } from '../src/settlement-journal.mjs';
import { GasRecoveryState420 } from '../src/recovery-state.mjs';
import { createGasHealthReadinessProjection420 } from '../src/health-readiness-api.mjs';

const T0 = '2026-09-15T22:00:00Z';

function settlementCommitment420(n) {
  return `0x${n.toString(16).padStart(64, '0')}`;
}

test('GAS-10.6 rejects attacker-controlled telemetry dimensions and secret-shaped values', () => {
  const metrics = new GasMetrics420({ maxSeries: 4 });
  assert.throws(() => metrics.increment('quotes_requested_total', { account: '0xdeadbeef' }), /GAS10_LABEL_KEY_INVALID/);
  assert.throws(() => metrics.increment('quotes_requested_total', { source: 'wallet/0xsecret' }), /GAS10_LABEL_VALUE_INVALID/);
  assert.throws(() => metrics.increment('quotes_requested_total', { source: 'wallet', reason: 'quota', result: 'denied' }), /GAS10_LABEL_CARDINALITY_EXCEEDED/);
  assert.equal(metrics.snapshot().length, 0);
});

test('GAS-10.6 fails sponsor readiness closed when reservations exceed observed deposit', () => {
  const readiness = evaluateGasSponsorReadiness420({
    depositWei: '100',
    reservedWei: '101',
    observedAt: T0,
    thresholds: { minReadyAvailableWei: '50', minDegradedAvailableWei: '10' },
  });
  assert.equal(readiness.state, 'not-ready');
  assert.equal(readiness.sponsor, 'unavailable');
  assert.equal(readiness.availableWei, '0');
  assert.equal(readiness.detailCode, 'reservation_exceeds_deposit');
  assert.equal(readiness.sponsorshipAuthorization, false);
  assert.equal(readiness.settlementAuthority, false);
});

test('GAS-10.6 settlement journal remains bounded, rejects replay, and never gains accounting authority', () => {
  const journal = new GasSettlementJournal420({ maxEntries: 2 });
  journal.append({ settlementCommitment: settlementCommitment420(1), reservedWei: '100', actualCostWei: '80', outcome: 'success', confirmation: 'finalized', observedAt: T0 });
  journal.append({ settlementCommitment: settlementCommitment420(2), reservedWei: '100', actualCostWei: '150', outcome: 'reverted', confirmation: 'observed', observedAt: T0 });
  assert.throws(() => journal.append({ settlementCommitment: settlementCommitment420(2), reservedWei: '100', actualCostWei: '90', observedAt: T0 }), /GAS10_SETTLEMENT_DUPLICATE/);
  journal.append({ settlementCommitment: settlementCommitment420(3), reservedWei: '100', actualCostWei: '90', outcome: 'success', confirmation: 'finalized', observedAt: T0 });

  assert.equal(journal.snapshot().length, 2);
  assert.equal(journal.get(settlementCommitment420(1)), null);
  const summary = journal.summary();
  assert.equal(summary.discrepancyCount, 1);
  assert.equal(summary.accountingAuthority, false);
  assert.equal(summary.settlementAuthority, false);
});

test('GAS-10.6 recovery churn is bounded and unavailable/recovering states fail sponsorship guidance closed', () => {
  const recovery = new GasRecoveryState420({ maxTransitions: 3 });
  recovery.transition({ component: 'signer', state: 'unavailable', reasonCode: 'signer_down', observedAt: T0 });
  assert.equal(recovery.snapshot().sponsorshipAvailable, false);
  recovery.transition({ component: 'signer', state: 'recovering', reasonCode: 'signer_probe', observedAt: T0 });
  assert.equal(recovery.snapshot().sponsorshipAvailable, false);
  recovery.markHealthy('signer', T0);
  recovery.transition({ component: 'funding', state: 'degraded', reasonCode: 'funding_low', observedAt: T0 });
  assert.equal(recovery.history().length, 3);
  assert.equal(recovery.snapshot().state, 'degraded');

  const before = recovery.history().length;
  const duplicate = recovery.transition({ component: 'funding', state: 'degraded', reasonCode: 'funding_low', observedAt: T0 });
  assert.equal(duplicate.changed, false);
  assert.equal(recovery.history().length, before);
});

test('GAS-10.6 health projection applies fail-closed precedence and redacts raw operational internals', () => {
  const projection = createGasHealthReadinessProjection420({
    readiness: {
      state: 'ready',
      sponsor: 'ready',
      detailCode: 'deposit_ready',
      depositWei: '999999999999999999999999',
      reservedWei: '1',
      account: '0xsecret',
      signature: '0xsignature',
    },
    recovery: {
      state: 'unavailable',
      sponsorshipAvailable: false,
      components: { signer: { reasonCode: 'private_detail' } },
      history: [{ reasonCode: 'secret' }],
    },
    settlementSummary: {
      entries: 4,
      finalizedCount: 4,
      discrepancyCount: 1,
      observedReservedWei: 123456789n,
      observedActualCostWei: 987654321n,
    },
    observedAt: T0,
  });

  assert.equal(projection.state, 'not-ready');
  assert.equal(projection.reasonCode, 'component_unavailable');
  assert.equal(projection.sponsorshipAvailable, false);
  assert.equal(projection.authority, 'status-projection-only');
  assert.equal(projection.executionAuthorization, false);
  assert.equal(projection.sponsorshipAuthorization, false);
  assert.equal(projection.settlementAuthority, false);
  assert.equal(projection.accountingAuthority, false);
  assert.equal(projection.canonicalProtocolAuthority, false);

  const serialized = JSON.stringify(projection);
  for (const forbidden of ['0xsecret', '0xsignature', '999999999999999999999999', 'private_detail', '123456789', '987654321']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('GAS-10.6 settlement discrepancies degrade status without becoming canonical settlement evidence', () => {
  const projection = createGasHealthReadinessProjection420({
    readiness: { state: 'ready', sponsor: 'ready', detailCode: 'deposit_ready' },
    recovery: { state: 'healthy', sponsorshipAvailable: true },
    settlementSummary: { entries: 1, finalizedCount: 1, discrepancyCount: 1 },
    observedAt: T0,
  });

  assert.equal(projection.state, 'degraded');
  assert.equal(projection.reasonCode, 'settlement_discrepancy_observed');
  assert.equal(projection.sponsorshipAvailable, true);
  assert.equal(projection.settlementAuthority, false);
  assert.equal(projection.accountingAuthority, false);
});
