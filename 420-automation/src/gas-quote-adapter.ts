import type { AutomationTransactionPlan420 } from './execution.js';
import { automationFundingPlanDigest420 } from './funding.js';
import type { AutomationAttemptPaymasterQuote420 } from './gas-integration.js';
import type { AutomationAttempt420 } from './recovery.js';

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

export interface CanonicalGasQuote420 {
  schemaVersion: string;
  chainId: string;
  entryPoint: string;
  paymaster: string;
  account: string;
  sponsorshipDigest: string;
  policyId: string;
  authorizationId: string;
  maxSponsoredCostWei: string;
  validAfter: string;
  validUntil: string;
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

export function adaptCanonicalGasQuoteForAutomation420(input: {
  quote: CanonicalGasQuote420;
  binding: AutomationGasQuoteBinding420;
  attempt: AutomationAttempt420;
  plan: AutomationTransactionPlan420;
  nowMs: number;
}): AutomationAttemptPaymasterQuote420 {
  const { quote, binding, attempt, plan } = input;
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('GAS8_QUOTE_NOW_INVALID');
  if (quote.schemaVersion !== '1.1.0') throw new Error('GAS8_QUOTE_SCHEMA_UNSUPPORTED');
  if (quote.chainId !== '420' || plan.chainId !== 420n) throw new Error('GAS8_QUOTE_CHAIN_MISMATCH');
  if (quote.fundingMode !== 'paymaster' || quote.authority !== 'funding-offer-only') throw new Error('GAS8_QUOTE_AUTHORITY_INVALID');
  if (quote.executionAuthorization || quote.targetProtocolAuthorization || quote.canonicalProtocolAuthority) throw new Error('GAS8_QUOTE_AUTHORITY_ESCALATION');

  if (address420(quote.entryPoint, 'GAS8_QUOTE_ENTRYPOINT_INVALID') !== address420(binding.entryPoint, 'GAS8_BINDING_ENTRYPOINT_INVALID')) throw new Error('GAS8_QUOTE_ENTRYPOINT_MISMATCH');
  if (address420(quote.paymaster, 'GAS8_QUOTE_PAYMASTER_INVALID') !== address420(binding.paymaster, 'GAS8_BINDING_PAYMASTER_INVALID')) throw new Error('GAS8_QUOTE_PAYMASTER_MISMATCH');
  if (address420(quote.account, 'GAS8_QUOTE_ACCOUNT_INVALID') !== address420(binding.account, 'GAS8_BINDING_ACCOUNT_INVALID')) throw new Error('GAS8_QUOTE_ACCOUNT_MISMATCH');
  if (hash32420(quote.policyId, 'GAS8_QUOTE_POLICY_INVALID') !== hash32420(binding.policyId, 'GAS8_BINDING_POLICY_INVALID')) throw new Error('GAS8_QUOTE_POLICY_MISMATCH');

  const attemptId = hash32420(attempt.attemptId, 'GAS8_ATTEMPT_ID_INVALID');
  if (hash32420(quote.authorizationId, 'GAS8_QUOTE_AUTHORIZATION_ID_INVALID') !== attemptId) throw new Error('GAS8_QUOTE_ATTEMPT_MISMATCH');
  if (attempt.jobId !== plan.jobId || attempt.occurrenceId !== plan.occurrenceId.toLowerCase() || attempt.intentDigest !== plan.intentDigest.toLowerCase()) throw new Error('GAS8_QUOTE_PLAN_ATTEMPT_MISMATCH');

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
