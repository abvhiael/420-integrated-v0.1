import type { AutomationTransactionPlan420 } from './execution.js';
import {
  authorizeAutomationFunding420,
  automationFundingPlanDigest420,
  type AutomationBudgetAuthorization420,
  type AutomationExecutionBudget420,
  type AutomationFeeQuote420,
  type AutomationFundingPolicy420,
  type AutomationFundingSnapshot420,
} from './funding.js';
import {
  adaptCanonicalGasQuoteForAutomation420,
  buildCanonicalGasQuoteRequestForAutomation420,
  type AutomationGasQuoteBinding420,
  type CanonicalGasQuote420,
  type CanonicalGasQuoteRequest420,
} from './gas-quote-adapter.js';
import { authorizeAutomationSponsoredAttempt420, type AutomationSponsoredAttemptAuthorization420 } from './gas-integration.js';
import type { AutomationAttempt420 } from './recovery.js';

export type AutomationGasQuoteClientResult420 =
  | { status: 'quote'; quote: CanonicalGasQuote420 }
  | { status: 'unavailable'; code: string };

export interface AutomationGasQuoteClient420 {
  requestQuote(request: CanonicalGasQuoteRequest420): Promise<AutomationGasQuoteClientResult420>;
}

export interface AutomationGasPreparationPolicy420 {
  allowSelfFundedFallback: boolean;
  quoteValidityMs: number;
}

export const DEFAULT_GAS8_PREPARATION_POLICY_420: AutomationGasPreparationPolicy420 = Object.freeze({
  allowSelfFundedFallback: false,
  quoteValidityMs: 30_000,
});

export type AutomationGasPreparation420 =
  | {
      fundingMode: 'paymaster';
      request: CanonicalGasQuoteRequest420;
      authorization: AutomationSponsoredAttemptAuthorization420;
      fallbackReason: null;
    }
  | {
      fundingMode: 'worker';
      request: CanonicalGasQuoteRequest420;
      authorization: AutomationBudgetAuthorization420;
      fallbackReason: string;
    };

function validatePreparationPolicy420(policy: AutomationGasPreparationPolicy420): void {
  if (typeof policy.allowSelfFundedFallback !== 'boolean') throw new Error('GAS8_FALLBACK_POLICY_INVALID');
  if (!Number.isSafeInteger(policy.quoteValidityMs) || policy.quoteValidityMs < 1 || policy.quoteValidityMs > 300_000) throw new Error('GAS8_QUOTE_VALIDITY_INVALID');
}

function requestedSponsoredCost420(plan: AutomationTransactionPlan420, feeQuote: AutomationFeeQuote420, binding: AutomationGasQuoteBinding420): bigint {
  const gasCost = plan.gasLimit * feeQuote.maxFeePerGasWei;
  if (gasCost <= 0n) throw new Error('GAS8_REQUEST_COST_INVALID');
  return gasCost < binding.maxSponsoredCostWei ? gasCost : binding.maxSponsoredCostWei;
}

export async function prepareAutomationGasFunding420(input: {
  attempt: AutomationAttempt420;
  plan: AutomationTransactionPlan420;
  budget: AutomationExecutionBudget420;
  funding: AutomationFundingSnapshot420;
  feeQuote: AutomationFeeQuote420;
  binding: AutomationGasQuoteBinding420;
  sponsorshipDigest: string;
  nowMs: number;
  client: AutomationGasQuoteClient420;
  preparationPolicy?: AutomationGasPreparationPolicy420;
  fundingPolicy?: AutomationFundingPolicy420;
}): Promise<AutomationGasPreparation420> {
  if (input.budget.mode !== 'paymaster') throw new Error('GAS8_PAYMASTER_MODE_REQUIRED');
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('GAS8_PREPARATION_NOW_INVALID');
  const preparationPolicy = input.preparationPolicy ?? DEFAULT_GAS8_PREPARATION_POLICY_420;
  validatePreparationPolicy420(preparationPolicy);

  const pinnedPlanDigest = automationFundingPlanDigest420(input.plan);
  const request = buildCanonicalGasQuoteRequestForAutomation420({
    binding: input.binding,
    attempt: input.attempt,
    plan: input.plan,
    feeQuote: input.feeQuote,
    sponsorshipDigest: input.sponsorshipDigest,
    requestedSponsoredCostWei: requestedSponsoredCost420(input.plan, input.feeQuote, input.binding),
    validAfterMs: input.nowMs,
    validUntilMs: input.nowMs + preparationPolicy.quoteValidityMs,
  });

  const result = await input.client.requestQuote(request);
  if (automationFundingPlanDigest420(input.plan) !== pinnedPlanDigest) throw new Error('GAS8_PLAN_MUTATED_DURING_QUOTE');

  if (result.status === 'quote') {
    const paymasterQuote = adaptCanonicalGasQuoteForAutomation420({
      quote: result.quote,
      binding: input.binding,
      attempt: input.attempt,
      plan: input.plan,
      feeQuote: input.feeQuote,
      nowMs: input.nowMs,
    });
    const authorization = authorizeAutomationSponsoredAttempt420({
      attempt: input.attempt,
      plan: input.plan,
      budget: input.budget,
      funding: input.funding,
      feeQuote: input.feeQuote,
      nowMs: input.nowMs,
      paymasterQuote,
      policy: input.fundingPolicy,
    });
    return { fundingMode: 'paymaster', request, authorization, fallbackReason: null };
  }

  if (!preparationPolicy.allowSelfFundedFallback) throw new Error(`GAS8_SPONSORSHIP_UNAVAILABLE:${result.code}`);
  if (typeof result.code !== 'string' || result.code.length === 0 || result.code.length > 128) throw new Error('GAS8_FALLBACK_REASON_INVALID');

  const workerBudget: AutomationExecutionBudget420 = {
    ...input.budget,
    mode: 'worker',
    paymasterId: undefined,
  };
  const authorization = authorizeAutomationFunding420({
    plan: input.plan,
    budget: workerBudget,
    funding: input.funding,
    feeQuote: input.feeQuote,
    nowMs: input.nowMs,
    policy: input.fundingPolicy,
  });
  return { fundingMode: 'worker', request, authorization, fallbackReason: result.code };
}
