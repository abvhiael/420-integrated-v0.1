import assert from 'node:assert/strict';
import test from 'node:test';
import { GasMetrics420, GasObservabilityError420, createGasOperationalStatus420 } from '../src/observability.mjs';

test('GAS-10.1 records only approved low-cardinality metric series', () => {
  const metrics = new GasMetrics420({ maxSeries: 2 });
  const first = metrics.increment('quotes_requested_total', { source: 'wallet' });
  assert.equal(first.value, 1);
  assert.equal(metrics.increment('quotes_requested_total', { source: 'wallet' }, 2).value, 3);
  metrics.increment('quotes_rejected_total', { reason: 'quota' });
  assert.equal(metrics.snapshot().length, 2);
  assert.throws(() => metrics.increment('signer_failures_total', { source: 'automation' }), /GAS10_METRIC_SERIES_CAPACITY_EXCEEDED/);
});

test('GAS-10.1 rejects high-cardinality and secret-bearing telemetry dimensions', () => {
  const metrics = new GasMetrics420();
  assert.throws(() => metrics.increment('quotes_requested_total', { account: '0xabc' }), /GAS10_LABEL_KEY_INVALID/);
  assert.throws(() => metrics.increment('quotes_requested_total', { source: 'wallet', reason: 'quota', result: 'denied' }), /GAS10_LABEL_CARDINALITY_EXCEEDED/);
  assert.throws(() => metrics.increment('unknown_metric', {}), GasObservabilityError420);
  assert.throws(() => metrics.increment('quotes_requested_total', { source: 'wallet/0x1234' }), /GAS10_LABEL_VALUE_INVALID/);
});

test('GAS-10.1 operational status is redacted and explicitly non-authoritative', () => {
  const status = createGasOperationalStatus420({
    state: 'degraded',
    sponsor: 'low',
    settlement: 'healthy',
    observedAt: '2026-09-15T20:00:00Z',
    detailCode: 'deposit_low',
  });
  assert.equal(status.authority, 'telemetry-only');
  assert.equal(status.executionAuthorization, false);
  assert.equal(status.settlementAuthority, false);
  assert.equal(status.canonicalProtocolAuthority, false);
  assert.equal('account' in status, false);
  assert.equal('authorizationId' in status, false);
  assert.equal('signature' in status, false);
});

test('GAS-10.1 rejects malformed operational status instead of leaking arbitrary detail', () => {
  assert.throws(() => createGasOperationalStatus420({ state: 'ready', sponsor: 'ready', settlement: 'healthy', observedAt: 'bad-time' }), /GAS10_STATUS_TIME_INVALID/);
  assert.throws(() => createGasOperationalStatus420({ state: 'ready', sponsor: 'ready', settlement: 'healthy', observedAt: '2026-09-15T20:00:00Z', detailCode: 'account=0xsecret' }), /GAS10_STATUS_DETAIL_INVALID/);
});
