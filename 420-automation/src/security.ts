import { createHash, timingSafeEqual } from 'node:crypto';

export const AUTOMATION_SECURITY_VERSION_420 = 'AUT-11/V1' as const;

export interface AutomationSecurityPolicy420 {
  expectedChainId: bigint;
  maxClockSkewMs: number;
  maxObservationAgeMs: number;
  maxCalldataBytes: number;
  maxBatchJobs: number;
  maxBatchBytes: number;
  maxRetries: number;
  maxExecutionGas: bigint;
  replayTtlMs: number;
  replayCapacity: number;
  maxMetricLabels: number;
  maxMetricLabelLength: number;
}

export const DEFAULT_AUT11_SECURITY_POLICY_420: AutomationSecurityPolicy420 = {
  expectedChainId: 420n,
  maxClockSkewMs: 5_000,
  maxObservationAgeMs: 30_000,
  maxCalldataBytes: 32_768,
  maxBatchJobs: 1_000,
  maxBatchBytes: 8 * 1024 * 1024,
  maxRetries: 8,
  maxExecutionGas: 30_000_000n,
  replayTtlMs: 24 * 60 * 60 * 1_000,
  replayCapacity: 100_000,
  maxMetricLabels: 8,
  maxMetricLabelLength: 64,
};

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SECRET_KEY = /(secret|token|password|private.?key|mnemonic|seed|authorization|cookie|api.?key)/i;

function assertSafeInteger420(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function byteLength420(hex: string): number {
  return (hex.length - 2) / 2;
}

function digest420(material: string): string {
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

export interface AutomationSignedObservation420 {
  sourceId: string;
  chainId: bigint;
  observedAtMs: number;
  sequence: bigint;
  payloadHash: string;
  signature: string;
}

export function automationObservationSigningDigest420(input: Omit<AutomationSignedObservation420, 'signature'>): string {
  if (!SAFE_ID.test(input.sourceId)) throw new Error('AUT11_SOURCE_ID_INVALID');
  if (input.chainId < 0n) throw new Error('AUT11_CHAIN_ID_INVALID');
  assertSafeInteger420(input.observedAtMs, 'AUT11_OBSERVED_AT_INVALID');
  if (input.sequence < 0n) throw new Error('AUT11_SEQUENCE_INVALID');
  if (!HASH32.test(input.payloadHash)) throw new Error('AUT11_PAYLOAD_HASH_INVALID');
  return digest420(`420Automation/observation/v1|${input.sourceId}|${input.chainId}|${input.observedAtMs}|${input.sequence}|${input.payloadHash.toLowerCase()}`);
}

export function verifyObservationEnvelope420(input: {
  envelope: AutomationSignedObservation420;
  nowMs: number;
  verifySignature: (sourceId: string, digest: string, signature: string) => boolean;
  policy?: AutomationSecurityPolicy420;
}): string {
  const policy = input.policy ?? DEFAULT_AUT11_SECURITY_POLICY_420;
  const envelope = input.envelope;
  assertSafeInteger420(input.nowMs, 'AUT11_NOW_INVALID');
  if (envelope.chainId !== policy.expectedChainId) throw new Error('AUT11_CHAIN_ID_MISMATCH');
  if (!SAFE_ID.test(envelope.sourceId)) throw new Error('AUT11_SOURCE_ID_INVALID');
  if (!HASH32.test(envelope.payloadHash)) throw new Error('AUT11_PAYLOAD_HASH_INVALID');
  if (typeof envelope.signature !== 'string' || envelope.signature.length === 0 || envelope.signature.length > 512) throw new Error('AUT11_SIGNATURE_INVALID');
  if (envelope.sequence < 0n) throw new Error('AUT11_SEQUENCE_INVALID');
  assertSafeInteger420(envelope.observedAtMs, 'AUT11_OBSERVED_AT_INVALID');
  if (envelope.observedAtMs > input.nowMs + policy.maxClockSkewMs) throw new Error('AUT11_OBSERVATION_FROM_FUTURE');
  if (input.nowMs - envelope.observedAtMs > policy.maxObservationAgeMs) throw new Error('AUT11_OBSERVATION_STALE');
  const digest = automationObservationSigningDigest420(envelope);
  if (!input.verifySignature(envelope.sourceId, digest, envelope.signature)) throw new Error('AUT11_SIGNATURE_REJECTED');
  return digest;
}

export class AutomationReplayGuard420 {
  readonly #entries = new Map<string, number>();
  readonly #latestSequenceBySource = new Map<string, bigint>();

  consume(input: {
    replayKey: string;
    nowMs: number;
    sourceId?: string;
    sequence?: bigint;
    policy?: AutomationSecurityPolicy420;
  }): void {
    const policy = input.policy ?? DEFAULT_AUT11_SECURITY_POLICY_420;
    assertSafeInteger420(input.nowMs, 'AUT11_NOW_INVALID');
    if (!SAFE_ID.test(input.replayKey)) throw new Error('AUT11_REPLAY_KEY_INVALID');
    this.prune(input.nowMs);
    const expiresAt = this.#entries.get(input.replayKey);
    if (expiresAt !== undefined && expiresAt > input.nowMs) throw new Error('AUT11_REPLAY_DETECTED');
    if (input.sourceId !== undefined || input.sequence !== undefined) {
      if (input.sourceId === undefined || input.sequence === undefined) throw new Error('AUT11_SEQUENCE_PAIR_INCOMPLETE');
      if (!SAFE_ID.test(input.sourceId) || input.sequence < 0n) throw new Error('AUT11_SEQUENCE_INVALID');
      const previous = this.#latestSequenceBySource.get(input.sourceId);
      if (previous !== undefined && input.sequence <= previous) throw new Error('AUT11_SEQUENCE_REPLAY');
      this.#latestSequenceBySource.set(input.sourceId, input.sequence);
    }
    if (this.#entries.size >= policy.replayCapacity) throw new Error('AUT11_REPLAY_CAPACITY_EXCEEDED');
    this.#entries.set(input.replayKey, input.nowMs + policy.replayTtlMs);
  }

  prune(nowMs: number): number {
    let removed = 0;
    for (const [key, expiresAt] of this.#entries) {
      if (expiresAt <= nowMs) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.#entries.size;
  }
}

export interface AutomationExecutionEnvelope420 {
  jobId: string;
  target: string;
  calldata: string;
  gasLimit: bigint;
  retries: number;
  occurrenceId: string;
  authorizationHash: string;
}

export function validateExecutionEnvelope420(
  envelope: AutomationExecutionEnvelope420,
  policy: AutomationSecurityPolicy420 = DEFAULT_AUT11_SECURITY_POLICY_420,
): void {
  if (!SAFE_ID.test(envelope.jobId)) throw new Error('AUT11_JOB_ID_INVALID');
  if (!ADDRESS20.test(envelope.target)) throw new Error('AUT11_TARGET_INVALID');
  if (!HEX.test(envelope.calldata)) throw new Error('AUT11_CALLDATA_INVALID');
  if (byteLength420(envelope.calldata) > policy.maxCalldataBytes) throw new Error('AUT11_CALLDATA_TOO_LARGE');
  if (envelope.gasLimit <= 0n || envelope.gasLimit > policy.maxExecutionGas) throw new Error('AUT11_GAS_LIMIT_INVALID');
  if (!Number.isSafeInteger(envelope.retries) || envelope.retries < 0 || envelope.retries > policy.maxRetries) throw new Error('AUT11_RETRY_LIMIT_INVALID');
  if (!HASH32.test(envelope.occurrenceId)) throw new Error('AUT11_OCCURRENCE_ID_INVALID');
  if (!HASH32.test(envelope.authorizationHash)) throw new Error('AUT11_AUTHORIZATION_HASH_INVALID');
}

export function validateBatchResourceBudget420(input: {
  jobs: readonly AutomationExecutionEnvelope420[];
  policy?: AutomationSecurityPolicy420;
}): { jobs: number; calldataBytes: number; gas: bigint } {
  const policy = input.policy ?? DEFAULT_AUT11_SECURITY_POLICY_420;
  if (input.jobs.length > policy.maxBatchJobs) throw new Error('AUT11_BATCH_JOB_LIMIT');
  let calldataBytes = 0;
  let gas = 0n;
  for (const job of input.jobs) {
    validateExecutionEnvelope420(job, policy);
    calldataBytes += byteLength420(job.calldata);
    gas += job.gasLimit;
    if (calldataBytes > policy.maxBatchBytes) throw new Error('AUT11_BATCH_BYTE_LIMIT');
  }
  return { jobs: input.jobs.length, calldataBytes, gas };
}

export interface AutomationFinalityCheckpoint420 {
  chainId: bigint;
  headBlock: bigint;
  safeBlock: bigint;
  finalizedBlock: bigint;
  finalizedHash: string;
}

export class AutomationFinalityGuard420 {
  #checkpoint: AutomationFinalityCheckpoint420 | null = null;

  observe(next: AutomationFinalityCheckpoint420, policy: AutomationSecurityPolicy420 = DEFAULT_AUT11_SECURITY_POLICY_420): void {
    if (next.chainId !== policy.expectedChainId) throw new Error('AUT11_CHAIN_ID_MISMATCH');
    if (next.headBlock < 0n || next.safeBlock < 0n || next.finalizedBlock < 0n) throw new Error('AUT11_BLOCK_INVALID');
    if (next.finalizedBlock > next.safeBlock || next.safeBlock > next.headBlock) throw new Error('AUT11_CHAIN_ORDER_INVALID');
    if (!HASH32.test(next.finalizedHash)) throw new Error('AUT11_FINALIZED_HASH_INVALID');
    const previous = this.#checkpoint;
    if (previous) {
      if (next.finalizedBlock < previous.finalizedBlock) throw new Error('AUT11_FINALITY_REGRESSION');
      if (next.finalizedBlock === previous.finalizedBlock && !safeHashEqual420(next.finalizedHash, previous.finalizedHash)) throw new Error('AUT11_FINALITY_CONFLICT');
      if (next.safeBlock < previous.finalizedBlock) throw new Error('AUT11_SAFE_HEAD_BEHIND_FINALITY');
    }
    this.#checkpoint = { ...next, finalizedHash: next.finalizedHash.toLowerCase() };
  }

  get checkpoint(): AutomationFinalityCheckpoint420 | null {
    return this.#checkpoint ? { ...this.#checkpoint } : null;
  }
}

function safeHashEqual420(left: string, right: string): boolean {
  if (!HASH32.test(left) || !HASH32.test(right)) return false;
  const a = Buffer.from(left.slice(2), 'hex');
  const b = Buffer.from(right.slice(2), 'hex');
  return timingSafeEqual(a, b);
}

export function redactSecrets420(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactSecrets420(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      output[key] = SECRET_KEY.test(key) ? '[redacted]' : redactSecrets420(nested, depth + 1);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (/\b(?:0x)?[0-9a-f]{64}\b/i.test(value) && /(private|secret|seed|mnemonic|token)/i.test(value)) return '[redacted]';
    return value.length > 4_096 ? `${value.slice(0, 4_096)}[truncated]` : value;
  }
  return value;
}

export function sanitizeMetricLabels420(
  labels: Readonly<Record<string, string>>,
  policy: AutomationSecurityPolicy420 = DEFAULT_AUT11_SECURITY_POLICY_420,
): Readonly<Record<string, string>> {
  const entries = Object.entries(labels);
  if (entries.length > policy.maxMetricLabels) throw new Error('AUT11_METRIC_LABEL_LIMIT');
  const output: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(key)) throw new Error('AUT11_METRIC_LABEL_KEY_INVALID');
    if (SECRET_KEY.test(key)) throw new Error('AUT11_METRIC_SECRET_LABEL');
    if (typeof value !== 'string' || value.length > policy.maxMetricLabelLength) throw new Error('AUT11_METRIC_LABEL_VALUE_INVALID');
    if (/^0x[0-9a-fA-F]{40,}$/.test(value) || /[A-Za-z0-9+/=_-]{80,}/.test(value)) throw new Error('AUT11_METRIC_HIGH_CARDINALITY');
    output[key] = value;
  }
  return output;
}
