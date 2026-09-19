import { objectCommitment420 } from './commitments.js';
import type { Address420, Hex32 } from './types.js';

export interface ProviderCapability420 {
  resourceId: Hex32;
  workloadClasses: Hex32[];
  runtimeProfile: string;
  maxConcurrentJobs: number;
}

export interface ModelDeployment420 {
  modelVersionId: Hex32;
  deploymentId: Hex32;
  artifactCommitment: Hex32;
  runtimeProfile: string;
}

export interface ProviderRuntimeManifest420 {
  schema: '420-ai-provider-manifest-v1';
  providerId: Hex32;
  computeProviderId: Hex32;
  operatorAccount: Address420;
  serviceUrl: string;
  issuedAt: number;
  expiresAt: number;
  capabilities: ProviderCapability420[];
  modelDeployments: ModelDeployment420[];
}

function assertId420(value: string, label: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32`);
}

function assertAddress420(value: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('operatorAccount must be an address');
}

export function validateProviderManifest420(manifest: ProviderRuntimeManifest420, nowMs: number): void {
  if (manifest.schema !== '420-ai-provider-manifest-v1') throw new Error('unsupported provider manifest schema');
  assertId420(manifest.providerId, 'providerId');
  assertId420(manifest.computeProviderId, 'computeProviderId');
  assertAddress420(manifest.operatorAccount);
  let url: URL;
  try { url = new URL(manifest.serviceUrl); } catch { throw new Error('serviceUrl must be a URL'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('serviceUrl must use HTTPS outside localhost');
  }
  if (!Number.isSafeInteger(manifest.issuedAt) || !Number.isSafeInteger(manifest.expiresAt)) throw new Error('manifest timestamps invalid');
  if (manifest.issuedAt > nowMs || manifest.expiresAt <= nowMs || manifest.expiresAt <= manifest.issuedAt) {
    throw new Error('provider manifest is not currently valid');
  }
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) throw new Error('provider manifest requires capabilities');
  for (const capability of manifest.capabilities) {
    assertId420(capability.resourceId, 'resourceId');
    if (!Array.isArray(capability.workloadClasses) || capability.workloadClasses.length === 0) throw new Error('capability requires workload classes');
    capability.workloadClasses.forEach((v) => assertId420(v, 'workloadClass'));
    if (!capability.runtimeProfile) throw new Error('runtimeProfile required');
    if (!Number.isInteger(capability.maxConcurrentJobs) || capability.maxConcurrentJobs < 1) throw new Error('maxConcurrentJobs invalid');
  }
  for (const deployment of manifest.modelDeployments) {
    assertId420(deployment.modelVersionId, 'modelVersionId');
    assertId420(deployment.deploymentId, 'deploymentId');
    assertId420(deployment.artifactCommitment, 'artifactCommitment');
    if (!deployment.runtimeProfile) throw new Error('deployment runtimeProfile required');
  }
}

export function providerManifestCommitment420(manifest: ProviderRuntimeManifest420, nowMs: number): Hex32 {
  validateProviderManifest420(manifest, nowMs);
  return objectCommitment420(manifest);
}
