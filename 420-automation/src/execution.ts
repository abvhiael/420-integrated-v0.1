import { createHash } from 'node:crypto';
import type { AutomationJobRegistryEntry420 } from './jobs.js';
import type { AutomationEligibility420 } from './scheduler.js';

export type AutomationSubmissionOutcome420 =
  | { status: 'accepted'; transactionHash: string }
  | { status: 'rejected'; code: string; retryable: boolean }
  | { status: 'ambiguous'; code: string };

export interface AutomationRpcSubmitter420 {
  readonly chainId: bigint;
  readonly ready: boolean;
  readonly canonicalSafe: boolean;
  submitSignedPayload(payload: string): Promise<AutomationSubmissionOutcome420>;
}

export interface AutomationWorkerSigner420 {
  readonly workerId: string;
  readonly address: string;
  signPlan(plan: AutomationTransactionPlan420): Promise<string>;
}

export interface AutomationCalldataResolver420 {
  resolveCalldata(jobId: string, occurrenceId: string): Promise<string>;
}

export interface AutomationTransactionPlan420 {
  chainId: bigint;
  jobId: string;
  occurrenceId: string;
  workerId: string;
  from: string;
  to: string;
  data: string;
  valueWei: bigint;
  gasLimit: bigint;
  envelopeDigest: string;
  intentDigest: string;
}

export interface AutomationExecutionReceipt420 {
  jobId: string;
  occurrenceId: string;
  workerId: string;
  intentDigest: string;
  status: 'submitted' | 'rejected' | 'ambiguous';
  transactionHash: string | null;
  code: string | null;
  retryable: boolean;
}

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const HEX_DATA = /^0x(?:[0-9a-fA-F]{2})*$/;

function digest420(material: string): string {
  return `0x${createHash('sha256').update(material).digest('hex')}`;
}

function calldataHash420(data: string): string {
  return `0x${createHash('sha256').update(Buffer.from(data.slice(2), 'hex')).digest('hex')}`;
}

function assertEligible420(entry: AutomationJobRegistryEntry420, eligibility: AutomationEligibility420): asserts eligibility is AutomationEligibility420 & { occurrenceId: string } {
  if (!eligibility.eligible || eligibility.occurrenceId === null) throw new Error('AUT4_OCCURRENCE_NOT_ELIGIBLE');
  if (eligibility.jobId !== entry.job.jobId) throw new Error('AUT4_JOB_ID_MISMATCH');
  if (entry.job.status !== 'enabled') throw new Error('AUT4_JOB_DISABLED');
  if (!HASH32.test(eligibility.occurrenceId)) throw new Error('AUT4_OCCURRENCE_ID_INVALID');
}

export async function buildAutomationTransactionPlan420(input: {
  entry: AutomationJobRegistryEntry420;
  eligibility: AutomationEligibility420;
  worker: AutomationWorkerSigner420;
  calldataResolver: AutomationCalldataResolver420;
}): Promise<AutomationTransactionPlan420> {
  assertEligible420(input.entry, input.eligibility);
  if (!ADDRESS20.test(input.worker.address)) throw new Error('AUT4_WORKER_ADDRESS_INVALID');
  if (input.worker.workerId.length === 0 || input.worker.workerId.length > 128) throw new Error('AUT4_WORKER_ID_INVALID');
  const data = await input.calldataResolver.resolveCalldata(input.entry.job.jobId, input.eligibility.occurrenceId);
  if (!HEX_DATA.test(data)) throw new Error('AUT4_CALLDATA_INVALID');
  if (!data.toLowerCase().startsWith(input.entry.job.envelope.selector.toLowerCase())) throw new Error('AUT4_SELECTOR_MISMATCH');
  if (calldataHash420(data) !== input.entry.job.envelope.calldataHash.toLowerCase()) throw new Error('AUT4_CALLDATA_HASH_MISMATCH');
  const material = ['420Automation/intent/v1', input.entry.job.jobId, input.eligibility.occurrenceId, input.worker.workerId, input.worker.address.toLowerCase(), input.entry.job.envelope.target.toLowerCase(), data.toLowerCase(), input.entry.job.envelope.nativeValueWei.toString(10), input.entry.job.envelope.gasLimit.toString(10), input.entry.envelopeDigest].join('|');
  return { chainId: input.entry.job.chainId, jobId: input.entry.job.jobId, occurrenceId: input.eligibility.occurrenceId, workerId: input.worker.workerId, from: input.worker.address.toLowerCase(), to: input.entry.job.envelope.target.toLowerCase(), data: data.toLowerCase(), valueWei: input.entry.job.envelope.nativeValueWei, gasLimit: input.entry.job.envelope.gasLimit, envelopeDigest: input.entry.envelopeDigest, intentDigest: digest420(material) };
}
