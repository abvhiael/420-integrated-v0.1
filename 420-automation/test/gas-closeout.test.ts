import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAutomationAttempt420,
  openAutomationRetryAttempt420,
  prepareAutomationGasFunding420,
} from '../src/index.js';
import type {
  AutomationExecutionBudget420,
  AutomationGasQuoteBinding420,
  AutomationGasQuoteClient420,
  AutomationTransactionPlan420,
  CanonicalGasQuote420,
  CanonicalGasQuoteRequest420,
} from '../src/index.js';

function basePlan(): AutomationTransactionPlan420 {
  return {
    chainId: 420n,
    jobId: 'job.closeout',
    occurrenceId: `0x${'aa'.repeat(32)}`,
    workerId: 'worker.closeout',
    from: '0x2222222222222222222222222222222222222222',
    to: '0x1111111111111111111111111111111111111111',
    data: '0x12345678',
    valueWei: 100n,
    gasLimit: 100n,
    envelopeDigest: `0x${'bb'.repeat(32)}`,
    intentDigest: `0x${'cc'.repeat(32)}`,
  };
}

const budget: AutomationExecutionBudget420 = {
  jobId: 'job.closeout',
  mode: 'paymaster',
  maxFeePerGasWei: 10n,
  maxPriorityFeePerGasWei: 2n,
  maxGasCostWei: 1_000n,
  maxNativeValueWei: 100n,
  maxTotalCostWei: 1_100n,
  maxReimbursementWei: 800n,
  paymasterId: '420gas.closeout',
};

const binding: AutomationGasQuoteBinding420 = {
  paymasterId: '420gas.closeout',
  entryPoint: '0x3333333333333333333333333333333333333333',
  paymaster: '0x4444444444444444444444444444444444444444',
  account: '0x5555555555555555555555555555555555555555',
  policyId: `0x${'66'.repeat(32)}`,
  maxSponsoredCostWei: 1_000n,
};

const feeQuote = { maxFeePerGasWei: 10n, maxPriorityFeePerGasWei: 2n, observedAtMs: 1_000 };
const funding = { jobId: budget.jobId, availableBalanceWei: 100n, allowanceWei: 100n, observedAtMs: 1_000 };
const sponsorshipDigest = `0x${'77'.repeat(32)}`;

function quoteFrom(request: CanonicalGasQuoteRequest420, overrides: Partial<CanonicalGasQuote420> = {}): CanonicalGasQuote420 {
  return {
    ...request,
    quoteId: `0x${'88'.repeat(32)}`,
    fundingMode: 'paymaster',
    authority: 'funding-offer-only',
    executionAuthorization: false,
    walletAuthorization: false,
    targetProtocolAuthorization: false,
    canonicalProtocolAuthority: false,
    ...overrides,
  };
}

function successClient(overrides: Partial<CanonicalGasQuote420> = {}): AutomationGasQuoteClient420 {
  return { async requestQuote(request) { return { status: 'quote', quote: quoteFrom(request, overrides) }; } };
}

test('GAS-8.6 rejects mid-flight execution-plan mutation while a quote is outstanding', async () => {
  const plan = basePlan();
  const attempt = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
  const client: AutomationGasQuoteClient420 = {
    async requestQuote(request) {
      plan.to = '0x9999999999999999999999999999999999999999';
      return { status: 'quote', quote: quoteFrom(request) };
    },
  };
  await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client }), /GAS8_PLAN_MUTATED_DURING_QUOTE/);
});

test('GAS-8.6 refuses sponsorship for ambiguous and retry-wait attempts', async () => {
  const plan = basePlan();
  const ready = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
  for (const state of ['ambiguous', 'retry-wait'] as const) {
    const attempt = { ...ready, state, nextAttemptAtMs: state === 'retry-wait' ? 2_000 : null };
    await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: successClient() }), /GAS8_ATTEMPT_NOT_READY/);
  }
});

test('GAS-8.6 requires a fresh attempt-bound quote after retry opens', async () => {
  const plan = basePlan();
  const first = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
  const retryWait = { ...first, state: 'retry-wait' as const, updatedAtMs: 1_100, nextAttemptAtMs: 2_100, terminalCode: 'AUT6_RETRYABLE_REJECTION' };
  const second = openAutomationRetryAttempt420(retryWait, 2_100);
  let staleQuote: CanonicalGasQuote420 | null = null;
  const firstClient: AutomationGasQuoteClient420 = {
    async requestQuote(request) {
      staleQuote = quoteFrom(request);
      return { status: 'quote', quote: staleQuote };
    },
  };
  await prepareAutomationGasFunding420({ attempt: first, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: firstClient });
  assert.ok(staleQuote);
  const replayClient: AutomationGasQuoteClient420 = { async requestQuote() { return { status: 'quote', quote: staleQuote! }; } };
  await assert.rejects(() => prepareAutomationGasFunding420({ attempt: second, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 2_100, client: replayClient }), /GAS8_QUOTE_ATTEMPT_MISMATCH/);
});

test('GAS-8.6 rejects wrong-chain plans and wrong canonical bindings', async () => {
  const plan = basePlan();
  const attempt = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
  await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan: { ...plan, chainId: 421n }, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: successClient() }), /GAS8_REQUEST_CHAIN_MISMATCH/);
  await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: successClient({ paymaster: '0x9999999999999999999999999999999999999999' }) }), /GAS8_QUOTE_PAYMASTER_MISMATCH/);
  await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: successClient({ policyId: `0x${'99'.repeat(32)}` }) }), /GAS8_QUOTE_POLICY_MISMATCH/);
});

test('GAS-8.6 keeps sponsorship authority funding-only through the complete preparation path', async () => {
  const plan = basePlan();
  const attempt = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
  for (const overrides of [
    { executionAuthorization: true },
    { targetProtocolAuthorization: true },
    { canonicalProtocolAuthority: true },
  ]) {
    await assert.rejects(() => prepareAutomationGasFunding420({ attempt, plan, budget, funding, feeQuote, binding, sponsorshipDigest, nowMs: 1_100, client: successClient(overrides) }), /GAS8_QUOTE_AUTHORITY_ESCALATION/);
  }
});
