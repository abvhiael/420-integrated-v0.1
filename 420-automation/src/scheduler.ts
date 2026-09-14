import { createHash } from 'node:crypto';
import type { AutomationJobRegistryEntry420 } from './jobs.js';
import type { AutomationNormalizedTrigger420 } from './triggers.js';

export interface AutomationChainObservation420 {
  chainId: bigint;
  headBlock: bigint;
  safeBlock: bigint;
  finalizedBlock: bigint;
  observedAtMs: number;
}

export interface AutomationEventObservation420 {
  address: string;
  topic0: string;
  topics: readonly string[];
  blockNumber: bigint;
  logIndex: number;
  blockHash: string;
}

export interface AutomationOracleObservation420 {
  feedId: string;
  value: string;
  observedAtMs: number;
}

export interface AutomationOracleResultObservation420 {
  feedId: string;
  resultHash: string;
  observedAtMs: number;
}

export interface AutomationManualObservation420 {
  requesterId: string;
  requesterRole: 'owner' | 'protocol';
  requestId: string;
}

export interface AutomationSchedulerObservation420 {
  nowMs: number;
  chain: AutomationChainObservation420;
  events?: readonly AutomationEventObservation420[];
  oracles?: readonly AutomationOracleObservation420[];
  oracleResults?: readonly AutomationOracleResultObservation420[];
  manuals?: readonly AutomationManualObservation420[];
}

export interface AutomationEligibility420 {
  jobId: string;
  eligible: boolean;
  reason: string;
  occurrenceId: string | null;
  nextEligibleAtMs: number | null;
  nextEligibleBlock: bigint | null;
}

export interface AutomationSchedulerPolicy420 {
  expectedChainId: bigint;
  maxObservationAgeMs: number;
  maxJobsPerScan: number;
  requireSafeHead: boolean;
}

export const DEFAULT_AUT3_POLICY_420: AutomationSchedulerPolicy420 = {
  expectedChainId: 420n,
  maxObservationAgeMs: 15_000,
  maxJobsPerScan: 1_000,
  requireSafeHead: true,
};

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function occurrenceId420(jobId: string, material: string): string {
  return `0x${createHash('sha256').update(`420Automation/occurrence/v1|${jobId}|${material}`).digest('hex')}`;
}

function assertObservation420(observation: AutomationSchedulerObservation420, policy: AutomationSchedulerPolicy420): void {
  if (observation.chain.chainId !== policy.expectedChainId) throw new Error('AUT3_CHAIN_ID_INVALID');
  if (!Number.isSafeInteger(observation.nowMs) || observation.nowMs < 0) throw new Error('AUT3_NOW_INVALID');
  if (!Number.isSafeInteger(observation.chain.observedAtMs) || observation.chain.observedAtMs < 0) throw new Error('AUT3_CHAIN_TIME_INVALID');
  if (observation.chain.observedAtMs > observation.nowMs) throw new Error('AUT3_CHAIN_FROM_FUTURE');
  if (observation.nowMs - observation.chain.observedAtMs > policy.maxObservationAgeMs) throw new Error('AUT3_CHAIN_STALE');
  if (observation.chain.headBlock < 0n || observation.chain.safeBlock < 0n || observation.chain.finalizedBlock < 0n) throw new Error('AUT3_BLOCK_INVALID');
  if (observation.chain.finalizedBlock > observation.chain.safeBlock || observation.chain.safeBlock > observation.chain.headBlock) throw new Error('AUT3_CHAIN_ORDER_INVALID');
}

function parseDecimal420(value: string): { sign: bigint; scale: bigint; magnitude: bigint } {
  if (!DECIMAL.test(value)) throw new Error('AUT3_DECIMAL_INVALID');
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = unsigned.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const magnitude = BigInt(whole) * scale + BigInt(fraction || '0');
  return { sign: negative ? -1n : 1n, scale, magnitude };
}

function compareDecimal420(left: string, right: string): number {
  const a = parseDecimal420(left);
  const b = parseDecimal420(right);
  const commonScale = a.scale > b.scale ? a.scale : b.scale;
  const av = a.sign * a.magnitude * (commonScale / a.scale);
  const bv = b.sign * b.magnitude * (commonScale / b.scale);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function evaluatePredicate420(actual: string, predicate: string, threshold: string): boolean {
  const cmp = compareDecimal420(actual, threshold);
  switch (predicate) {
    case 'eq': return cmp === 0;
    case 'ne': return cmp !== 0;
    case 'gt': return cmp > 0;
    case 'gte': return cmp >= 0;
    case 'lt': return cmp < 0;
    case 'lte': return cmp <= 0;
    default: return false;
  }
}

function parseCronField420(field: string, min: number, max: number): (value: number) => boolean {
  if (field === '*') return () => true;
  if (/^\*\/\d+$/.test(field)) {
    const step = Number(field.slice(2));
    if (!Number.isInteger(step) || step <= 0) return () => false;
    return (value) => value >= min && value <= max && (value - min) % step === 0;
  }
  const exact = Number(field);
  if (!Number.isInteger(exact) || exact < min || exact > max) return () => false;
  return (value) => value === exact;
}

function cronMatches420(expression: string, nowMs: number): boolean {
  const parts = expression.split(' ');
  if (parts.length !== 5) return false;
  const date = new Date(nowMs);
  const checks = [
    parseCronField420(parts[0], 0, 59),
    parseCronField420(parts[1], 0, 23),
    parseCronField420(parts[2], 1, 31),
    parseCronField420(parts[3], 1, 12),
    parseCronField420(parts[4], 0, 6),
  ];
  return checks[0](date.getUTCMinutes()) && checks[1](date.getUTCHours()) && checks[2](date.getUTCDate()) && checks[3](date.getUTCMonth() + 1) && checks[4](date.getUTCDay());
}

function evaluateCanonical420(jobId: string, canonical: string, observation: AutomationSchedulerObservation420, ownerId: string, protocolId: string): AutomationEligibility420 {
  const parts = canonical.split('|');
  const kind = parts[0];
  if (kind === 'time' && parts[1] === 'once') {
    const atMs = Number(parts[2]);
    return observation.nowMs >= atMs
      ? { jobId, eligible: true, reason: 'time-once-due', occurrenceId: occurrenceId420(jobId, `time:${atMs}`), nextEligibleAtMs: null, nextEligibleBlock: null }
      : { jobId, eligible: false, reason: 'time-not-due', occurrenceId: null, nextEligibleAtMs: atMs, nextEligibleBlock: null };
  }
  if (kind === 'time' && parts[1] === 'interval') {
    const start = Number(parts[2]);
    const interval = Number(parts[3]);
    if (observation.nowMs < start) return { jobId, eligible: false, reason: 'time-not-due', occurrenceId: null, nextEligibleAtMs: start, nextEligibleBlock: null };
    const slot = Math.floor((observation.nowMs - start) / interval);
    const due = start + slot * interval;
    return { jobId, eligible: true, reason: 'time-interval-due', occurrenceId: occurrenceId420(jobId, `time:${due}`), nextEligibleAtMs: due + interval, nextEligibleBlock: null };
  }
  if (kind === 'time' && parts[1] === 'cron') {
    const expression = parts.slice(2).join('|');
    const minute = Math.floor(observation.nowMs / 60_000) * 60_000;
    return cronMatches420(expression, observation.nowMs)
      ? { jobId, eligible: true, reason: 'cron-due', occurrenceId: occurrenceId420(jobId, `cron:${minute}`), nextEligibleAtMs: minute + 60_000, nextEligibleBlock: null }
      : { jobId, eligible: false, reason: 'cron-not-due', occurrenceId: null, nextEligibleAtMs: minute + 60_000, nextEligibleBlock: null };
  }
  if (kind === 'block') {
    const start = BigInt(parts[1]);
    const interval = BigInt(parts[2]);
    const head = observation.chain.safeBlock;
    if (head < start) return { jobId, eligible: false, reason: 'block-not-due', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: start };
    const slot = (head - start) / interval;
    const due = start + slot * interval;
    return { jobId, eligible: true, reason: 'block-due', occurrenceId: occurrenceId420(jobId, `block:${due}`), nextEligibleAtMs: null, nextEligibleBlock: due + interval };
  }
  if (kind === 'event') {
    const address = parts[1];
    const topic0 = parts[2];
    const topics = parts[3] ? parts[3].split(',') : [];
    const confirmations = BigInt(parts[4]);
    const events = observation.events ?? [];
    for (const event of events) {
      if (!ADDRESS20.test(event.address) || !HASH32.test(event.topic0) || !HASH32.test(event.blockHash)) continue;
      if (event.address.toLowerCase() !== address || event.topic0.toLowerCase() !== topic0) continue;
      if (observation.chain.safeBlock < event.blockNumber + confirmations) continue;
      let match = true;
      for (let i = 0; i < topics.length; i += 1) {
        if (topics[i] !== '*' && event.topics[i]?.toLowerCase() !== topics[i]) match = false;
      }
      if (!match) continue;
      const material = `event:${event.blockHash.toLowerCase()}:${event.logIndex}`;
      return { jobId, eligible: true, reason: 'event-match', occurrenceId: occurrenceId420(jobId, material), nextEligibleAtMs: null, nextEligibleBlock: null };
    }
    return { jobId, eligible: false, reason: 'event-not-observed', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
  }
  if (kind === 'oracle') {
    const [, feedId, predicate, threshold, maxAgeRaw] = parts;
    const maxAge = Number(maxAgeRaw);
    const candidates = (observation.oracles ?? []).filter((oracle) => oracle.feedId === feedId).sort((a, b) => b.observedAtMs - a.observedAtMs);
    const oracle = candidates[0];
    if (!oracle) return { jobId, eligible: false, reason: 'oracle-missing', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    if (oracle.observedAtMs > observation.nowMs || observation.nowMs - oracle.observedAtMs > maxAge) return { jobId, eligible: false, reason: 'oracle-stale', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    if (!evaluatePredicate420(oracle.value, predicate, threshold)) return { jobId, eligible: false, reason: 'oracle-predicate-false', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    return { jobId, eligible: true, reason: 'oracle-predicate-true', occurrenceId: occurrenceId420(jobId, `oracle:${feedId}:${oracle.observedAtMs}:${oracle.value}`), nextEligibleAtMs: null, nextEligibleBlock: null };
  }
  if (kind === 'oracle-result') {
    const [, feedId, expectedResultHash, maxAgeRaw] = parts;
    const maxAge = Number(maxAgeRaw);
    const candidates = (observation.oracleResults ?? []).filter((oracle) => oracle.feedId === feedId).sort((a, b) => b.observedAtMs - a.observedAtMs);
    const oracle = candidates[0];
    if (!oracle) return { jobId, eligible: false, reason: 'oracle-result-missing', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    if (!HASH32.test(oracle.resultHash)) return { jobId, eligible: false, reason: 'oracle-result-invalid', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    if (oracle.observedAtMs > observation.nowMs || observation.nowMs - oracle.observedAtMs > maxAge) return { jobId, eligible: false, reason: 'oracle-result-stale', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    if (oracle.resultHash.toLowerCase() !== expectedResultHash) return { jobId, eligible: false, reason: 'oracle-result-mismatch', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
    return { jobId, eligible: true, reason: 'oracle-result-match', occurrenceId: occurrenceId420(jobId, `oracle-result:${feedId}:${oracle.observedAtMs}:${oracle.resultHash.toLowerCase()}`), nextEligibleAtMs: null, nextEligibleBlock: null };
  }
  if (kind === 'manual') {
    const policy = parts[1];
    const candidates = observation.manuals ?? [];
    const request = candidates.find((manual) => {
      if (policy === 'owner') return manual.requesterRole === 'owner' && manual.requesterId === ownerId;
      if (policy === 'protocol') return manual.requesterRole === 'protocol' && manual.requesterId === protocolId;
      return (manual.requesterRole === 'owner' && manual.requesterId === ownerId) || (manual.requesterRole === 'protocol' && manual.requesterId === protocolId);
    });
    return request
      ? { jobId, eligible: true, reason: 'manual-request', occurrenceId: occurrenceId420(jobId, `manual:${request.requestId}`), nextEligibleAtMs: null, nextEligibleBlock: null }
      : { jobId, eligible: false, reason: 'manual-request-missing', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
  }
  throw new Error('AUT3_TRIGGER_CANONICAL_UNSUPPORTED');
}

export function evaluateAutomationEligibility420(input: {
  entry: AutomationJobRegistryEntry420;
  trigger: AutomationNormalizedTrigger420;
  observation: AutomationSchedulerObservation420;
  consumedOccurrenceIds?: ReadonlySet<string>;
  policy?: AutomationSchedulerPolicy420;
}): AutomationEligibility420 {
  const policy = input.policy ?? DEFAULT_AUT3_POLICY_420;
  assertObservation420(input.observation, policy);
  if (input.entry.job.status !== 'enabled') return { jobId: input.entry.job.jobId, eligible: false, reason: 'job-disabled', occurrenceId: null, nextEligibleAtMs: null, nextEligibleBlock: null };
  if (input.entry.job.triggerClass !== input.trigger.triggerClass || input.entry.job.triggerRef !== input.trigger.triggerRef) throw new Error('AUT3_TRIGGER_BINDING_MISMATCH');
  const decision = evaluateCanonical420(input.entry.job.jobId, input.trigger.canonical, input.observation, input.entry.job.ownerId, input.entry.job.protocolId);
  if (decision.occurrenceId && input.consumedOccurrenceIds?.has(decision.occurrenceId)) return { ...decision, eligible: false, reason: 'duplicate-suppressed' };
  return decision;
}

export function scanAutomationJobs420(input: {
  jobs: readonly { entry: AutomationJobRegistryEntry420; trigger: AutomationNormalizedTrigger420 }[];
  observation: AutomationSchedulerObservation420;
  consumedOccurrenceIds?: ReadonlySet<string>;
  policy?: AutomationSchedulerPolicy420;
}): readonly AutomationEligibility420[] {
  const policy = input.policy ?? DEFAULT_AUT3_POLICY_420;
  if (!Number.isInteger(policy.maxJobsPerScan) || policy.maxJobsPerScan <= 0) throw new Error('AUT3_SCAN_LIMIT_INVALID');
  if (input.jobs.length > policy.maxJobsPerScan) throw new Error('AUT3_SCAN_LIMIT_EXCEEDED');
  return [...input.jobs]
    .sort((a, b) => a.entry.job.jobId.localeCompare(b.entry.job.jobId))
    .map((job) => evaluateAutomationEligibility420({ ...job, observation: input.observation, consumedOccurrenceIds: input.consumedOccurrenceIds, policy }));
}
