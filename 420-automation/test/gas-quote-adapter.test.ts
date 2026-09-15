import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptCanonicalGasQuoteForAutomation420,
  createAutomationAttempt420,
} from '../src/index.js';
import type {
  AutomationGasQuoteBinding420,
  AutomationTransactionPlan420,
  CanonicalGasQuote420,
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

const attempt = createAutomationAttempt420({
  jobId: plan.jobId,
  occurrenceId: plan.occurrenceId,
  intentDigest: plan.intentDigest,
  nowMs: 1_000,
});

const binding: AutomationGasQuoteBinding420 = {
  paymasterId: '420gas.alpha',
  entryPoint: '0x3333333333333333333333333333333333333333',
  paymaster: '0x4444444444444444444444444444444444444444',
  account: '0x5555555555555555555555555555555555555555',
  policyId: `0x${'66'.repeat(32)}`,
  maxSponsoredCostWei: 1_000n,
};

function canonical(overrides: Partial<CanonicalGasQuote420> = {}): CanonicalGasQuote420 {
  return {
    schemaVersion: '1.1.0',
    chainId: '420',
    entryPoint: binding.entryPoint,
    paymaster: binding.paymaster,
    account: binding.account,
    sponsorshipDigest: `0x${'77'.repeat(32)}`,
    policyId: binding.policyId,
    authorizationId: attempt.attemptId,
    maxSponsoredCostWei: '900',
    validAfter: '1970-01-01T00:00:01.000Z',
    validUntil: '1970-01-01T00:00:02.000Z',
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

test('GAS-8.3 converts a canonical 420Gas quote into an attempt-bound Automation quote', () => {
  const adapted = adaptCanonicalGasQuoteForAutomation420({ quote: canonical(), binding, attempt, plan, nowMs: 1_100 });
  assert.equal(adapted.paymasterId, '420gas.alpha');
  assert.equal(adapted.sponsoredGasWei, 900n);
  assert.equal(adapted.attemptId, attempt.attemptId);
  assert.equal(adapted.sponsorshipDigest, `0x${'77'.repeat(32)}`);
  assert.equal(adapted.quoteId, `0x${'88'.repeat(32)}`);
  assert.equal(adapted.expiresAtMs, 2_000);
});

test('GAS-8.3 binds canonical authorizationId to the exact Automation attemptId', () => {
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({
    quote: canonical({ authorizationId: `0x${'99'.repeat(32)}` }),
    binding,
    attempt,
    plan,
    nowMs: 1_100,
  }), /GAS8_QUOTE_ATTEMPT_MISMATCH/);
});

test('GAS-8.3 rejects wrong chain, entrypoint, paymaster, account or policy', () => {
  const cases: Array<[Partial<CanonicalGasQuote420>, RegExp]> = [
    [{ chainId: '421' }, /GAS8_QUOTE_CHAIN_MISMATCH/],
    [{ entryPoint: '0x9999999999999999999999999999999999999999' }, /GAS8_QUOTE_ENTRYPOINT_MISMATCH/],
    [{ paymaster: '0x9999999999999999999999999999999999999999' }, /GAS8_QUOTE_PAYMASTER_MISMATCH/],
    [{ account: '0x9999999999999999999999999999999999999999' }, /GAS8_QUOTE_ACCOUNT_MISMATCH/],
    [{ policyId: `0x${'99'.repeat(32)}` }, /GAS8_QUOTE_POLICY_MISMATCH/],
  ];
  for (const [overrides, expected] of cases) {
    assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical(overrides), binding, attempt, plan, nowMs: 1_100 }), expected);
  }
});

test('GAS-8.3 rejects expired, future, malformed and over-budget quotes', () => {
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ validUntil: '1970-01-01T00:00:01.100Z' }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_EXPIRED/);
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ validAfter: '1970-01-01T00:00:01.200Z' }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_NOT_YET_VALID/);
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ maxSponsoredCostWei: '1001' }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_COST_EXCEEDED/);
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ sponsorshipDigest: '0x12' }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_SPONSORSHIP_DIGEST_INVALID/);
});

test('GAS-8.3 rejects any quote that claims execution or protocol authority', () => {
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ executionAuthorization: true }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_AUTHORITY_ESCALATION/);
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ targetProtocolAuthorization: true }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_AUTHORITY_ESCALATION/);
  assert.throws(() => adaptCanonicalGasQuoteForAutomation420({ quote: canonical({ canonicalProtocolAuthority: true }), binding, attempt, plan, nowMs: 1_100 }), /GAS8_QUOTE_AUTHORITY_ESCALATION/);
});
