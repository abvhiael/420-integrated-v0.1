import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAutomationAttempt420,
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

const attempt = createAutomationAttempt420({ jobId: plan.jobId, occurrenceId: plan.occurrenceId, intentDigest: plan.intentDigest, nowMs: 1_000 });
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
const binding: AutomationGasQuoteBinding420 = {
  paymasterId: '420gas.alpha',
  entryPoint: '0x3333333333333333333333333333333333333333',
  paymaster: '0x4444444444444444444444444444444444444444',
  account: '0x5555555555555555555555555555555555555555',
  policyId: `0x${'66'.repeat(32)}`,
  maxSponsoredCostWei: 1_000n,
};
const feeQuote = { maxFeePerGasWei: 10n, maxPriorityFeePerGasWei: 2n, observedAtMs: 1_000 };
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

function quoteClient(overrides: Partial<CanonicalGasQuote420> = {}): AutomationGasQuoteClient420 {
  return {
    async requestQuote(request) {
      return { status: 'quote', quote: quoteFrom(request, overrides) };
    },
  };
}

test('GAS-8.5 prepares a canonical request, validates the returned quote and authorizes sponsorship', async () => {
  let seen: CanonicalGasQuoteRequest420 | null = null;
  const client: AutomationGasQuoteClient420 = {
    async requestQuote(request) {
      seen = request;
      return { status: 'quote', quote: quoteFrom(request) };
    },
  };
  const result = await prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 100n, allowanceWei: 100n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client,
  });
  assert.equal(result.fundingMode, 'paymaster');
  assert.equal(result.authorization.paymasterSponsoredWei, 1_000n);
  assert.equal(result.authorization.workerRequiredWei, 100n);
  assert.notEqual(seen, null);
  const captured = seen as CanonicalGasQuoteRequest420;
  assert.equal(captured.authorizationId, attempt.attemptId);
  assert.equal(captured.sponsorshipDigest, sponsorshipDigest);
  assert.equal(result.fallbackReason, null);
});

test('GAS-8.5 fails closed when sponsorship is unavailable by default', async () => {
  const client: AutomationGasQuoteClient420 = { async requestQuote() { return { status: 'unavailable', code: 'SERVICE_DOWN' }; } };
  await assert.rejects(() => prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 2_000n, allowanceWei: 2_000n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client,
  }), /GAS8_SPONSORSHIP_UNAVAILABLE:SERVICE_DOWN/);
});

test('GAS-8.5 allows explicit self-funded fallback only through the existing AUT-5 budget gates', async () => {
  const client: AutomationGasQuoteClient420 = { async requestQuote() { return { status: 'unavailable', code: 'NO_QUOTE' }; } };
  const result = await prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 1_100n, allowanceWei: 1_100n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client,
    preparationPolicy: { allowSelfFundedFallback: true, quoteValidityMs: 30_000 },
  });
  assert.equal(result.fundingMode, 'worker');
  assert.equal(result.authorization.workerRequiredWei, 1_100n);
  assert.equal(result.authorization.paymasterSponsoredWei, 0n);
  assert.equal(result.fallbackReason, 'NO_QUOTE');

  await assert.rejects(() => prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 1_099n, allowanceWei: 1_100n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client,
    preparationPolicy: { allowSelfFundedFallback: true, quoteValidityMs: 30_000 },
  }), /AUT5_INSUFFICIENT_BALANCE/);
});

test('GAS-8.5 never downgrades malformed or authority-escalating quotes to self-funded fallback', async () => {
  await assert.rejects(() => prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 2_000n, allowanceWei: 2_000n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client: quoteClient({ executionAuthorization: true }),
    preparationPolicy: { allowSelfFundedFallback: true, quoteValidityMs: 30_000 },
  }), /GAS8_QUOTE_AUTHORITY_ESCALATION/);

  await assert.rejects(() => prepareAutomationGasFunding420({
    attempt,
    plan,
    budget,
    funding: { jobId: plan.jobId, availableBalanceWei: 2_000n, allowanceWei: 2_000n, observedAtMs: 1_000 },
    feeQuote,
    binding,
    sponsorshipDigest,
    nowMs: 1_100,
    client: quoteClient({ authorizationId: `0x${'99'.repeat(32)}` }),
    preparationPolicy: { allowSelfFundedFallback: true, quoteValidityMs: 30_000 },
  }), /GAS8_QUOTE_ATTEMPT_MISMATCH/);
});
