import { createHash } from 'node:crypto';
import { AUTOMATION_ARCHITECTURE_420, type AutomationTriggerClass420 } from './architecture.js';

export type AutomationJobStatus420 = 'enabled' | 'disabled';

export interface AutomationExecutionEnvelope420 {
  target: string;
  selector: string;
  calldataHash: string;
  nativeValueWei: bigint;
  gasLimit: bigint;
}

export interface AutomationJobDefinition420 {
  chainId: bigint;
  jobId: string;
  protocolId: string;
  ownerId: string;
  triggerClass: AutomationTriggerClass420;
  triggerRef: string;
  revision: number;
  status: AutomationJobStatus420;
  envelope: AutomationExecutionEnvelope420;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationJobRegistryEntry420 {
  job: AutomationJobDefinition420;
  envelopeDigest: string;
}

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const SELECTOR4 = /^0x[0-9a-fA-F]{8}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function stableEnvelopeMaterial420(envelope: AutomationExecutionEnvelope420): string {
  return [
    envelope.target.toLowerCase(),
    envelope.selector.toLowerCase(),
    envelope.calldataHash.toLowerCase(),
    envelope.nativeValueWei.toString(10),
    envelope.gasLimit.toString(10),
  ].join('|');
}

export function digestExecutionEnvelope420(envelope: AutomationExecutionEnvelope420): string {
  return `0x${createHash('sha256').update(stableEnvelopeMaterial420(envelope)).digest('hex')}`;
}

export function deriveAutomationJobId420(input: {
  protocolId: string;
  ownerId: string;
  triggerClass: AutomationTriggerClass420;
  triggerRef: string;
  envelope: AutomationExecutionEnvelope420;
}): string {
  const material = [
    '420Automation/job/v1',
    input.protocolId,
    input.ownerId,
    input.triggerClass,
    input.triggerRef,
    digestExecutionEnvelope420(input.envelope),
  ].join('|');
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

export function validateExecutionEnvelope420(envelope: AutomationExecutionEnvelope420): void {
  if (!ADDRESS20.test(envelope.target)) throw new Error('AUT1_TARGET_INVALID');
  if (!SELECTOR4.test(envelope.selector)) throw new Error('AUT1_SELECTOR_INVALID');
  if (!HASH32.test(envelope.calldataHash)) throw new Error('AUT1_CALLDATA_HASH_INVALID');
  if (envelope.nativeValueWei < 0n) throw new Error('AUT1_NATIVE_VALUE_INVALID');
  if (envelope.gasLimit <= 0n) throw new Error('AUT1_GAS_LIMIT_INVALID');
}

export function validateAutomationJobDefinition420(job: AutomationJobDefinition420): void {
  if (job.chainId !== AUTOMATION_ARCHITECTURE_420.expectedChainId) throw new Error('AUT1_CHAIN_ID_INVALID');
  if (!HASH32.test(job.jobId)) throw new Error('AUT1_JOB_ID_INVALID');
  if (!ID.test(job.protocolId)) throw new Error('AUT1_PROTOCOL_ID_INVALID');
  if (!ID.test(job.ownerId)) throw new Error('AUT1_OWNER_ID_INVALID');
  if (!ID.test(job.triggerRef)) throw new Error('AUT1_TRIGGER_REF_INVALID');
  if (!AUTOMATION_ARCHITECTURE_420.supportedTriggerClasses.includes(job.triggerClass)) throw new Error('AUT1_TRIGGER_CLASS_INVALID');
  if (!Number.isInteger(job.revision) || job.revision < 1) throw new Error('AUT1_REVISION_INVALID');
  if (!Number.isSafeInteger(job.createdAt) || job.createdAt < 0) throw new Error('AUT1_CREATED_AT_INVALID');
  if (!Number.isSafeInteger(job.updatedAt) || job.updatedAt < job.createdAt) throw new Error('AUT1_UPDATED_AT_INVALID');
  validateExecutionEnvelope420(job.envelope);
  const expectedId = deriveAutomationJobId420(job);
  if (expectedId !== job.jobId.toLowerCase()) throw new Error('AUT1_JOB_ID_MISMATCH');
}

export class AutomationJobRegistry420 {
  #entries = new Map<string, AutomationJobRegistryEntry420>();

  register(job: AutomationJobDefinition420): AutomationJobRegistryEntry420 {
    validateAutomationJobDefinition420(job);
    if (this.#entries.has(job.jobId)) throw new Error('AUT1_JOB_ALREADY_EXISTS');
    const entry = { job: structuredClone(job), envelopeDigest: digestExecutionEnvelope420(job.envelope) };
    this.#entries.set(job.jobId, entry);
    return structuredClone(entry);
  }

  get(jobId: string): AutomationJobRegistryEntry420 | null {
    const entry = this.#entries.get(jobId);
    return entry ? structuredClone(entry) : null;
  }

  list(status?: AutomationJobStatus420): readonly AutomationJobRegistryEntry420[] {
    return [...this.#entries.values()]
      .filter((entry) => status === undefined || entry.job.status === status)
      .sort((a, b) => a.job.jobId.localeCompare(b.job.jobId))
      .map((entry) => structuredClone(entry));
  }

  setStatus(jobId: string, status: AutomationJobStatus420, now: number): AutomationJobRegistryEntry420 {
    const current = this.#entries.get(jobId);
    if (!current) throw new Error('AUT1_JOB_NOT_FOUND');
    if (!Number.isSafeInteger(now) || now < current.job.updatedAt) throw new Error('AUT1_STATUS_TIME_INVALID');
    const updated: AutomationJobDefinition420 = {
      ...current.job,
      status,
      revision: current.job.revision + 1,
      updatedAt: now,
    };
    const entry = { job: updated, envelopeDigest: current.envelopeDigest };
    this.#entries.set(jobId, entry);
    return structuredClone(entry);
  }

  replaceExecutionIntent(): never {
    throw new Error('AUT1_EXECUTION_ENVELOPE_IMMUTABLE');
  }
}
