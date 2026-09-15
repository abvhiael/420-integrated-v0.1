import type { AutomationExecutionReceipt420 } from './execution.js';
import type { AutomationAttempt420 } from './recovery.js';
import type { AutomationWorkerRegistry420 } from './workers.js';

export type AutomationReadinessState420 = 'ready' | 'degraded' | 'not-ready';
export type AutomationMetricName420 =
  | 'automation_jobs_total'
  | 'automation_workers_registered'
  | 'automation_workers_live'
  | 'automation_leases_active'
  | 'automation_attempts_active'
  | 'automation_attempts_ambiguous'
  | 'automation_receipts_submitted_total'
  | 'automation_receipts_rejected_total'
  | 'automation_receipts_ambiguous_total';

export interface AutomationReadinessPolicy420 {
  expectedChainId: bigint;
  maxChainObservationAgeMs: number;
  minLiveWorkers: number;
  recoverySuccessesRequired: number;
}

export interface AutomationChainHealth420 {
  chainId: bigint;
  rpcReady: boolean;
  canonicalSafe: boolean;
  observedAtMs: number;
}

export interface AutomationReadinessInput420 {
  nowMs: number;
  chain: AutomationChainHealth420;
  schedulerReady: boolean;
  oracleReady: boolean;
  workerSnapshot: { registeredWorkers: number; liveWorkers: number; activeLeases: number };
  jobsTotal: number;
  activeAttempts: readonly AutomationAttempt420[];
}

export interface AutomationReadinessSnapshot420 {
  state: AutomationReadinessState420;
  ready: boolean;
  reasons: readonly string[];
  consecutiveHealthy: number;
  observedAtMs: number;
  canonicalAuthority: false;
}

export interface AutomationMetric420 {
  name: AutomationMetricName420;
  value: number;
}

export interface AutomationOperationalSnapshot420 {
  readiness: AutomationReadinessSnapshot420;
  metrics: readonly AutomationMetric420[];
  chainId: string;
  jobsTotal: number;
  registeredWorkers: number;
  liveWorkers: number;
  activeLeases: number;
  activeAttempts: number;
  ambiguousAttempts: number;
  canonicalAuthority: false;
  containsSecrets: false;
}

export interface AutomationReceiptJournalEntry420 {
  sequence: number;
  recordedAtMs: number;
  jobId: string;
  occurrenceId: string;
  workerId: string;
  intentDigest: string;
  status: AutomationExecutionReceipt420['status'];
  transactionHash: string | null;
  code: string | null;
  retryable: boolean;
}

export const DEFAULT_AUTOMATION_READINESS_POLICY_420: AutomationReadinessPolicy420 = {
  expectedChainId: 420n,
  maxChainObservationAgeMs: 15_000,
  minLiveWorkers: 1,
  recoverySuccessesRequired: 2,
};

function validatePolicy420(policy: AutomationReadinessPolicy420): void {
  if (policy.expectedChainId <= 0n) throw new Error('AUT10_CHAIN_ID_INVALID');
  if (!Number.isSafeInteger(policy.maxChainObservationAgeMs) || policy.maxChainObservationAgeMs <= 0) throw new Error('AUT10_CHAIN_AGE_INVALID');
  if (!Number.isSafeInteger(policy.minLiveWorkers) || policy.minLiveWorkers < 1) throw new Error('AUT10_MIN_WORKERS_INVALID');
  if (!Number.isSafeInteger(policy.recoverySuccessesRequired) || policy.recoverySuccessesRequired < 1 || policy.recoverySuccessesRequired > 100) throw new Error('AUT10_RECOVERY_THRESHOLD_INVALID');
}

function countActiveAttempts420(attempts: readonly AutomationAttempt420[]): { active: number; ambiguous: number } {
  let active = 0;
  let ambiguous = 0;
  for (const attempt of attempts) {
    if (!['confirmed', 'terminal'].includes(attempt.state)) active += 1;
    if (attempt.state === 'ambiguous') ambiguous += 1;
  }
  return { active, ambiguous };
}

export class AutomationReadinessController420 {
  private consecutiveHealthy = 0;
  private lastSnapshot: AutomationReadinessSnapshot420 | null = null;

  constructor(readonly policy: AutomationReadinessPolicy420 = DEFAULT_AUTOMATION_READINESS_POLICY_420) {
    validatePolicy420(policy);
  }

  evaluate(input: AutomationReadinessInput420): AutomationReadinessSnapshot420 {
    if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('AUT10_NOW_INVALID');
    if (!Number.isSafeInteger(input.chain.observedAtMs) || input.chain.observedAtMs < 0 || input.chain.observedAtMs > input.nowMs) throw new Error('AUT10_CHAIN_OBSERVATION_TIME_INVALID');
    if (!Number.isSafeInteger(input.jobsTotal) || input.jobsTotal < 0) throw new Error('AUT10_JOBS_TOTAL_INVALID');

    const reasons: string[] = [];
    if (input.chain.chainId !== this.policy.expectedChainId) reasons.push('wrong-chain');
    if (!input.chain.rpcReady) reasons.push('rpc-not-ready');
    if (!input.chain.canonicalSafe) reasons.push('canonical-safety-unavailable');
    if (input.nowMs - input.chain.observedAtMs > this.policy.maxChainObservationAgeMs) reasons.push('chain-observation-stale');
    if (!input.schedulerReady) reasons.push('scheduler-not-ready');
    if (input.workerSnapshot.liveWorkers < this.policy.minLiveWorkers) reasons.push('insufficient-live-workers');

    const hardFailure = reasons.length > 0;
    if (hardFailure) this.consecutiveHealthy = 0;
    else this.consecutiveHealthy += 1;

    let state: AutomationReadinessState420;
    if (hardFailure) state = 'not-ready';
    else if (this.consecutiveHealthy < this.policy.recoverySuccessesRequired) state = 'degraded';
    else if (!input.oracleReady) state = 'degraded';
    else state = 'ready';

    const snapshot: AutomationReadinessSnapshot420 = {
      state,
      ready: state === 'ready',
      reasons: Object.freeze(!input.oracleReady && !hardFailure ? ['oracle-degraded'] : [...reasons]),
      consecutiveHealthy: this.consecutiveHealthy,
      observedAtMs: input.nowMs,
      canonicalAuthority: false,
    };
    this.lastSnapshot = snapshot;
    return structuredClone(snapshot);
  }

  snapshot(): AutomationReadinessSnapshot420 | null {
    return this.lastSnapshot ? structuredClone(this.lastSnapshot) : null;
  }
}

export class AutomationReceiptJournal420 {
  private readonly entries: AutomationReceiptJournalEntry420[] = [];
  private sequence = 0;
  constructor(readonly maxEntries = 10_000) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 1_000_000) throw new Error('AUT10_RECEIPT_CAP_INVALID');
  }

  record(receipt: AutomationExecutionReceipt420, recordedAtMs: number): AutomationReceiptJournalEntry420 {
    if (!Number.isSafeInteger(recordedAtMs) || recordedAtMs < 0) throw new Error('AUT10_RECEIPT_TIME_INVALID');
    const entry: AutomationReceiptJournalEntry420 = { sequence: ++this.sequence, recordedAtMs, ...structuredClone(receipt) };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    return structuredClone(entry);
  }

  list(limit = 100): readonly AutomationReceiptJournalEntry420[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) throw new Error('AUT10_RECEIPT_LIMIT_INVALID');
    return this.entries.slice(-limit).map((entry) => structuredClone(entry));
  }

  counts(): { submitted: number; rejected: number; ambiguous: number } {
    let submitted = 0, rejected = 0, ambiguous = 0;
    for (const entry of this.entries) {
      if (entry.status === 'submitted') submitted += 1;
      else if (entry.status === 'rejected') rejected += 1;
      else ambiguous += 1;
    }
    return { submitted, rejected, ambiguous };
  }
}

export function automationMetrics420(input: { jobsTotal: number; workerSnapshot: { registeredWorkers: number; liveWorkers: number; activeLeases: number }; attempts: readonly AutomationAttempt420[]; receipts: AutomationReceiptJournal420 }): readonly AutomationMetric420[] {
  const attempts = countActiveAttempts420(input.attempts);
  const receipts = input.receipts.counts();
  return Object.freeze([
    { name: 'automation_jobs_total', value: input.jobsTotal },
    { name: 'automation_workers_registered', value: input.workerSnapshot.registeredWorkers },
    { name: 'automation_workers_live', value: input.workerSnapshot.liveWorkers },
    { name: 'automation_leases_active', value: input.workerSnapshot.activeLeases },
    { name: 'automation_attempts_active', value: attempts.active },
    { name: 'automation_attempts_ambiguous', value: attempts.ambiguous },
    { name: 'automation_receipts_submitted_total', value: receipts.submitted },
    { name: 'automation_receipts_rejected_total', value: receipts.rejected },
    { name: 'automation_receipts_ambiguous_total', value: receipts.ambiguous },
  ]);
}

export function automationOperationalSnapshot420(input: { readiness: AutomationReadinessSnapshot420; chainId: bigint; jobsTotal: number; workerSnapshot: { registeredWorkers: number; liveWorkers: number; activeLeases: number }; attempts: readonly AutomationAttempt420[]; receipts: AutomationReceiptJournal420 }): AutomationOperationalSnapshot420 {
  const attempts = countActiveAttempts420(input.attempts);
  return {
    readiness: structuredClone(input.readiness),
    metrics: automationMetrics420({ jobsTotal: input.jobsTotal, workerSnapshot: input.workerSnapshot, attempts: input.attempts, receipts: input.receipts }),
    chainId: input.chainId.toString(10),
    jobsTotal: input.jobsTotal,
    registeredWorkers: input.workerSnapshot.registeredWorkers,
    liveWorkers: input.workerSnapshot.liveWorkers,
    activeLeases: input.workerSnapshot.activeLeases,
    activeAttempts: attempts.active,
    ambiguousAttempts: attempts.ambiguous,
    canonicalAuthority: false,
    containsSecrets: false,
  };
}

export function workerOperationalSnapshot420(registry: AutomationWorkerRegistry420, nowMs: number): { registeredWorkers: number; liveWorkers: number; activeLeases: number } {
  return registry.snapshot(nowMs);
}
