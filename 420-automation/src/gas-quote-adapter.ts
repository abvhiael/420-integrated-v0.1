import type { AutomationTransactionPlan420 } from './execution.js';
import { automationFundingPlanDigest420, type AutomationFeeQuote420 } from './funding.js';
import type { AutomationAttemptPaymasterQuote420 } from './gas-integration.js';
import type { AutomationAttempt420 } from './recovery.js';

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

export interface CanonicalGasQuoteRequest420 {
  schemaVersion: '1.2.0';
  chainId: '420';
  entryPoint: string;
  paymaster: string;
  account: string;
  sponsorshipDigest: string;
  policyId: string;
  authorizationId: string;
  maxSponsoredCostWei: string;
  gasLimit: string;
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei: string;
  validAfter: string;
  validUntil: string;
}

export interface CanonicalGasQuote420 extends CanonicalGasQuoteRequest420 {
  quoteId: string;
  fundingMode: string;
  authority: string;
  executionAuthorization: boolean;
  walletAuthorization?: boolean;
  targetProtocolAuthorization: boolean;
  canonicalProtocolAuthority: boolean;
}

export interface AutomationGasQuoteBinding420 {
  paymasterId: string;
  entryPoint: string;
  paymaster: string;
  account: string;
  policyId: string;
  maxSponsoredCostWei: bigint;
}

function address420(value: string, code: string): string {
  if (!ADDRESS20.test(value)) throw new Error(code);
  return value.toLowerCase();
}

function hash32420(value: string, code: string): string {
  if (!HASH32.test(value)) throw new Error(code);
  return value.toLowerCase();
}

function parseTime420(value: string, code: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(code);
  return ms;
}

function uint420(value: string, code: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(code);
  return BigInt(value);
}

function assertAttemptPlanBinding420(attempt: AutomationAttempt420, plan: AutomationTransactionPlan420): void {
  if (attempt.state !== 'ready') throw new Error('GAS8_ATTEMPT_NOT_READY');
  if (attempt.jobId !== plan.jobId) throw new Error('GAS8_QUOTE_PLAN_ATTEMPT_MISMATCH');
  if (attempt.occurrenceId !== plan.occurrenceId.toLowerCase()) throw new Error('GAS8_QUOTE_PLAN_ATTEMPT_MISMATCH');
  if (attempt.intentDigest !== plan.intentDigest.toLowerCase()) throw new Error('GAS8_QUOTE_PLAN_ATTEMPT_MISMATCH');
}

function assertFeeQuote420(feeQuote: AutomationFeeQuote420): void {
  if (feeQuote.maxFeePerGasWei <= 0n) throw new Error('GAS9_MAX_FEE_INVALID');
  if (feeQuote.maxPriorityFeePerGasWei < 0n) throw new Error('GAS9_PRIORITY_FEE_INVALID');
  if (feeQuote.maxPriorityFeePerGasWei > feeQuote.maxFeePerGasWei) throw new Error('GAS9_PRIORITY_EXCEEDS_MAX_FEE');
}

export function buildCanonicalGasQuoteRequestForAutomation420(input: {
  binding: AutomationGasQuoteBinding420;
  attempt: AutomationAttempt420;
  plan: AutomationTransactionPlan420;
  feeQuote: AutomationFeeQuote420;
  sponsorshipDigest: string;
  requestedSponsoredCostWei: bigint;
  validAfterMs: number;
  validUntilMs: number;
}): CanonicalGasQuoteRequest420 {
  const { binding, attempt, plan, feeQuote } = input;
  assertAttemptPlanBinding420(attempt, plan);
  assertFeeQuote420(feeQuote);
  if (plan.chainId !== 420n) throw new Error('GAS8_REQUEST_CHAIN_MISMATCH');
  if (plan.gasLimit <= 0n) throw new Error('GAS9_GAS_LIMIT_INVALID');

  const entryPoint = address420(binding.entryPoint, 'GAS8_BINDING_ENTRYPOINT_INVALID');
  const paymaster = address420(binding.paymaster, 'GAS8_BINDING_PAYMASTER_INVALID');
  const account = address420(binding.account, 'GAS8_BINDING_ACCOUNT_INVALID');
  const policyId = hash32420(binding.policyId, 'GAS8_BINDING_POLICY_INVALID');
  const authorizationId = hash32420(attempt.attemptId, 'GAS8_ATTEMPT_ID_INVALID');
  const sponsorshipDigest = hash32420(input.sponsorshipDigest, 'GAS8_REQUEST_SPONSORSHIP_DIGEST_INVALID');

  if (binding.maxSponsoredCostWei <= 0n) throw new Error('GAS8_BINDING_COST_INVALID');
  if (input.requestedSponsoredCostWei <= 0n || input.requestedSponsoredCostWei > binding.maxSponsoredCostWei) throw new Error('GAS8_REQUEST_COST_EXCEEDED');
  if (!Number.isSafeInteger(input.validAfterMs) || !Number.isSafeInteger(input.validUntilMs) || input.validAfterMs < 0 || input.validUntilMs <= input.validAfterMs) throw new Error('GAS8_REQUEST_WINDOW_INVALID');

  return Object.freeze({
    schemaVersion: '1.2.0',
    chainId: '420',
    entryPoint,
    paymaster,
    account,
    sponsorshipDigest,
    policyId,
    authorizationId,
    maxSponsoredCostWei: input.requestedSponsoredCostWei.toString(10),
    gasLimit: plan.gasLimit.toString(10),
    maxFeePerGasWei: feeQuote.maxFeePerGasWei.toString(10),
    maxPriorityFeePerGasWei: feeQuote.maxPriorityFeePerGasWei.toString(10),
    validAfter: new Date(input.validAfterMs).toISOString(),
    validUntil: new Date(input.validUntilMs).toISOString(),
  });
}

export function adaptCanonicalGasQuoteForAutomation420(input: {
  quote: CanonicalGasQuote420;
  binding: AutomationGasQuoteBinding420;
  attempt: AutomationAttempt420;
  plan: AutomationTransactionPlan420;
  feeQuote: AutomationFeeQuote420;
  nowMs: number;
}): AutomationAttemptPaymasterQuote420 {
  const { quote, binding, attempt, plan, feeQuote } = input;
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('GAS8_QUOTE_NOW_INVALID');
  if (quote.schemaVersion !== '1.2.0') throw new Error('GAS8_QUOTE_SCHEMA_UNSUPPORTED');
  if (quote.chainId !== '420' || plan.chainId !== 420n) throw new Error('GAS8_QUOTE_CHAIN_MISMATCH');
  if (quote.fundingMode !== 'paymaster' || quote.authority !== 'funding-offer-only') throw new Error('GAS8_QUOTE_AUTHORITY_INVALID');
  if (quote.executionAuthorization || quote.walletAuthorization || quote.targetProtocolAuthorization || quote.canonicalProtocolAuthority) throw new Error('GAS8_QUOTE_AUTHORITY_ESCALATION');

  if (address420(quote.entryPoint, 'GAS8_QUOTE_ENTRYPOINT_INVALID') !== address420(binding.entryPoint, 'GAS8_BINDING_ENTRYPOINT_INVALID')) throw new Error('GAS8_QUOTE_ENTRYPOINT_MISMATCH');
  if (address420(quote.paymaster, 'GAS8_QUOTE_PAYMASTER_INVALID') !== address420(binding.paymaster, 'GAS8_BINDING_PAYMASTER_INVALID')) throw new Error('GAS8_QUOTE_PAYMASTER_MISMATCH');
  if (address420(quote.account, 'GAS8_QUOTE_ACCOUNT_INVALID') !== address420(binding.account, 'GAS8_BINDING_ACCOUNT_INVALID')) throw new Error('GAS8_QUOTE_ACCOUNT_MISMATCH');
  if (hash32420(quote.policyId, 'GAS8_QUOTE_POLICY_INVALID') !== hash32420(binding.policyId, 'GAS8_BINDING_POLICY_INVALID')) throw new Error('GAS8_QUOTE_POLICY_MISMATCH');

  const attemptId = hash32420(attempt.attemptId, 'GAS8_ATTEMPT_ID_INVALID');
  if (hash32420(quote.authorizationId, 'GAS8_QUOTE_AUTHORIZATION_ID_INVALID') !== attemptId) throw new Error('GAS8_QUOTE_ATTEMPT_MISMATCH');
  assertAttemptPlanBinding420(attempt, plan);
  assertFeeQuote420(feeQuote);

  const quotedGasLimit = uint420(quote.gasLimit, 'GAS9_QUOTE_GAS_LIMIT_INVALID');
  const quotedMaxFee = uint420(quote.maxFeePerGasWei, 'GAS9_QUOTE_MAX_FEE_INVALID');
  const quotedPriorityFee = uint420(quote.maxPriorityFeePerGasWei, 'GAS9_QUOTE_PRIORITY_FEE_INVALID');
  if (quotedGasLimit !== plan.gasLimit) throw new Error('GAS9_QUOTE_GAS_LIMIT_MISMATCH');
  if (quotedMaxFee !== feeQuote.maxFeePerGasWei) throw new Error('GAS9_QUOTE_MAX_FEE_MISMATCH');
  if (quotedPriorityFee !== feeQuote.maxPriorityFeePerGasWei) throw new Error('GAS9_QUOTE_PRIORITY_FEE_MISMATCH');
  if (quotedPriorityFee > quotedMaxFee) throw new Error('GAS9_QUOTE_PRIORITY_EXCEEDS_MAX_FEE');

  const validAfterMs = parseTime420(quote.validAfter, 'GAS8_QUOTE_VALID_AFTER_INVALID');
  const validUntilMs = parseTime420(quote.validUntil, 'GAS8_QUOTE_VALID_UNTIL_INVALID');
  if (validAfterMs > input.nowMs) throw new Error('GAS8_QUOTE_NOT_YET_VALID');
  if (validUntilMs <= input.nowMs) throw new Error('GAS8_QUOTE_EXPIRED');
  if (validUntilMs <= validAfterMs) throw new Error('GAS8_QUOTE_WINDOW_INVALID');

  const sponsoredGasWei = uint420(quote.maxSponsoredCostWei, 'GAS8_QUOTE_COST_INVALID');
  if (sponsoredGasWei <= 0n || sponsoredGasWei > binding.maxSponsoredCostWei) throw new Error('GAS8_QUOTE_COST_EXCEEDED');

  return {
    paymasterId: binding.paymasterId,
    sponsoredGasWei,
    quoteId: hash32420(quote.quoteId, 'GAS8_QUOTE_ID_INVALID'),
    expiresAtMs: validUntilMs,
    planDigest: automationFundingPlanDigest420(plan),
    sponsorshipDigest: hash32420(quote.sponsorshipDigest, 'GAS8_QUOTE_SPONSORSHIP_DIGEST_INVALID'),
    attemptId,
  };
}
