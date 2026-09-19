import test from 'node:test';
import assert from 'node:assert/strict';
import { providerManifestCommitment420, validateProviderManifest420, type Hex32, type Address420 } from '../src/index.js';

const h = (c: string) => ('0x' + c.repeat(64)) as Hex32;
const a = (c: string) => ('0x' + c.repeat(40)) as Address420;
const now = 1_800_000_000_000;

const manifest = {
  schema: '420-ai-provider-manifest-v1' as const,
  providerId: h('1'),
  computeProviderId: h('2'),
  operatorAccount: a('3'),
  serviceUrl: 'https://provider.example',
  issuedAt: now - 1000,
  expiresAt: now + 60_000,
  capabilities: [{ resourceId: h('4'), workloadClasses: [h('5')], runtimeProfile: 'cuda/v1', maxConcurrentJobs: 2 }],
  modelDeployments: [{ modelVersionId: h('6'), deploymentId: h('7'), artifactCommitment: h('8'), runtimeProfile: 'cuda/v1' }]
};

test('provider manifest validates and produces deterministic commitment', () => {
  validateProviderManifest420(manifest, now);
  const one = providerManifestCommitment420(manifest, now);
  const two = providerManifestCommitment420({ ...manifest, capabilities: [...manifest.capabilities] }, now);
  assert.equal(one, two);
  assert.match(one, /^0x[0-9a-f]{64}$/);
});

test('provider manifest rejects insecure non-local service URLs', () => {
  assert.throws(() => validateProviderManifest420({ ...manifest, serviceUrl: 'http://provider.example' }, now), /HTTPS/);
});

test('provider manifest rejects expired manifests', () => {
  assert.throws(() => validateProviderManifest420({ ...manifest, expiresAt: now - 1 }, now), /not currently valid/);
});
