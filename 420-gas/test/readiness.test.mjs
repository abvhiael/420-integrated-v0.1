import assert from 'node:assert/strict';
import test from 'node:test';
import { GasReadinessError420, evaluateGasSponsorReadiness420, validateGasSponsorReadinessThresholds420 } from '../src/readiness.mjs';

const observedAt = '2026-09-15T20:15:00Z';
const thresholds = { minReadyAvailableWei: '1000', minDegradedAvailableWei: '250' };

test('GAS-10.2 reports ready sponsor funding from observed available deposit', () => {
  const status = evaluateGasSponsorReadiness420({ depositWei: '1500', reservedWei: '400', observedAt, thresholds });
  assert.equal(status.state, 'ready');
  assert.equal(status.sponsor, 'ready');
  assert.equal(status.availableWei, '1100');
  assert.equal(status.detailCode, 'deposit_ready');
  assert.equal(status.authority, 'telemetry-only');
  assert.equal(status.sponsorshipAuthorization, false);
  assert.equal(status.settlementAuthority, false);
  assert.equal(status.canonicalProtocolAuthority, false);
});

test('GAS-10.2 reports degraded and not-ready sponsor funding at deterministic thresholds', () => {
  const degraded = evaluateGasSponsorReadiness420({ depositWei: '600', reservedWei: '300', observedAt, thresholds });
  assert.equal(degraded.state, 'degraded');
  assert.equal(degraded.sponsor, 'low');
  assert.equal(degraded.availableWei, '300');
  assert.equal(degraded.detailCode, 'deposit_low');

  const unavailable = evaluateGasSponsorReadiness420({ depositWei: '300', reservedWei: '100', observedAt, thresholds });
  assert.equal(unavailable.state, 'not-ready');
  assert.equal(unavailable.sponsor, 'unavailable');
  assert.equal(unavailable.availableWei, '200');
  assert.equal(unavailable.detailCode, 'deposit_below_degraded_threshold');
});

test('GAS-10.2 fails closed when observed reservations exceed deposit', () => {
  const status = evaluateGasSponsorReadiness420({ depositWei: '100', reservedWei: '101', observedAt, thresholds });
  assert.equal(status.state, 'not-ready');
  assert.equal(status.sponsor, 'unavailable');
  assert.equal(status.availableWei, '0');
  assert.equal(status.detailCode, 'reservation_exceeds_deposit');
  assert.equal(status.settlementAuthority, false);
});

test('GAS-10.2 readiness projection contains no user-operation or secret identifiers', () => {
  const status = evaluateGasSponsorReadiness420({ depositWei: '1500', reservedWei: '400', observedAt, thresholds });
  for (const key of ['account', 'authorizationId', 'quoteId', 'signature', 'credential', 'privateKey']) {
    assert.equal(key in status, false);
  }
});

test('GAS-10.2 rejects malformed or unsafe thresholds and observations', () => {
  assert.throws(() => validateGasSponsorReadinessThresholds420({ minReadyAvailableWei: '100', minDegradedAvailableWei: '101' }), /GAS10_READINESS_THRESHOLD_ORDER_INVALID/);
  assert.throws(() => validateGasSponsorReadinessThresholds420({ unexpected: '1' }), /GAS10_READINESS_THRESHOLDS_FIELD_INVALID/);
  assert.throws(() => evaluateGasSponsorReadiness420({ depositWei: '-1', reservedWei: '0', observedAt, thresholds }), GasReadinessError420);
  assert.throws(() => evaluateGasSponsorReadiness420({ depositWei: '100', reservedWei: '0', observedAt: 'bad-time', thresholds }), /GAS10_READINESS_TIME_INVALID/);
});
