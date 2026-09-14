import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomationReadinessController420, AutomationReceiptJournal420, automationOperationalSnapshot420 } from '../src/observability.js';
import type { AutomationAttempt420 } from '../src/recovery.js';

const healthyChain = { chainId: 420n, rpcReady: true, canonicalSafe: true, observedAtMs: 1_000 };
const workers = { registeredWorkers: 2, liveWorkers: 2, activeLeases: 1 };

function attempt(state: AutomationAttempt420['state']): AutomationAttempt420 {
  return {
    jobId: 'job-1',
    occurrenceId: `0x${'11'.repeat(32)}`,
    intentDigest: `0x${'22'.repeat(32)}`,
    attemptNumber: 1,
    attemptId: `0x${'33'.repeat(32)}`,
    state,
    createdAtMs: 1_000,
    updatedAtMs: 1_000,
    nextAttemptAtMs: null,
    transactionHash: null,
    terminalCode: null,
  };
}

test('readiness requires consecutive healthy observations before reopening', () => {
  const controller = new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 10_000, minLiveWorkers: 1, recoverySuccessesRequired: 2 });
  const input = { nowMs: 1_100, chain: healthyChain, schedulerReady: true, oracleReady: true, workerSnapshot: workers, jobsTotal: 3, activeAttempts: [] };
  const first = controller.evaluate(input);
  assert.equal(first.state, 'degraded');
  assert.equal(first.ready, false);
  const second = controller.evaluate({ ...input, nowMs: 1_200 });
  assert.equal(second.state, 'ready');
  assert.equal(second.ready, true);
});

test('wrong chain, stale safety, scheduler failure and missing workers fail closed', () => {
  const controller = new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 50, minLiveWorkers: 1, recoverySuccessesRequired: 1 });
  const snapshot = controller.evaluate({
    nowMs: 2_000,
    chain: { chainId: 421n, rpcReady: false, canonicalSafe: false, observedAtMs: 1_000 },
    schedulerReady: false,
    oracleReady: true,
    workerSnapshot: { registeredWorkers: 2, liveWorkers: 0, activeLeases: 0 },
    jobsTotal: 1,
    activeAttempts: [],
  });
  assert.equal(snapshot.state, 'not-ready');
  assert.deepEqual(snapshot.reasons, ['wrong-chain', 'rpc-not-ready', 'canonical-safety-unavailable', 'chain-observation-stale', 'scheduler-not-ready', 'insufficient-live-workers']);
});

test('oracle degradation does not impersonate canonical chain failure', () => {
  const controller = new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 10_000, minLiveWorkers: 1, recoverySuccessesRequired: 1 });
  const snapshot = controller.evaluate({ nowMs: 1_100, chain: healthyChain, schedulerReady: true, oracleReady: false, workerSnapshot: workers, jobsTotal: 1, activeAttempts: [] });
  assert.equal(snapshot.state, 'degraded');
  assert.deepEqual(snapshot.reasons, ['oracle-degraded']);
  assert.equal(snapshot.canonicalAuthority, false);
});

test('receipt journal is bounded and records only execution outcome fields', () => {
  const journal = new AutomationReceiptJournal420(2);
  const base = { jobId: 'job-1', occurrenceId: `0x${'11'.repeat(32)}`, workerId: 'worker-1', intentDigest: `0x${'22'.repeat(32)}` };
  journal.record({ ...base, status: 'submitted', transactionHash: `0x${'44'.repeat(32)}`, code: null, retryable: false }, 1_000);
  journal.record({ ...base, status: 'rejected', transactionHash: null, code: 'NO_FUNDS', retryable: true }, 1_100);
  journal.record({ ...base, status: 'ambiguous', transactionHash: null, code: 'TIMEOUT', retryable: false }, 1_200);
  const entries = journal.list();
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.status, 'rejected');
  assert.equal(entries[1]?.status, 'ambiguous');
  assert.deepEqual(journal.counts(), { submitted: 0, rejected: 1, ambiguous: 1 });
});

test('operational snapshot uses bounded low-cardinality counts and explicit non-authority flags', () => {
  const controller = new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 10_000, minLiveWorkers: 1, recoverySuccessesRequired: 1 });
  const readiness = controller.evaluate({ nowMs: 1_100, chain: healthyChain, schedulerReady: true, oracleReady: true, workerSnapshot: workers, jobsTotal: 7, activeAttempts: [attempt('ambiguous')] });
  const journal = new AutomationReceiptJournal420();
  const snapshot = automationOperationalSnapshot420({ readiness, chainId: 420n, jobsTotal: 7, workerSnapshot: workers, attempts: [attempt('ambiguous'), attempt('confirmed')], receipts: journal });
  assert.equal(snapshot.readiness.ready, true);
  assert.equal(snapshot.activeAttempts, 1);
  assert.equal(snapshot.ambiguousAttempts, 1);
  assert.equal(snapshot.canonicalAuthority, false);
  assert.equal(snapshot.containsSecrets, false);
  assert.equal(snapshot.metrics.some((metric) => metric.name === 'automation_attempts_ambiguous' && metric.value === 1), true);
});

test('bad readiness policy fails closed', () => {
  assert.throws(() => new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 0, minLiveWorkers: 1, recoverySuccessesRequired: 1 }), /AUT10_CHAIN_AGE_INVALID/);
  assert.throws(() => new AutomationReadinessController420({ expectedChainId: 420n, maxChainObservationAgeMs: 10, minLiveWorkers: 0, recoverySuccessesRequired: 1 }), /AUT10_MIN_WORKERS_INVALID/);
});
