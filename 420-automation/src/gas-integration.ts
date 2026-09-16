import { createHash } from 'node:crypto';
import type { AutomationTransactionPlan420 } from './execution.js';
import {
  authorizeAutomationFunding420,
  type AutomationBudgetAuthorization420,
  type AutomationExecutionBudget420,
  type AutomationFeeQuote420,
  type AutomationFundingPolicy420,
  type AutomationFundingSnapshot420,
  type AutomationPaymasterQuote420,
} from './funding.js';
import type { AutomationAttempt420 } from './recovery.js';

const HASH32 = /^0x[0-9a-fA-F]{64}$/;

export interface AutomationAttemptPaymasterQuote420 extends AutomationPaymasterQuote420 {
  attemptId: string;
}

export interface AutomationSponsoredAttemptAuthorization420 extends AutomationBudgetAuthorization420 {
  paymasterAttemptId: string;
}

function digest420(material: string): string {
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

function hash32420(value: string, code: string): string {
  if (!HASH32.test(value)) throw new Error(code);
  return value.toLowerCase();
}

export function authorizeAutomationSponsoredAttempt420(input: {
  attempt: AutomationAttempt420;
  plan: AutomationTransactionPlan420;
  budget: AutomationExecutionBudget420;
  funding: AutomationFundingSnapshot420;
  feeQuote: AutomationFeeQuote420;
  nowMs: number;
  paymasterQuote: AutomationAttemptPaymasterQuote420;
  policy?: AutomationFundingPolicy420;
}): AutomationSponsoredAttemptAuthorization420 {
  if (input.budget.mode !== 'paymaster') throw new Error('GAS8_PAYMASTER_MODE_REQUIRED');
  if (input.attempt.state !== 'ready') throw new Error('GAS8_ATTEMPT_NOT_READY');

  const attemptId = hash32420(input.attempt.attemptId, 'GAS8_ATTEMPT_ID_INVALID');
  const quotedAttemptId = hash32420(input.paymasterQuote.attemptId, 'GAS8_QUOTE_ATTEMPT_ID_INVALID');
  if (quotedAttemptId !== attemptId) throw new Error('GAS8_ATTEMPT_BINDING_MISMATCH');

  if (input.attempt.jobId !== input.plan.jobId) throw new Error('GAS8_ATTEMPT_JOB_MISMATCH');
  if (input.attempt.occurrenceId !== input.plan.occurrenceId.toLowerCase()) throw new Error('GAS8_ATTEMPT_OCCURRENCE_MISMATCH');
  if (input.attempt.intentDigest !== input.plan.intentDigest.toLowerCase()) throw new Error('GAS8_ATTEMPT_INTENT_MISMATCH');

  const authorization = authorizeAutomationFunding420({
    plan: input.plan,
    budget: input.budget,
    funding: input.funding,
    feeQuote: input.feeQuote,
    nowMs: input.nowMs,
    paymasterQuote: input.paymasterQuote,
    policy: input.policy,
  });

  if (
    authorization.fundingMode !== 'paymaster'
      || authorization.paymasterQuoteId === null
      || authorization.paymasterPlanDigest === null
      || authorization.sponsorshipDigest === null
  ) throw new Error('GAS8_SPONSORSHIP_AUTHORIZATION_INCOMPLETE');

  return {
    ...authorization,
    paymasterAttemptId: attemptId,
    authorizationDigest: digest420([
      '420Automation/gas-sponsored-attempt/v1',
      authorization.authorizationDigest,
      attemptId,
      authorization.paymasterQuoteId,
      authorization.paymasterPlanDigest,
      authorization.sponsorshipDigest,
    ].join('|')),
  };
}
