import { createHash } from 'node:crypto';
import type { AutomationExecutionReceipt420 } from './execution.js';

export interface AutomationRetryPolicy420 {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  ambiguityHoldMs: number;
  maxEvidenceAgeMs: number;
}

export const DEFAULT_AUTOMATION_RETRY_POLICY_420: AutomationRetryPolicy420 = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  ambiguityHoldMs: 15_000,
  maxEvidenceAgeMs: 15_000,
};

export type AutomationAttemptState420 =
  | 'ready'
  | 'submitted'
  | 'retry-wait'
  | 'ambiguous'
  | 'confirmed'
  | 'terminal';

export interface AutomationAttempt420 {
  jobId: string;
  occurrenceId: string;
  intentDigest: string;
  attemptNumber: number;
  attemptId: string;
  state: AutomationAttemptState420;
  createdAtMs: number;
  updatedAtMs: number;
  nextAttemptAtMs: number | null;
  transactionHash: string | null;
  terminalCode: string | null;
}

export interface AutomationRecoveryEvidence420 {
  chainId: bigint;
  canonicalSafe: boolean;
  observedAtMs: number;
}

export type AutomationAmbiguityResolution420 =
  | ({ status: 'accepted'; transactionHash: string } & AutomationRecoveryEvidence420)
  | ({ status: 'not-submitted' } & AutomationRecoveryEvidence420);

export type AutomationTransactionRecovery420 =
  | ({ status: 'pending' } & AutomationRecoveryEvidence420)
  | ({ status: 'canonical' } & AutomationRecoveryEvidence420)
  | ({ status: 'finalized' } & AutomationRecoveryEvidence420)
  | ({ status: 'reorged'; safeNonInclusion: boolean } & AutomationRecoveryEvidence420)
  | ({ status: 'not-found' } & AutomationRecoveryEvidence420);

const HASH32 = /^0x[0-9a-fA-F]{64}$/;

function hash420(material: string): string {
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

function assertHash420(value: string, code: string): void {
  if (!HASH32.test(value)) throw new Error(code);
}

function assertFiniteTimestamp420(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
}

export function validateAutomationRetryPolicy420(policy: AutomationRetryPolicy420): AutomationRetryPolicy420 {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 20) throw new Error('AUT6_MAX_ATTEMPTS_INVALID');
  if (!Number.isInteger(policy.baseDelayMs) || policy.baseDelayMs < 1) throw new Error('AUT6_BASE_DELAY_INVALID');
  if (!Number.isInteger(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) throw new Error('AUT6_MAX_DELAY_INVALID');
  if (!Number.isInteger(policy.ambiguityHoldMs) || policy.ambiguityHoldMs < 1) throw new Error('AUT6_AMBIGUITY_HOLD_INVALID');
  if (!Number.isInteger(policy.maxEvidenceAgeMs) || policy.maxEvidenceAgeMs < 1) throw new Error('AUT6_EVIDENCE_AGE_INVALID');
  return { ...policy };
}

export function automationRetryDelayMs420(attemptNumber: number, policy: AutomationRetryPolicy420 = DEFAULT_AUTOMATION_RETRY_POLICY_420): number {
  validateAutomationRetryPolicy420(policy);
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error('AUT6_ATTEMPT_NUMBER_INVALID');
  const exponent = Math.max(0, attemptNumber - 1);
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent);
}

export function deriveAutomationAttemptId420(jobId: string, occurrenceId: string, intentDigest: string, attemptNumber: number): string {
  if (jobId.length === 0 || jobId.length > 256) throw new Error('AUT6_JOB_ID_INVALID');
  assertHash420(occurrenceId, 'AUT6_OCCURRENCE_ID_INVALID');
  assertHash420(intentDigest, 'AUT6_INTENT_DIGEST_INVALID');
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error('AUT6_ATTEMPT_NUMBER_INVALID');
  return hash420(['420Automation/attempt/v1', jobId, occurrenceId.toLowerCase(), intentDigest.toLowerCase(), String(attemptNumber)].join('|'));
}

export function createAutomationAttempt420(input: {
  jobId: string;
  occurrenceId: string;
  intentDigest: string;
  attemptNumber?: number;
  nowMs: number;
}): AutomationAttempt420 {
  const attemptNumber = input.attemptNumber ?? 1;
  assertFiniteTimestamp420(input.nowMs, 'AUT6_TIME_INVALID');
  const attemptId = deriveAutomationAttemptId420(input.jobId, input.occurrenceId, input.intentDigest, attemptNumber);
  return {
    jobId: input.jobId,
    occurrenceId: input.occurrenceId.toLowerCase(),
    intentDigest: input.intentDigest.toLowerCase(),
    attemptNumber,
    attemptId,
    state: 'ready',
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
    nextAttemptAtMs: null,
    transactionHash: null,
    terminalCode: null,
  };
}

function assertReceiptBinding420(attempt: AutomationAttempt420, receipt: AutomationExecutionReceipt420): void {
  if (attempt.jobId !== receipt.jobId) throw new Error('AUT6_JOB_ID_MISMATCH');
  if (attempt.occurrenceId !== receipt.occurrenceId.toLowerCase()) throw new Error('AUT6_OCCURRENCE_ID_MISMATCH');
  if (attempt.intentDigest !== receipt.intentDigest.toLowerCase()) throw new Error('AUT6_INTENT_DIGEST_MISMATCH');
  if (attempt.state !== 'ready') throw new Error('AUT6_ATTEMPT_NOT_READY');
}

function retryOrTerminal420(attempt: AutomationAttempt420, code: string, policy: AutomationRetryPolicy420, nowMs: number): AutomationAttempt420 {
  if (attempt.attemptNumber >= policy.maxAttempts) {
    return { ...attempt, state: 'terminal', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: 'AUT6_MAX_ATTEMPTS_EXHAUSTED' };
  }
  return {
    ...attempt,
    state: 'retry-wait',
    updatedAtMs: nowMs,
    nextAttemptAtMs: nowMs + automationRetryDelayMs420(attempt.attemptNumber, policy),
    terminalCode: code,
  };
}

export function applyAutomationExecutionReceipt420(
  attempt: AutomationAttempt420,
  receipt: AutomationExecutionReceipt420,
  nowMs: number,
  policy: AutomationRetryPolicy420 = DEFAULT_AUTOMATION_RETRY_POLICY_420,
): AutomationAttempt420 {
  validateAutomationRetryPolicy420(policy);
  assertFiniteTimestamp420(nowMs, 'AUT6_TIME_INVALID');
  assertReceiptBinding420(attempt, receipt);
  if (receipt.status === 'submitted') {
    if (receipt.transactionHash === null) throw new Error('AUT6_TRANSACTION_HASH_REQUIRED');
    assertHash420(receipt.transactionHash, 'AUT6_TRANSACTION_HASH_INVALID');
    return { ...attempt, state: 'submitted', updatedAtMs: nowMs, transactionHash: receipt.transactionHash.toLowerCase(), terminalCode: null };
  }
  if (receipt.status === 'ambiguous') {
    return { ...attempt, state: 'ambiguous', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: receipt.code ?? 'AUT6_AMBIGUOUS_SUBMISSION' };
  }
  if (!receipt.retryable) {
    return { ...attempt, state: 'terminal', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: receipt.code ?? 'AUT6_NON_RETRYABLE_REJECTION' };
  }
  return retryOrTerminal420(attempt, receipt.code ?? 'AUT6_RETRYABLE_REJECTION', policy, nowMs);
}

function assertRecoveryEvidence420(evidence: AutomationRecoveryEvidence420, nowMs: number, policy: AutomationRetryPolicy420): void {
  if (evidence.chainId !== 420n) throw new Error('AUT6_RECOVERY_CHAIN_ID_MISMATCH');
  if (!evidence.canonicalSafe) throw new Error('AUT6_RECOVERY_NOT_CANONICAL_SAFE');
  assertFiniteTimestamp420(evidence.observedAtMs, 'AUT6_RECOVERY_TIME_INVALID');
  if (evidence.observedAtMs > nowMs || nowMs - evidence.observedAtMs > policy.maxEvidenceAgeMs) throw new Error('AUT6_RECOVERY_EVIDENCE_STALE');
}

export function resolveAutomationAmbiguity420(
  attempt: AutomationAttempt420,
  resolution: AutomationAmbiguityResolution420,
  nowMs: number,
  policy: AutomationRetryPolicy420 = DEFAULT_AUTOMATION_RETRY_POLICY_420,
): AutomationAttempt420 {
  validateAutomationRetryPolicy420(policy);
  assertFiniteTimestamp420(nowMs, 'AUT6_TIME_INVALID');
  if (attempt.state !== 'ambiguous') throw new Error('AUT6_ATTEMPT_NOT_AMBIGUOUS');
  assertRecoveryEvidence420(resolution, nowMs, policy);
  if (resolution.status === 'accepted') {
    assertHash420(resolution.transactionHash, 'AUT6_TRANSACTION_HASH_INVALID');
    return { ...attempt, state: 'submitted', updatedAtMs: nowMs, transactionHash: resolution.transactionHash.toLowerCase(), nextAttemptAtMs: null, terminalCode: null };
  }
  if (nowMs - attempt.updatedAtMs < policy.ambiguityHoldMs) throw new Error('AUT6_AMBIGUITY_HOLD_ACTIVE');
  return retryOrTerminal420(attempt, 'AUT6_AMBIGUITY_RESOLVED_NOT_SUBMITTED', policy, nowMs);
}

export function observeAutomationTransaction420(
  attempt: AutomationAttempt420,
  observation: AutomationTransactionRecovery420,
  nowMs: number,
  policy: AutomationRetryPolicy420 = DEFAULT_AUTOMATION_RETRY_POLICY_420,
): AutomationAttempt420 {
  validateAutomationRetryPolicy420(policy);
  assertFiniteTimestamp420(nowMs, 'AUT6_TIME_INVALID');
  if (attempt.state !== 'submitted') throw new Error('AUT6_ATTEMPT_NOT_SUBMITTED');
  assertRecoveryEvidence420(observation, nowMs, policy);
  if (observation.status === 'finalized') {
    return { ...attempt, state: 'confirmed', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: null };
  }
  if (observation.status === 'reorged') {
    if (!observation.safeNonInclusion) return { ...attempt, state: 'ambiguous', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: 'AUT6_REORG_INCLUSION_UNCERTAIN' };
    return retryOrTerminal420(attempt, 'AUT6_REORG_SAFE_NON_INCLUSION', policy, nowMs);
  }
  if (observation.status === 'not-found') {
    return { ...attempt, state: 'ambiguous', updatedAtMs: nowMs, nextAttemptAtMs: null, terminalCode: 'AUT6_TRANSACTION_NOT_FOUND_UNCERTAIN' };
  }
  return { ...attempt, updatedAtMs: nowMs };
}

export function openAutomationRetryAttempt420(
  previous: AutomationAttempt420,
  nowMs: number,
  policy: AutomationRetryPolicy420 = DEFAULT_AUTOMATION_RETRY_POLICY_420,
): AutomationAttempt420 {
  validateAutomationRetryPolicy420(policy);
  assertFiniteTimestamp420(nowMs, 'AUT6_TIME_INVALID');
  if (previous.state !== 'retry-wait' || previous.nextAttemptAtMs === null) throw new Error('AUT6_RETRY_NOT_SCHEDULED');
  if (nowMs < previous.nextAttemptAtMs) throw new Error('AUT6_RETRY_NOT_DUE');
  if (previous.attemptNumber >= policy.maxAttempts) throw new Error('AUT6_MAX_ATTEMPTS_EXHAUSTED');
  return createAutomationAttempt420({ jobId: previous.jobId, occurrenceId: previous.occurrenceId, intentDigest: previous.intentDigest, attemptNumber: previous.attemptNumber + 1, nowMs });
}

export function assertNoConcurrentAutomationAttempt420(attempts: readonly AutomationAttempt420[], occurrenceId: string): void {
  assertHash420(occurrenceId, 'AUT6_OCCURRENCE_ID_INVALID');
  const active = attempts.filter((attempt) => attempt.occurrenceId === occurrenceId.toLowerCase() && !['confirmed', 'terminal'].includes(attempt.state));
  if (active.length > 1) throw new Error('AUT6_DUPLICATE_ACTIVE_ATTEMPT');
}
