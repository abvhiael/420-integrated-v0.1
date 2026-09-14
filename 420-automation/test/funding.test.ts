import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeAutomationFunding420, validateAutomationExecutionBudget420 } from '../src/index.js';
import type { AutomationExecutionBudget420, AutomationTransactionPlan420 } from '../src/index.js';

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
  mode: 'worker',
  maxFeePerGasWei: 10n,
  maxPriorityFeePerGasWei: 2n,
  maxGasCostWei: 1_000n,
  maxNativeValueWei: 100n,
  maxTotalCostWei: 1_100n,
  maxReimbursementWei: 800n,
};

const funding = { jobId: plan.jobId, availableBalanceWei: 2_000n, allowanceWei: 2_000n, observedAtMs: 1_000 };
const feeQuote = { maxFeePerGasWei: 10n, maxPriorityFeePerGasWei: 2n, observedAtMs: 1_000 };

test('AUT-5 authorizes a bounded worker-funded execution', () => {
  const auth = authorizeAutomationFunding420({ plan, budget, funding, feeQuote, nowMs: 1_100 });
  assert.equal(auth.gasCostCeilingWei, 1_000n);
  assert.equal(auth.totalCostCeilingWei, 1_100n);
  assert.equal(auth.reimbursementCeilingWei, 800n);
  assert.equal(auth.workerRequiredWei, 1_100n);
  assert.equal(auth.paymasterSponsoredWei, 0n);
  assert.match(auth.authorizationDigest, /^0x[0-9a-f]{64}$/);
});

test('AUT-5 rejects fee, value, gas and total budget overruns', () => {
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: { ...budget, maxFeePerGasWei: 9n }, funding, feeQuote, nowMs: 1_100 }), /AUT5_FEE_CAP_EXCEEDED/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: { ...budget, maxNativeValueWei: 99n }, funding, feeQuote, nowMs: 1_100 }), /AUT5_NATIVE_VALUE_CAP_EXCEEDED/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: { ...budget, maxGasCostWei: 999n }, funding, feeQuote, nowMs: 1_100 }), /AUT5_GAS_COST_CAP_EXCEEDED/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: { ...budget, maxTotalCostWei: 1_099n }, funding, feeQuote, nowMs: 1_100 }), /AUT5_TOTAL_COST_CAP_EXCEEDED/);
});

test('AUT-5 rejects stale funding and stale fee evidence', () => {
  assert.throws(() => authorizeAutomationFunding420({ plan, budget, funding: { ...funding, observedAtMs: 0 }, feeQuote: { ...feeQuote, observedAtMs: 20_000 }, nowMs: 20_000 }), /AUT5_FUNDING_STALE/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget, funding: { ...funding, observedAtMs: 20_000 }, feeQuote: { ...feeQuote, observedAtMs: 0 }, nowMs: 20_000 }), /AUT5_FEE_QUOTE_STALE/);
});

test('AUT-5 rejects insufficient balance or allowance before execution', () => {
  assert.throws(() => authorizeAutomationFunding420({ plan, budget, funding: { ...funding, availableBalanceWei: 1_099n }, feeQuote, nowMs: 1_100 }), /AUT5_INSUFFICIENT_BALANCE/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget, funding: { ...funding, allowanceWei: 1_099n }, feeQuote, nowMs: 1_100 }), /AUT5_INSUFFICIENT_ALLOWANCE/);
});

test('AUT-5 enforces paymaster identity, expiry and bounded sponsorship', () => {
  const pmBudget: AutomationExecutionBudget420 = { ...budget, mode: 'paymaster', paymasterId: '420gas.alpha' };
  const auth = authorizeAutomationFunding420({
    plan,
    budget: pmBudget,
    funding: { ...funding, availableBalanceWei: 100n, allowanceWei: 100n },
    feeQuote,
    nowMs: 1_100,
    paymasterQuote: { paymasterId: '420gas.alpha', sponsoredGasWei: 5_000n, quoteId: 'quote-1', expiresAtMs: 2_000 },
  });
  assert.equal(auth.paymasterSponsoredWei, 1_000n);
  assert.equal(auth.workerRequiredWei, 100n);
  assert.equal(auth.paymasterQuoteId, 'quote-1');
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: pmBudget, funding, feeQuote, nowMs: 1_100 }), /AUT5_PAYMASTER_QUOTE_REQUIRED/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: pmBudget, funding, feeQuote, nowMs: 1_100, paymasterQuote: { paymasterId: 'wrong', sponsoredGasWei: 1n, quoteId: 'q', expiresAtMs: 2_000 } }), /AUT5_PAYMASTER_ID_MISMATCH/);
  assert.throws(() => authorizeAutomationFunding420({ plan, budget: pmBudget, funding, feeQuote, nowMs: 1_100, paymasterQuote: { paymasterId: '420gas.alpha', sponsoredGasWei: 1n, quoteId: 'q', expiresAtMs: 1_100 } }), /AUT5_PAYMASTER_QUOTE_EXPIRED/);
});

test('AUT-5 budget validation fails closed on malformed policy', () => {
  assert.throws(() => validateAutomationExecutionBudget420({ ...budget, maxPriorityFeePerGasWei: 11n }), /AUT5_PRIORITY_EXCEEDS_MAX_FEE/);
  assert.throws(() => validateAutomationExecutionBudget420({ ...budget, mode: 'paymaster' }), /AUT5_PAYMASTER_ID_INVALID/);
  assert.throws(() => validateAutomationExecutionBudget420({ ...budget, paymasterId: 'unexpected' }), /AUT5_PAYMASTER_UNEXPECTED/);
});
