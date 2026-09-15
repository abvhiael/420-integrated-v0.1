import { createHash } from 'node:crypto';
import type { AutomationTransactionPlan420 } from './execution.js';

export type AutomationFundingMode420 = 'worker' | 'escrow' | 'paymaster';

export interface AutomationExecutionBudget420 {
  jobId: string;
  mode: AutomationFundingMode420;
  maxFeePerGasWei: bigint;
  maxPriorityFeePerGasWei: bigint;
  maxGasCostWei: bigint;
  maxNativeValueWei: bigint;
  maxTotalCostWei: bigint;
  maxReimbursementWei: bigint;
  paymasterId?: string;
}

export interface AutomationFundingSnapshot420 {
  jobId: string;
  availableBalanceWei: bigint;
  allowanceWei: bigint;
  observedAtMs: number;
}

export interface AutomationFeeQuote420 {
  maxFeePerGasWei: bigint;
  maxPriorityFeePerGasWei: bigint;
  observedAtMs: number;
}

export interface AutomationPaymasterQuote420 {
  paymasterId: string;
  sponsoredGasWei: bigint;
  quoteId: string;
  expiresAtMs: number;
  planDigest: string;
  sponsorshipDigest: string;
}

export interface AutomationFundingPolicy420 {
  maxQuoteAgeMs: number;
  maxFundingObservationAgeMs: number;
}

export const DEFAULT_AUT5_POLICY_420: AutomationFundingPolicy420 = {
  maxQuoteAgeMs: 15_000,
  maxFundingObservationAgeMs: 15_000,
};

export interface AutomationBudgetAuthorization420 {
  jobId: string;
  occurrenceId: string;
  fundingMode: AutomationFundingMode420;
  gasCostCeilingWei: bigint;
  nativeValueWei: bigint;
  totalCostCeilingWei: bigint;
  reimbursementCeilingWei: bigint;
  workerRequiredWei: bigint;
  paymasterSponsoredWei: bigint;
  paymasterQuoteId: string | null;
  paymasterPlanDigest: string | null;
  sponsorshipDigest: string | null;
  authorizationDigest: string;
}

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

function digest420(material: string): string {
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

function bytes32420(value: string, code: string): string {
  if (!BYTES32_RE.test(value)) throw new Error(code);
  return value.toLowerCase();
}

function assertNonNegative420(value: bigint, code: string): void {
  if (value < 0n) throw new Error(code);
}

export function automationFundingPlanDigest420(plan: AutomationTransactionPlan420): string {
  const material = [
    '420Automation/gas-plan/v1',
    plan.chainId.toString(10),
    plan.jobId,
    plan.occurrenceId.toLowerCase(),
    plan.workerId,
    plan.from.toLowerCase(),
    plan.to.toLowerCase(),
    plan.data.toLowerCase(),
    plan.valueWei.toString(10),
    plan.gasLimit.toString(10),
    plan.envelopeDigest.toLowerCase(),
    plan.intentDigest.toLowerCase(),
  ].join('|');
  return digest420(material);
}

export function validateAutomationExecutionBudget420(budget: AutomationExecutionBudget420): void {
  if (budget.jobId.length === 0 || budget.jobId.length > 128) throw new Error('AUT5_JOB_ID_INVALID');
  assertNonNegative420(budget.maxFeePerGasWei, 'AUT5_MAX_FEE_INVALID');
  assertNonNegative420(budget.maxPriorityFeePerGasWei, 'AUT5_PRIORITY_FEE_INVALID');
  assertNonNegative420(budget.maxGasCostWei, 'AUT5_GAS_BUDGET_INVALID');
  assertNonNegative420(budget.maxNativeValueWei, 'AUT5_VALUE_BUDGET_INVALID');
  assertNonNegative420(budget.maxTotalCostWei, 'AUT5_TOTAL_BUDGET_INVALID');
  assertNonNegative420(budget.maxReimbursementWei, 'AUT5_REIMBURSEMENT_INVALID');
  if (budget.maxPriorityFeePerGasWei > budget.maxFeePerGasWei) throw new Error('AUT5_PRIORITY_EXCEEDS_MAX_FEE');
  if (budget.mode === 'paymaster') {
    if (!budget.paymasterId || budget.paymasterId.length > 128) throw new Error('AUT5_PAYMASTER_ID_INVALID');
  } else if (budget.paymasterId !== undefined) {
    throw new Error('AUT5_PAYMASTER_UNEXPECTED');
  }
}

export function authorizeAutomationFunding420(input: {
  plan: AutomationTransactionPlan420;
  budget: AutomationExecutionBudget420;
  funding: AutomationFundingSnapshot420;
  feeQuote: AutomationFeeQuote420;
  nowMs: number;
  paymasterQuote?: AutomationPaymasterQuote420;
  policy?: AutomationFundingPolicy420;
}): AutomationBudgetAuthorization420 {
  const policy = input.policy ?? DEFAULT_AUT5_POLICY_420;
  validateAutomationExecutionBudget420(input.budget);
  if (input.plan.jobId !== input.budget.jobId || input.funding.jobId !== input.plan.jobId) throw new Error('AUT5_JOB_BINDING_MISMATCH');
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('AUT5_NOW_INVALID');
  if (!Number.isSafeInteger(input.funding.observedAtMs) || input.funding.observedAtMs < 0 || input.funding.observedAtMs > input.nowMs || input.nowMs - input.funding.observedAtMs > policy.maxFundingObservationAgeMs) throw new Error('AUT5_FUNDING_STALE');
  if (!Number.isSafeInteger(input.feeQuote.observedAtMs) || input.feeQuote.observedAtMs < 0 || input.feeQuote.observedAtMs > input.nowMs || input.nowMs - input.feeQuote.observedAtMs > policy.maxQuoteAgeMs) throw new Error('AUT5_FEE_QUOTE_STALE');
  assertNonNegative420(input.funding.availableBalanceWei, 'AUT5_BALANCE_INVALID');
  assertNonNegative420(input.funding.allowanceWei, 'AUT5_ALLOWANCE_INVALID');
  assertNonNegative420(input.feeQuote.maxFeePerGasWei, 'AUT5_QUOTED_FEE_INVALID');
  assertNonNegative420(input.feeQuote.maxPriorityFeePerGasWei, 'AUT5_QUOTED_PRIORITY_INVALID');
  if (input.feeQuote.maxPriorityFeePerGasWei > input.feeQuote.maxFeePerGasWei) throw new Error('AUT5_QUOTED_PRIORITY_EXCEEDS_FEE');
  if (input.feeQuote.maxFeePerGasWei > input.budget.maxFeePerGasWei) throw new Error('AUT5_FEE_CAP_EXCEEDED');
  if (input.feeQuote.maxPriorityFeePerGasWei > input.budget.maxPriorityFeePerGasWei) throw new Error('AUT5_PRIORITY_CAP_EXCEEDED');
  if (input.plan.valueWei > input.budget.maxNativeValueWei) throw new Error('AUT5_NATIVE_VALUE_CAP_EXCEEDED');

  const gasCost = input.plan.gasLimit * input.feeQuote.maxFeePerGasWei;
  if (gasCost > input.budget.maxGasCostWei) throw new Error('AUT5_GAS_COST_CAP_EXCEEDED');
  const total = gasCost + input.plan.valueWei;
  if (total > input.budget.maxTotalCostWei) throw new Error('AUT5_TOTAL_COST_CAP_EXCEEDED');

  let sponsored = 0n;
  let quoteId: string | null = null;
  let paymasterPlanDigest: string | null = null;
  let sponsorshipDigest: string | null = null;
  if (input.budget.mode === 'paymaster') {
    const quote = input.paymasterQuote;
    if (!quote) throw new Error('AUT5_PAYMASTER_QUOTE_REQUIRED');
    if (quote.paymasterId !== input.budget.paymasterId) throw new Error('AUT5_PAYMASTER_ID_MISMATCH');
    if (!Number.isSafeInteger(quote.expiresAtMs) || quote.expiresAtMs <= input.nowMs) throw new Error('AUT5_PAYMASTER_QUOTE_EXPIRED');
    if (quote.quoteId.length === 0 || quote.quoteId.length > 128) throw new Error('AUT5_PAYMASTER_QUOTE_ID_INVALID');
    assertNonNegative420(quote.sponsoredGasWei, 'AUT5_PAYMASTER_SPONSORSHIP_INVALID');
    paymasterPlanDigest = bytes32420(quote.planDigest, 'GAS8_PLAN_DIGEST_INVALID');
    sponsorshipDigest = bytes32420(quote.sponsorshipDigest, 'GAS8_SPONSORSHIP_DIGEST_INVALID');
    const expectedPlanDigest = automationFundingPlanDigest420(input.plan);
    if (paymasterPlanDigest !== expectedPlanDigest) throw new Error('GAS8_PLAN_BINDING_MISMATCH');
    sponsored = quote.sponsoredGasWei > gasCost ? gasCost : quote.sponsoredGasWei;
    quoteId = quote.quoteId;
  } else if (input.paymasterQuote !== undefined) {
    throw new Error('AUT5_PAYMASTER_QUOTE_UNEXPECTED');
  }

  const workerRequired = total - sponsored;
  if (input.funding.availableBalanceWei < workerRequired) throw new Error('AUT5_INSUFFICIENT_BALANCE');
  if (input.funding.allowanceWei < workerRequired) throw new Error('AUT5_INSUFFICIENT_ALLOWANCE');
  const reimbursement = gasCost < input.budget.maxReimbursementWei ? gasCost : input.budget.maxReimbursementWei;
  const material = [
    '420Automation/funding/v2',
    input.plan.intentDigest,
    input.budget.mode,
    input.feeQuote.maxFeePerGasWei.toString(10),
    input.feeQuote.maxPriorityFeePerGasWei.toString(10),
    gasCost.toString(10),
    total.toString(10),
    reimbursement.toString(10),
    workerRequired.toString(10),
    sponsored.toString(10),
    quoteId ?? 'none',
    paymasterPlanDigest ?? 'none',
    sponsorshipDigest ?? 'none',
  ].join('|');
  return {
    jobId: input.plan.jobId,
    occurrenceId: input.plan.occurrenceId,
    fundingMode: input.budget.mode,
    gasCostCeilingWei: gasCost,
    nativeValueWei: input.plan.valueWei,
    totalCostCeilingWei: total,
    reimbursementCeilingWei: reimbursement,
    workerRequiredWei: workerRequired,
    paymasterSponsoredWei: sponsored,
    paymasterQuoteId: quoteId,
    paymasterPlanDigest,
    sponsorshipDigest,
    authorizationDigest: digest420(material),
  };
}
