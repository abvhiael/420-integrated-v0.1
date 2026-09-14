import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAutomationExecutionReceipt420,
  assertNoConcurrentAutomationAttempt420,
  automationRetryDelayMs420,
  createAutomationAttempt420,
  deriveAutomationAttemptId420,
  observeAutomationTransaction420,
  openAutomationRetryAttempt420,
  resolveAutomationAmbiguity420,
  validateAutomationRetryPolicy420,
} from '../src/index.js';
import type { AutomationExecutionReceipt420, AutomationRetryPolicy420 } from '../src/index.js';

const occurrenceId = `0x${'11'.repeat(32)}`;
const intentDigest = `0x${'22'.repeat(32)}`;
const txHash = `0x${'33'.repeat(32)}`;
const policy: AutomationRetryPolicy420 = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 4_000, ambiguityHoldMs: 5_000, maxEvidenceAgeMs: 2_000 };

function attempt(nowMs = 1_000) {
  return createAutomationAttempt420({ jobId: 'job.alpha', occurrenceId, intentDigest, nowMs });
}

function receipt(overrides: Partial<AutomationExecutionReceipt420> = {}): AutomationExecutionReceipt420 {
  return {
    jobId: 'job.alpha',
    occurrenceId,
    workerId: 'worker.alpha',
    intentDigest,
    status: 'rejected',
    transactionHash: null,
    code: 'RPC_BUSY',
    retryable: true,
    ...overrides,
  };
}

test('AUT-6 derives deterministic attempt IDs per occurrence and attempt number', () => {
  const a = deriveAutomationAttemptId420('job.alpha', occurrenceId, intentDigest, 1);
  const b = deriveAutomationAttemptId420('job.alpha', occurrenceId, intentDigest, 1);
  const c = deriveAutomationAttemptId420('job.alpha', occurrenceId, intentDigest, 2);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test('AUT-6 schedules bounded exponential backoff for retryable rejections', () => {
  assert.equal(automationRetryDelayMs420(1, policy), 1_000);
  assert.equal(automationRetryDelayMs420(2, policy), 2_000);
  assert.equal(automationRetryDelayMs420(3, policy), 4_000);
  const first = applyAutomationExecutionReceipt420(attempt(), receipt(), 1_100, policy);
  assert.equal(first.state, 'retry-wait');
  assert.equal(first.nextAttemptAtMs, 2_100);
  assert.throws(() => openAutomationRetryAttempt420(first, 2_099, policy), /AUT6_RETRY_NOT_DUE/);
  const second = openAutomationRetryAttempt420(first, 2_100, policy);
  assert.equal(second.attemptNumber, 2);
  assert.notEqual(second.attemptId, first.attemptId);
});

test('AUT-6 never retries non-retryable rejection and stops at max attempts', () => {
  const terminal = applyAutomationExecutionReceipt420(attempt(), receipt({ retryable: false, code: 'POLICY_DENIED' }), 1_100, policy);
  assert.equal(terminal.state, 'terminal');
  assert.equal(terminal.terminalCode, 'POLICY_DENIED');

  const third = createAutomationAttempt420({ jobId: 'job.alpha', occurrenceId, intentDigest, attemptNumber: 3, nowMs: 1_000 });
  const exhausted = applyAutomationExecutionReceipt420(third, receipt(), 1_100, policy);
  assert.equal(exhausted.state, 'terminal');
  assert.equal(exhausted.terminalCode, 'AUT6_MAX_ATTEMPTS_EXHAUSTED');
});

test('AUT-6 holds ambiguous submissions until explicit fresh canonical-safe resolution', () => {
  const ambiguous = applyAutomationExecutionReceipt420(attempt(), receipt({ status: 'ambiguous', code: 'RPC_TIMEOUT', retryable: false }), 1_100, policy);
  assert.equal(ambiguous.state, 'ambiguous');
  assert.throws(() => resolveAutomationAmbiguity420(ambiguous, { status: 'not-submitted', chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy), /AUT6_AMBIGUITY_HOLD_ACTIVE/);
  assert.throws(() => resolveAutomationAmbiguity420(ambiguous, { status: 'not-submitted', chainId: 421n, canonicalSafe: true, observedAtMs: 6_200 }, 6_200, policy), /AUT6_RECOVERY_CHAIN_ID_MISMATCH/);
  const resolved = resolveAutomationAmbiguity420(ambiguous, { status: 'not-submitted', chainId: 420n, canonicalSafe: true, observedAtMs: 6_200 }, 6_200, policy);
  assert.equal(resolved.state, 'retry-wait');
});

test('AUT-6 converts ambiguous accepted evidence into submitted state without replay', () => {
  const ambiguous = applyAutomationExecutionReceipt420(attempt(), receipt({ status: 'ambiguous', code: 'RPC_TIMEOUT', retryable: false }), 1_100, policy);
  const accepted = resolveAutomationAmbiguity420(ambiguous, { status: 'accepted', transactionHash: txHash, chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy);
  assert.equal(accepted.state, 'submitted');
  assert.equal(accepted.transactionHash, txHash);
  assert.equal(accepted.nextAttemptAtMs, null);
});

test('AUT-6 finalizes submitted transactions and fails closed on uncertain absence', () => {
  const submitted = applyAutomationExecutionReceipt420(attempt(), receipt({ status: 'submitted', transactionHash: txHash, code: null, retryable: false }), 1_100, policy);
  const pending = observeAutomationTransaction420(submitted, { status: 'canonical', chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy);
  assert.equal(pending.state, 'submitted');
  const finalized = observeAutomationTransaction420(pending, { status: 'finalized', chainId: 420n, canonicalSafe: true, observedAtMs: 1_300 }, 1_300, policy);
  assert.equal(finalized.state, 'confirmed');

  const missing = observeAutomationTransaction420(submitted, { status: 'not-found', chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy);
  assert.equal(missing.state, 'ambiguous');
  assert.equal(missing.nextAttemptAtMs, null);
});

test('AUT-6 only retries reorged submissions after safe non-inclusion evidence', () => {
  const submitted = applyAutomationExecutionReceipt420(attempt(), receipt({ status: 'submitted', transactionHash: txHash, code: null, retryable: false }), 1_100, policy);
  const uncertain = observeAutomationTransaction420(submitted, { status: 'reorged', safeNonInclusion: false, chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy);
  assert.equal(uncertain.state, 'ambiguous');
  const safe = observeAutomationTransaction420(submitted, { status: 'reorged', safeNonInclusion: true, chainId: 420n, canonicalSafe: true, observedAtMs: 1_200 }, 1_200, policy);
  assert.equal(safe.state, 'retry-wait');
});

test('AUT-6 rejects duplicate active attempts for one occurrence', () => {
  const first = attempt();
  const second = createAutomationAttempt420({ jobId: 'job.alpha', occurrenceId, intentDigest, attemptNumber: 2, nowMs: 2_000 });
  assert.throws(() => assertNoConcurrentAutomationAttempt420([first, second], occurrenceId), /AUT6_DUPLICATE_ACTIVE_ATTEMPT/);
  const terminal = { ...first, state: 'terminal' as const };
  assert.doesNotThrow(() => assertNoConcurrentAutomationAttempt420([terminal, second], occurrenceId));
});

test('AUT-6 validates retry policy and receipt identity bindings', () => {
  assert.throws(() => validateAutomationRetryPolicy420({ ...policy, maxAttempts: 0 }), /AUT6_MAX_ATTEMPTS_INVALID/);
  assert.throws(() => validateAutomationRetryPolicy420({ ...policy, maxDelayMs: 999 }), /AUT6_MAX_DELAY_INVALID/);
  assert.throws(() => applyAutomationExecutionReceipt420(attempt(), receipt({ jobId: 'job.other' }), 1_100, policy), /AUT6_JOB_ID_MISMATCH/);
  assert.throws(() => resolveAutomationAmbiguity420({ ...attempt(), state: 'ambiguous', updatedAtMs: 1_100 }, { status: 'not-submitted', chainId: 420n, canonicalSafe: false, observedAtMs: 6_200 }, 6_200, policy), /AUT6_RECOVERY_NOT_CANONICAL_SAFE/);
});
