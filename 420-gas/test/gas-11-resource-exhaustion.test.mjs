import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GasQuoteError420,
  validateGasQuoteCredential420,
  validateGasQuoteRequest420,
} from '../src/quote-service.mjs';
import { GasQuotaController420, GasQuotaError420, validateGasQuotaPolicy420 } from '../src/quota-controller.mjs';
import { GasMetrics420, GasObservabilityError420 } from '../src/observability.mjs';
import { evaluateGasSponsorReadiness420, GasReadinessError420 } from '../src/readiness.mjs';
import { GasSettlementJournal420, GasSettlementJournalError420 } from '../src/settlement-journal.mjs';
import { GasRecoveryState420, GasRecoveryError420 } from '../src/recovery-state.mjs';

const T0 = '2026-09-16T03:00:00.000Z';
const NOW_MS = Date.parse(T0);
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function quoteRequest(overrides = {}) {
  return {
    schemaVersion: '1.2.0',
    chainId: '420',
    entryPoint: addr(1),
    paymaster: addr(2),
    account: addr(3),
    sponsorshipDigest: hash(4),
    policyId: hash(5),
    authorizationId: hash(6),
    maxSponsoredCostWei: '1000000000000000',
    gasLimit: '21000',
    maxFeePerGasWei: '1000000000',
    maxPriorityFeePerGasWei: '100000000',
    validAfter: '2026-09-16T02:59:00.000Z',
    validUntil: '2026-09-16T03:01:00.000Z',
    ...overrides,
  };
}

function credential(overrides = {}) {
  return {
    applicationId: 'wallet420',
    audience: '420gas',
    scopes: ['gas:quote'],
    expiresAt: '2026-09-16T03:05:00.000Z',
    ...overrides,
  };
}

test('GAS-11.4 rejects oversized decimal quote fields before unbounded BigInt parsing', () => {
  const oversized = '9'.repeat(10_000);
  assert.throws(
    () => validateGasQuoteRequest420(quoteRequest({ maxSponsoredCostWei: oversized })),
    (error) => error instanceof GasQuoteError420 && /uint256 decimal string/.test(error.message),
  );
  assert.throws(
    () => validateGasQuoteRequest420(quoteRequest({ chainId: oversized })),
    (error) => error instanceof GasQuoteError420 && /uint256 decimal string/.test(error.message),
  );
});

test('GAS-11.4 rejects uint256 overflow even when decimal input is only 78 digits', () => {
  const aboveUint256 = (1n << 256n).toString(10);
  assert.equal(aboveUint256.length, 78);
  assert.throws(
    () => validateGasQuoteRequest420(quoteRequest({ gasLimit: aboveUint256 })),
    (error) => error instanceof GasQuoteError420 && /exceeds uint256/.test(error.message),
  );
});

test('GAS-11.4 bounds credential scope fanout before per-scope normalization', () => {
  const scopes = ['gas:quote', ...Array.from({ length: 16 }, (_, index) => `scope:${index}`)];
  assert.throws(
    () => validateGasQuoteCredential420(credential({ scopes }), { now: new Date(T0) }),
    (error) => error instanceof GasQuoteError420 && /between 1 and 16/.test(error.message),
  );
});

test('GAS-11.4 quota policy and reservation costs reject oversized uint256 inputs without allocating state', () => {
  const oversized = '9'.repeat(10_000);
  assert.throws(
    () => validateGasQuotaPolicy420({ maxSponsorWindowWei: oversized }),
    (error) => error instanceof GasQuotaError420 && error.code === 'GAS9_SPONSOR_WINDOW_LIMIT_INVALID',
  );

  const quota = new GasQuotaController420();
  assert.throws(
    () => quota.reserve({
      account: addr(3), policyId: hash(5), authorizationId: hash(6),
      maxSponsoredCostWei: oversized, nowMs: NOW_MS, expiresAtMs: NOW_MS + 1_000,
    }),
    (error) => error instanceof GasQuotaError420 && error.code === 'GAS9_OPERATION_COST_INVALID',
  );
  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: NOW_MS });
  assert.equal(snapshot.trackedAuthorizations, 0);
  assert.equal(snapshot.trackedWindows, 0);
});

test('GAS-11.4 quota capacity remains fail-closed under authorization flooding', () => {
  const quota = new GasQuotaController420({
    maxTrackedAuthorizations: 2,
    maxConcurrentSponsor: 10,
    maxConcurrentPerAccount: 10,
    maxTrackedWindows: 10,
  });
  const reserve = (authorizationId) => quota.reserve({
    account: addr(3), policyId: hash(5), authorizationId,
    maxSponsoredCostWei: '1', nowMs: NOW_MS, expiresAtMs: NOW_MS + 1_000,
  });
  reserve(hash(10));
  reserve(hash(11));
  assert.throws(
    () => reserve(hash(12)),
    (error) => error instanceof GasQuotaError420 && error.code === 'GAS9_STATE_CAPACITY_EXCEEDED',
  );
  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: NOW_MS });
  assert.equal(snapshot.trackedAuthorizations, 2);
  assert.ok(snapshot.trackedWindows <= 3);
});

test('GAS-11.4 metrics cardinality stays bounded under attacker-controlled label churn', () => {
  const metrics = new GasMetrics420({ maxSeries: 2 });
  metrics.increment('quotes_rejected_total', { reason: 'bad_chain' });
  metrics.increment('quotes_rejected_total', { reason: 'bad_policy' });
  assert.throws(
    () => metrics.increment('quotes_rejected_total', { reason: 'bad_account' }),
    (error) => error instanceof GasObservabilityError420 && error.code === 'GAS10_METRIC_SERIES_CAPACITY_EXCEEDED',
  );
  assert.equal(metrics.snapshot().length, 2);
  assert.throws(
    () => metrics.increment('quotes_rejected_total', { reason: 'x'.repeat(33) }),
    (error) => error instanceof GasObservabilityError420 && error.code === 'GAS10_LABEL_VALUE_INVALID',
  );
  assert.equal(metrics.snapshot().length, 2);
});

test('GAS-11.4 readiness rejects oversized balances before arithmetic', () => {
  const oversized = '9'.repeat(10_000);
  assert.throws(
    () => evaluateGasSponsorReadiness420({ depositWei: oversized, reservedWei: '0', observedAt: T0 }),
    (error) => error instanceof GasReadinessError420 && error.code === 'GAS10_READINESS_DEPOSIT_INVALID',
  );
});

test('GAS-11.4 settlement journal rejects oversized costs and preserves bounded retention', () => {
  const journal = new GasSettlementJournal420({ maxEntries: 2 });
  const oversized = '9'.repeat(10_000);
  assert.throws(
    () => journal.append({
      settlementCommitment: hash(20), reservedWei: '1', actualCostWei: oversized,
      outcome: 'success', confirmation: 'observed', observedAt: T0,
    }),
    (error) => error instanceof GasSettlementJournalError420 && error.code === 'GAS10_SETTLEMENT_ACTUAL_INVALID',
  );
  assert.equal(journal.summary().entries, 0);

  for (const n of [21, 22, 23]) {
    journal.append({
      settlementCommitment: hash(n), reservedWei: '2', actualCostWei: '1',
      outcome: 'success', confirmation: 'observed', observedAt: T0,
    });
  }
  assert.equal(journal.summary().entries, 2);
  assert.equal(journal.get(hash(21)), null);
  assert.notEqual(journal.get(hash(23)), null);
});

test('GAS-11.4 recovery churn and attacker reason codes remain bounded', () => {
  const recovery = new GasRecoveryState420({ maxTransitions: 2 });
  recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'latency', observedAt: T0 });
  recovery.transition({ component: 'funding', state: 'degraded', reasonCode: 'low_deposit', observedAt: T0 });
  recovery.transition({ component: 'signer', state: 'unavailable', reasonCode: 'down', observedAt: T0 });
  assert.equal(recovery.history().length, 2);
  assert.equal(recovery.snapshot().retainedTransitions, 2);

  assert.throws(
    () => recovery.transition({ component: 'signer', state: 'degraded', reasonCode: 'x'.repeat(49), observedAt: T0 }),
    (error) => error instanceof GasRecoveryError420 && error.code === 'GAS10_RECOVERY_REASON_INVALID',
  );
  assert.equal(recovery.history().length, 2);
});
