import type { CanonicalStatePort420, Hex32, ProviderTransactionPort420 } from './types.js';

/** No keys, signatures or user funds pass through this port. The external executor
 * must enforce operator authorization and return a canonically confirmed receipt. */
export interface QualifiedComputeExecutor420 {
  readonly chainId: bigint;
  readonly computeJobsAddress: string;
  readonly computeReceiptsAddress: string;
  operatorAddress(): Promise<string>;
  sendAndConfirm(input: { target: string; method: 'accept' | 'markRunning' | 'commitResult' | 'submitReceipt'; args: readonly (string | bigint)[] }): Promise<{ txHash: string; confirmed: boolean; success: boolean; chainId: bigint; target: string }>;
  receiptHead(jobId: Hex32): Promise<{ sequence: bigint; receiptId: Hex32; units: bigint; charge420: bigint }>;
  canonicalReceiptId(input: { jobId: Hex32; sequence: bigint; priorReceiptHash: Hex32; cumulativeUnits: bigint; cumulativeCharge420: bigint; executionManifestHash: Hex32 }): Promise<Hex32>;
}

const ZERO = ('0x' + '00'.repeat(32)) as Hex32;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX = /^0x[0-9a-fA-F]{64}$/;
function validAddress(value: string): string { if (!ADDRESS.test(value) || /^0x0{40}$/i.test(value)) throw new Error('invalid compute contract/operator address'); return value.toLowerCase(); }
function validId(value: string): Hex32 { if (!BYTES32.test(value) || value.toLowerCase() === ZERO) throw new Error('invalid compute job/commitment id'); return value.toLowerCase() as Hex32; }

/** Re-reads canonical state on every transition. Never retries a broadcast blindly. */
export class QualifiedProviderTransactions420 implements ProviderTransactionPort420 {
  constructor(
    readonly aiProviderId: Hex32,
    readonly computeProviderId: Hex32,
    readonly chainId: bigint,
    readonly state: CanonicalStatePort420,
    readonly executor: QualifiedComputeExecutor420,
    readonly aiJobForComputeJob: (computeJobId: Hex32) => Promise<Hex32>
  ) {
    validId(aiProviderId); validId(computeProviderId);
    if (chainId <= 0n || executor.chainId !== chainId) throw new Error('external executor chain mismatch');
    validAddress(executor.computeJobsAddress); validAddress(executor.computeReceiptsAddress);
  }

  private async work(computeJobId: Hex32, expected: string) {
    const jobId = validId(computeJobId);
    const aiJobId = validId(await this.aiJobForComputeJob(jobId));
    const work = await this.state.getCanonicalWork(aiJobId, jobId);
    const { provider, aiJob, computeJob, computeRequest } = work;
    if (provider.providerId.toLowerCase() !== this.aiProviderId.toLowerCase() || provider.state !== 'ACTIVE' || provider.stakeRef.toLowerCase() === ZERO) throw new Error('AI provider not operational');
    if (provider.computeProviderRef.toLowerCase() !== this.computeProviderId.toLowerCase() || computeJob.providerId.toLowerCase() !== this.computeProviderId.toLowerCase() || aiJob.providerId.toLowerCase() !== this.aiProviderId.toLowerCase()) throw new Error('canonical provider binding mismatch');
    if (computeJob.jobId.toLowerCase() !== jobId || aiJob.computeJobId.toLowerCase() !== jobId || computeJob.requestId.toLowerCase() !== computeRequest.requestId.toLowerCase() || aiJob.computeRequestId.toLowerCase() !== computeRequest.requestId.toLowerCase()) throw new Error('canonical job/request binding mismatch');
    if (computeJob.state !== expected) throw new Error(`expected canonical Compute state ${expected}, got ${computeJob.state}`);
    const operator = validAddress(await this.executor.operatorAddress());
    // Only the operator or a chain-qualified delegate may advance a job. Executor must
    // prove its own authorization; do not infer authorization from an AI provider ID.
    if (operator !== validAddress(provider.operatorAccount)) throw new Error('operator identity mismatch; delegated execution not qualified');
    return work;
  }

  private async send(target: string, method: 'accept' | 'markRunning' | 'commitResult' | 'submitReceipt', args: readonly (string | bigint)[]): Promise<string> {
    const response = await this.executor.sendAndConfirm({ target, method, args });
    if (!response.confirmed || !response.success || response.chainId !== this.chainId || validAddress(response.target) !== validAddress(target) || !TX.test(response.txHash)) throw new Error('compute transaction not canonically confirmed');
    return response.txHash;
  }

  async acceptComputeJob(jobId: Hex32): Promise<string> {
    await this.work(jobId, 'MATCHED');
    return this.send(this.executor.computeJobsAddress, 'accept', [jobId]);
  }
  async markComputeRunning(jobId: Hex32): Promise<string> {
    await this.work(jobId, 'ACCEPTED');
    return this.send(this.executor.computeJobsAddress, 'markRunning', [jobId]);
  }
  async commitComputeResult(jobId: Hex32, outputCommitment: Hex32, resultManifestHash: Hex32): Promise<string> {
    await this.work(jobId, 'RUNNING');
    return this.send(this.executor.computeJobsAddress, 'commitResult', [jobId, validId(outputCommitment), validId(resultManifestHash)]);
  }
  async submitFinalReceipt(input: { jobId: Hex32; cumulativeUnits: bigint; cumulativeCharge420: bigint; executionManifestHash: Hex32; evidenceRef: Hex32 }): Promise<string> {
    const work = await this.work(input.jobId, 'RESULT_COMMITTED');
    if (input.cumulativeUnits <= 0n || input.cumulativeUnits > (1n << 128n) - 1n || input.cumulativeCharge420 < 0n || input.cumulativeCharge420 > work.computeRequest.fundedAmount420 || input.cumulativeCharge420 > work.aiJob.maxSpend420) throw new Error('receipt exceeds canonical metering/funding limits');
    const manifest = validId(input.executionManifestHash);
    if (work.computeJob.resultManifestHash?.toLowerCase() !== manifest) throw new Error('canonical result manifest mismatch');
    const head = await this.executor.receiptHead(input.jobId);
    if (head.sequence !== 0n || head.receiptId.toLowerCase() !== ZERO || head.units !== 0n || head.charge420 !== 0n) throw new Error('final receipt already submitted or non-empty receipt history: reconcile before retry');
    const receiptId = validId(await this.executor.canonicalReceiptId({jobId:input.jobId,sequence:1n,priorReceiptHash:ZERO,cumulativeUnits:input.cumulativeUnits,cumulativeCharge420:input.cumulativeCharge420,executionManifestHash:manifest}));
    if (!BYTES32.test(input.evidenceRef)) throw new Error('invalid evidence reference');
    return this.send(this.executor.computeReceiptsAddress, 'submitReceipt', [receiptId,input.jobId,1n,ZERO,input.cumulativeUnits,input.cumulativeCharge420,manifest,input.evidenceRef]);
  }
}
