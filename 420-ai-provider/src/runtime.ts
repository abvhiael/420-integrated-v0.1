import { bytesCommitment420, objectCommitment420 } from './commitments.js';
import { validateProviderManifest420, type ProviderRuntimeManifest420 } from './manifest.js';
import type {
  CanonicalStatePort420, InferenceBackend420, PayloadPort420, ProviderTransactionPort420,
  ProviderWorkItem420, RuntimeClock420, Hex32
} from './types.js';

export interface ProviderRuntimeConfig420 {
  providerId: Hex32;
  computeProviderId: Hex32;
  manifest: ProviderRuntimeManifest420;
  unitPrice420: bigint;
}

export type ProviderRunOutcome420 =
  | { state: 'ACCEPTED'; txHash: string }
  | { state: 'RUNNING'; txHash: string }
  | { state: 'RESULT_COMMITTED'; commitTxHash: string; receiptTxHash: string; outputRef: string; outputCommitment: Hex32; resultManifestHash: Hex32 }
  | { state: 'WAIT'; reason: string };

export class AIProviderRuntime420 {
  constructor(
    readonly config: ProviderRuntimeConfig420,
    readonly chain: CanonicalStatePort420,
    readonly payloads: PayloadPort420,
    readonly backend: InferenceBackend420,
    readonly transactions: ProviderTransactionPort420,
    readonly clock: RuntimeClock420 = { nowMs: () => Date.now() }
  ) {}

  async readiness(): Promise<{ ready: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    try { validateProviderManifest420(this.config.manifest, this.clock.nowMs()); }
    catch (error) { reasons.push(error instanceof Error ? error.message : 'invalid provider manifest'); }
    if (this.config.manifest.providerId.toLowerCase() !== this.config.providerId.toLowerCase()) reasons.push('manifest providerId mismatch');
    if (this.config.manifest.computeProviderId.toLowerCase() !== this.config.computeProviderId.toLowerCase()) reasons.push('manifest computeProviderId mismatch');
    if (!(await this.backend.health())) reasons.push('inference backend unhealthy');
    return { ready: reasons.length === 0, reasons };
  }

  async process(item: ProviderWorkItem420): Promise<ProviderRunOutcome420> {
    const ready = await this.readiness();
    if (!ready.ready) return { state: 'WAIT', reason: `provider not ready: ${ready.reasons.join('; ')}` };

    const canonical = await this.chain.getCanonicalWork(item.aiJobId, item.computeJobId);
    const { provider, aiJob, computeJob, computeRequest } = canonical;

    if (provider.providerId.toLowerCase() !== this.config.providerId.toLowerCase()) throw new Error('AI provider identity mismatch');
    if (provider.state !== 'ACTIVE' || /^0x0{64}$/i.test(provider.stakeRef)) throw new Error('AI provider is not operational');
    if (provider.computeProviderRef.toLowerCase() !== this.config.computeProviderId.toLowerCase()) throw new Error('AI/Compute provider binding mismatch');
    if (aiJob.providerId.toLowerCase() !== this.config.providerId.toLowerCase()) throw new Error('AI job is assigned to a different provider');
    if (aiJob.computeJobId.toLowerCase() !== computeJob.jobId.toLowerCase()) throw new Error('AI job computeJobId mismatch');
    if (computeJob.providerId.toLowerCase() !== this.config.computeProviderId.toLowerCase()) throw new Error('compute job is assigned to a different provider');
    if (aiJob.computeRequestId.toLowerCase() !== computeRequest.requestId.toLowerCase()) throw new Error('AI job computeRequestId mismatch');
    if (computeJob.requestId.toLowerCase() !== computeRequest.requestId.toLowerCase()) throw new Error('compute job requestId mismatch');
    if (aiJob.requester.toLowerCase() !== computeRequest.requester.toLowerCase()) throw new Error('AI/Compute requester mismatch');
    if (aiJob.workloadClass.toLowerCase() !== computeRequest.workloadClass.toLowerCase()) throw new Error('AI/Compute workload mismatch');
    if (aiJob.privacyPolicyId.toLowerCase() !== computeRequest.privacyPolicyId.toLowerCase()) throw new Error('AI/Compute privacy policy mismatch');
    if (aiJob.verificationProfileId.toLowerCase() !== computeRequest.verificationProfileId.toLowerCase()) throw new Error('AI/Compute verification profile mismatch');
    if (computeRequest.maxSpend420 > aiJob.maxSpend420 || computeRequest.fundedAmount420 > aiJob.maxSpend420) throw new Error('Compute request broadens AI spend authority');
    if (computeRequest.deadline > aiJob.deadline) throw new Error('Compute request broadens AI deadline');
    if (this.clock.nowMs() > aiJob.deadline * 1000) return { state: 'WAIT', reason: 'job deadline expired' };

    if (computeJob.state === 'MATCHED') {
      return { state: 'ACCEPTED', txHash: await this.transactions.acceptComputeJob(computeJob.jobId) };
    }
    if (computeJob.state === 'ACCEPTED') {
      return { state: 'RUNNING', txHash: await this.transactions.markComputeRunning(computeJob.jobId) };
    }
    if (computeJob.state !== 'RUNNING') return { state: 'WAIT', reason: `compute job state ${computeJob.state} is not executable` };

    const input = await this.payloads.get(item.payloadRef);
    const inputCommitment = bytesCommitment420(input);
    if (inputCommitment.toLowerCase() !== computeRequest.inputCommitment.toLowerCase()) throw new Error('payload commitment does not match canonical compute request');
    if (aiJob.requestHash.toLowerCase() !== computeRequest.inputCommitment.toLowerCase()) throw new Error('AI request commitment does not match Compute input commitment');

    const result = await this.backend.execute({
      jobId: aiJob.jobId,
      modelVersionId: aiJob.modelVersionId,
      workloadClass: aiJob.workloadClass,
      input,
      privacyPolicyId: aiJob.privacyPolicyId,
      verificationProfileId: aiJob.verificationProfileId
    });
    if (result.units <= 0n) throw new Error('backend returned zero execution units');

    const outputCommitment = bytesCommitment420(result.output);
    const outputRef = await this.payloads.put(result.output, 'application/octet-stream');
    const evidenceRef = result.evidence ? bytesCommitment420(result.evidence) : ('0x' + '00'.repeat(32)) as Hex32;
    const executionManifest = {
      schema: '420-ai-execution-manifest-v1',
      aiJobId: aiJob.jobId,
      computeJobId: computeJob.jobId,
      providerId: this.config.providerId,
      computeProviderId: this.config.computeProviderId,
      modelVersionId: aiJob.modelVersionId,
      workloadClass: aiJob.workloadClass,
      inputCommitment,
      outputCommitment,
      outputRef,
      units: result.units.toString(),
      runtimeMetadata: result.runtimeMetadata ?? {},
      completedAt: Math.floor(this.clock.nowMs() / 1000)
    };
    const resultManifestHash = objectCommitment420(executionManifest);
    const charge = result.units * this.config.unitPrice420;
    if (charge > computeRequest.fundedAmount420 || charge > aiJob.maxSpend420) throw new Error('execution charge exceeds canonical funding/spend ceiling');

    const commitTxHash = await this.transactions.commitComputeResult(computeJob.jobId, outputCommitment, resultManifestHash);
    const receiptTxHash = await this.transactions.submitFinalReceipt({
      jobId: computeJob.jobId,
      cumulativeUnits: result.units,
      cumulativeCharge420: charge,
      executionManifestHash: resultManifestHash,
      evidenceRef
    });

    return { state: 'RESULT_COMMITTED', commitTxHash, receiptTxHash, outputRef, outputCommitment, resultManifestHash };
  }
}
