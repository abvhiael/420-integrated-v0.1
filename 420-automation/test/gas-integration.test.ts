import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automationFundingPlanDigest420,
  authorizeAutomationSponsoredAttempt420,
  createAutomationAttempt420,
} from '../src/index.js';
import type {
  AutomationExecutionBudget420,
  AutomationTransactionPlan420,
} from '../src/index.js';

const plan: AutomationTransactionPlan420 = {
  chainId: 420n,
  jobId: 'job.alpha',
  occurrenceId: `0x${'aa'.repeat(32)}`,
  workerId: 'worker.alpha',
  from: '0x2222222222222222222222222222222222222222',
  to: '0x1111111111111111111111111111111111111111',
  data: '0x12345678',
  valueWei: 100n,
  gasLimit: 100n,
  envelopeDigest: `0x${'bb'.repeat(32)}`,
  intentDigest: `0x${'cc'.repeat(32)}`,
};

const budget: AutomationExecutionBudget420 = {
  jobId: plan.jobId,
  mode: 'paymaster',
  maxFeePerGasWei: 10n,
  maxPriorityFeePerGasWei: 2n,
  maxGasCostWei: 1_000n,
  maxNativeValueWei: 100n,
  maxTotalCostWei: 1_100n,
  maxReimbursementWei: 800n,
  paymasterId: '420gas.alpha',
};

const funding = { jobId: plan.jobId, availableBalanceWei: 100n, allowanceWei: 100n, observedAtMs: 1_000 };
const feeQuote = { maxFeePerGasWei: 10n, maxPriorityFeePerGasWei: 2n, observedAtMs: 1_000 };
const sponsorshipDigest = `0x${'dd'.repeat(32)}`;

function attempt(attemptNumber = 1) {
  return createAutomationAttempt420({
    jobId: plan.jobId,
    occurrenceId: plan.occurrenceId,
    intentDigest: plan.intentDigest,
    attemptNumber,
    nowMs: 1_000,
  });
}

function quote(attemptId: string) {
  return {
    paymasterId: '420gas.alpha',
    sponsoredGasWei: 5_000n,
    quoteId: 'quote-1',
    expiresAtMs: 2_000,
    planDigest: automationFundingPlanDigest420(plan),
    sponsorshipDigest,
    attemptId,
  };
}

test('GAS-8.2 binds sponsorship to the exact ready Automation attempt', () => {
  const current = attempt();
  const auth = authorizeAutomationSponsoredAttempt420({
    attempt: current,
    plan,
    budget,
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: quote(current.attemptId),
  });

  assert.equal(auth.paymasterAttemptId, current.attemptId);
  assert.equal(auth.paymasterSponsoredWei, 1_000n);
  assert.equal(auth.workerRequiredWei, 100n);
  assert.equal(auth.sponsorshipDigest, sponsorshipDigest);
  assert.match(auth.authorizationDigest, /^0x[0-9a-f]{64}$/);
});

test('GAS-8.2 refuses sponsorship while execution status is ambiguous or already submitted', () => {
  const current = attempt();
  for (const state of ['ambiguous', 'submitted', 'retry-wait', 'confirmed', 'terminal'] as const) {
    assert.throws(() => authorizeAutomationSponsoredAttempt420({
      attempt: { ...current, state },
      plan,
      budget,
      funding,
      feeQuote,
      nowMs: 1_100,
      paymasterQuote: quote(current.attemptId),
    }), /GAS8_ATTEMPT_NOT_READY/);
  }
});

test('GAS-8.2 requires a fresh paymaster quote for every retry attempt', () => {
  const first = attempt(1);
  const retry = attempt(2);
  assert.notEqual(first.attemptId, retry.attemptId);

  assert.throws(() => authorizeAutomationSponsoredAttempt420({
    attempt: retry,
    plan,
    budget,
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: quote(first.attemptId),
  }), /GAS8_ATTEMPT_BINDING_MISMATCH/);

  assert.doesNotThrow(() => authorizeAutomationSponsoredAttempt420({
    attempt: retry,
    plan,
    budget,
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: quote(retry.attemptId),
  }));
});

test('GAS-8.2 rejects attempt identity drift from the authorized plan', () => {
  const current = attempt();
  const input = {
    plan,
    budget,
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: quote(current.attemptId),
  };

  assert.throws(() => authorizeAutomationSponsoredAttempt420({ ...input, attempt: { ...current, jobId: 'job.other' } }), /GAS8_ATTEMPT_JOB_MISMATCH/);
  assert.throws(() => authorizeAutomationSponsoredAttempt420({ ...input, attempt: { ...current, occurrenceId: `0x${'01'.repeat(32)}` } }), /GAS8_ATTEMPT_OCCURRENCE_MISMATCH/);
  assert.throws(() => authorizeAutomationSponsoredAttempt420({ ...input, attempt: { ...current, intentDigest: `0x${'02'.repeat(32)}` } }), /GAS8_ATTEMPT_INTENT_MISMATCH/);
});

test('GAS-8.2 rejects malformed attempt binding and non-paymaster mode', () => {
  const current = attempt();
  assert.throws(() => authorizeAutomationSponsoredAttempt420({
    attempt: current,
    plan,
    budget,
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: { ...quote(current.attemptId), attemptId: '0x12' },
  }), /GAS8_QUOTE_ATTEMPT_ID_INVALID/);

  assert.throws(() => authorizeAutomationSponsoredAttempt420({
    attempt: current,
    plan,
    budget: { ...budget, mode: 'worker', paymasterId: undefined },
    funding,
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: quote(current.attemptId),
  }), /GAS8_PAYMASTER_MODE_REQUIRED/);
});
