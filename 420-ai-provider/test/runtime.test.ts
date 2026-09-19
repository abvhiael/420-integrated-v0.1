import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIProviderRuntime420, bytesCommitment420,
  type CanonicalWork420, type Hex32, type Address420
} from '../src/index.js';

const h = (c: string) => ('0x' + c.repeat(64)) as Hex32;
const a = (c: string) => ('0x' + c.repeat(40)) as Address420;
const providerId = h('1');
const computeProviderId = h('2');
const aiJobId = h('3');
const computeJobId = h('4');
const requestId = h('5');
const workload = h('6');
const model = h('7');
const privacy = h('8');
const verify = h('9');
const resource = h('a');
const stake = h('b');
const input = new TextEncoder().encode('hello 420 ai');
const inputCommitment = bytesCommitment420(input);
const now = 1_800_000_000_000;

function work(state: CanonicalWork420['computeJob']['state'] = 'RUNNING'): CanonicalWork420 {
  return {
    provider: {
      providerId,
      operatorAccount: a('1'),
      settlementAccount: a('2'),
      stakeRef: stake,
      computeProviderRef: computeProviderId,
      state: 'ACTIVE'
    },
    aiJob: {
      jobId: aiJobId,
      requester: a('3'),
      modelVersionId: model,
      workloadClass: workload,
      requestHash: inputCommitment,
      privacyPolicyId: privacy,
      verificationProfileId: verify,
      maxSpend420: 1000n,
      deadline: Math.floor(now / 1000) + 3600,
      computeRequestId: requestId,
      computeJobId,
      providerId,
      state: state === 'MATCHED' ? 'MATCHED' : state === 'ACCEPTED' ? 'ACCEPTED' : 'RUNNING'
    },
    computeJob: {
      jobId: computeJobId,
      requestId,
      providerId: computeProviderId,
      resourceId: resource,
      state
    },
    computeRequest: {
      requestId,
      requester: a('3'),
      workloadClass: workload,
      inputCommitment,
      maxSpend420: 1000n,
      fundedAmount420: 1000n,
      deadline: Math.floor(now / 1000) + 3500,
      privacyPolicyId: privacy,
      verificationProfileId: verify
    }
  };
}

function runtime420(canonical = work(), payload = input) {
  const calls: string[] = [];
  const stored: Uint8Array[] = [];
  const runtime = new AIProviderRuntime420(
    {
      providerId,
      computeProviderId,
      unitPrice420: 2n,
      manifest: {
        schema: '420-ai-provider-manifest-v1',
        providerId,
        computeProviderId,
        operatorAccount: a('1'),
        serviceUrl: 'https://provider.example',
        issuedAt: now - 1000,
        expiresAt: now + 60_000,
        capabilities: [{ resourceId: resource, workloadClasses: [workload], runtimeProfile: 'mock/v1', maxConcurrentJobs: 1 }],
        modelDeployments: [{ modelVersionId: model, deploymentId: h('c'), artifactCommitment: h('d'), runtimeProfile: 'mock/v1' }]
      }
    },
    { getCanonicalWork: async () => canonical },
    {
      get: async () => payload,
      put: async (bytes) => { stored.push(bytes); return 'store://result/1'; }
    },
    {
      health: async () => true,
      execute: async () => ({ output: new TextEncoder().encode('result'), units: 21n, runtimeMetadata: { backend: 'mock' } })
    },
    {
      acceptComputeJob: async () => { calls.push('accept'); return '0xaccept'; },
      markComputeRunning: async () => { calls.push('running'); return '0xrunning'; },
      commitComputeResult: async () => { calls.push('commit'); return '0xcommit'; },
      submitFinalReceipt: async ({ cumulativeCharge420 }) => {
        calls.push(`receipt:${cumulativeCharge420}`);
        return '0xreceipt';
      }
    },
    { nowMs: () => now }
  );
  return { runtime, calls, stored };
}

test('provider runtime advances matched compute jobs only through external transaction port', async () => {
  const { runtime, calls } = runtime420(work('MATCHED'));
  const outcome = await runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' });
  assert.deepEqual(outcome, { state: 'ACCEPTED', txHash: '0xaccept' });
  assert.deepEqual(calls, ['accept']);
});

test('provider runtime advances accepted jobs to running before executing payloads', async () => {
  const { runtime, calls } = runtime420(work('ACCEPTED'));
  const outcome = await runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' });
  assert.deepEqual(outcome, { state: 'RUNNING', txHash: '0xrunning' });
  assert.deepEqual(calls, ['running']);
});

test('running job verifies canonical bindings, executes backend and submits bounded result/receipt', async () => {
  const { runtime, calls, stored } = runtime420();
  const outcome = await runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' });
  assert.equal(outcome.state, 'RESULT_COMMITTED');
  assert.deepEqual(calls, ['commit', 'receipt:42']);
  assert.equal(stored.length, 1);
});

test('payload commitment mismatch fails before inference or chain mutation', async () => {
  const { runtime, calls } = runtime420(work(), new TextEncoder().encode('tampered'));
  await assert.rejects(
    runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' }),
    /payload commitment does not match/
  );
  assert.deepEqual(calls, []);
});

test('AI/Compute provider identity mismatch fails closed', async () => {
  const canonical = work();
  canonical.computeJob.providerId = h('f');
  const { runtime, calls } = runtime420(canonical);
  await assert.rejects(
    runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' }),
    /different provider/
  );
  assert.deepEqual(calls, []);
});

test('execution charge cannot exceed canonical funded amount', async () => {
  const canonical = work();
  canonical.computeRequest.fundedAmount420 = 20n;
  const { runtime, calls } = runtime420(canonical);
  await assert.rejects(
    runtime.process({ aiJobId, computeJobId, payloadRef: 'store://input/1' }),
    /charge exceeds canonical/
  );
  assert.deepEqual(calls, []);
});
