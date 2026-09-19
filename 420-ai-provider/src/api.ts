import type { ProviderRuntimeManifest420 } from './manifest.js';
import type { CanonicalWork420 } from './types.js';

export interface ProviderStatusDto420 {
  service: '420-ai-provider';
  apiVersion: 'v1';
  ready: boolean;
  reasons: string[];
  providerId: string;
  computeProviderId: string;
  manifestExpiresAt: number;
  authoritative: false;
}

export function providerStatus420(
  manifest: ProviderRuntimeManifest420,
  readiness: { ready: boolean; reasons: string[] }
): ProviderStatusDto420 {
  return {
    service: '420-ai-provider',
    apiVersion: 'v1',
    ready: readiness.ready,
    reasons: [...readiness.reasons],
    providerId: manifest.providerId,
    computeProviderId: manifest.computeProviderId,
    manifestExpiresAt: manifest.expiresAt,
    authoritative: false
  };
}

export function projectCanonicalWork420(work: CanonicalWork420) {
  return {
    aiJobId: work.aiJob.jobId,
    aiState: work.aiJob.state,
    computeJobId: work.computeJob.jobId,
    computeState: work.computeJob.state,
    providerId: work.aiJob.providerId,
    computeProviderId: work.computeJob.providerId,
    modelVersionId: work.aiJob.modelVersionId,
    workloadClass: work.aiJob.workloadClass,
    deadline: work.aiJob.deadline,
    maxSpend420: work.aiJob.maxSpend420.toString(),
    fundedAmount420: work.computeRequest.fundedAmount420.toString(),
    authoritative: false,
    source: 'canonical-chain-projection'
  } as const;
}
