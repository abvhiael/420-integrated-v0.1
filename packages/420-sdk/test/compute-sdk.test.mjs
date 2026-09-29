import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPUTE_WORKER_READ_MODEL_METHODS_420,
  ComputeReadModelError420,
  createComputeWorkerClient420,
  validateAttemptBundle420,
  validateWorkerRevision420
} from '../dist/index.js';

const b32 = (n) => '0x' + n.toString(16).padStart(64, '0');
const addr = (n) => '0x' + n.toString(16).padStart(40, '0');

function identity(revision = 7n) {
  return {
    providerId: b32(1),
    nodeId: b32(2),
    resourceId: b32(3),
    operator: addr(4),
    executionSigner: addr(5),
    executionKeyCommitment: b32(6),
    capabilityProfileHash: b32(7),
    jurisdictionHash: b32(8),
    resourceRevision: 3n,
    createdAt: 100n,
    revision,
    status: 2
  };
}

function profile() {
  return {
    profileHash: b32(7),
    vramMiB: 16384n,
    memoryMiB: 65536n,
    storageGiB: 1000n,
    networkMbps: 1000n,
    storageClassHash: b32(9),
    networkCapabilityHash: b32(10),
    runtimeCapabilityHash: b32(11),
    exists: true
  };
}

function assignment(jobId = b32(20)) {
  return {
    jobId,
    matchId: b32(21),
    acceptanceRef: b32(22),
    workerId: b32(23),
    workerRevision: 7n,
    providerId: b32(1),
    nodeId: b32(2),
    resourceId: b32(3),
    resourceRevision: 3n,
    operator: addr(4),
    executionSigner: addr(5),
    executionKeyCommitment: b32(6),
    capabilityProfileHash: b32(7),
    jurisdictionHash: b32(8),
    admission: {
      capabilityPolicyId: b32(24),
      capabilityAttestationId: b32(25),
      trustPolicyId: b32(26),
      trustReference: b32(27),
      stakePolicyId: b32(28),
      stakeReference: b32(29)
    },
    snapshotCommitment: b32(30),
    reservationId: b32(31),
    attempt: 2n,
    resultCommitment: b32(0),
    receiptHash: b32(0),
    exists: true
  };
}

function reader() {
  const jobId = b32(20);
  const root = b32(40);
  const latest = b32(41);
  const calls = [];
  return {
    calls,
    jobId,
    api: {
      workerRevision: async () => identity(),
      capabilityProfile: async () => profile(),
      eligibility: async (query) => {
        calls.push(query);
        return { workerEligible: true, capabilityEligible: true, trustEligible: true, stakeEligible: true };
      },
      attestationCore: async () => ({ workerRevision: 7n }),
      attestationProvenance: async () => ({ schemaRevision: 2 }),
      trustReference: async () => ({ metricRevision: 3 }),
      stakeReference: async () => ({ positionRevision: 4n }),
      capacityUsage: async () => ({
        liveWorkerUnits: 1n,
        liveWorkerRevisionUnits: 1n,
        liveResourceUnits: 1n,
        liveResourceRevisionUnits: 1n
      }),
      attemptIndex: async () => ({ rootAssignmentRef: root, latestAssignmentRef: latest, attemptCount: 2n }),
      assignment: async () => assignment(jobId),
      attemptLifecycle: async () => ({
        rootAssignmentRef: root,
        previousAttemptRef: b32(39),
        constraintCommitment: b32(42),
        acceptedDeadline: 1000n,
        openedAt: 500n,
        closedAt: 0n,
        resultCommittedAt: 0n,
        transitionRef: b32(0),
        status: 1,
        exists: true
      })
    }
  };
}

test('publishes deterministic canonical read method surface', () => {
  assert.equal(COMPUTE_WORKER_READ_MODEL_METHODS_420[0], 'schemaVersion()');
  assert.ok(COMPUTE_WORKER_READ_MODEL_METHODS_420.includes('attemptLifecycle(bytes32)'));
  assert.equal(new Set(COMPUTE_WORKER_READ_MODEL_METHODS_420).size, COMPUTE_WORKER_READ_MODEL_METHODS_420.length);
});

test('reconstructs exact worker revision and capability profile', async () => {
  const r = reader();
  const client = createComputeWorkerClient420(r.api);
  const out = await client.worker(b32(23), 7n);
  assert.equal(out.identity.revision, 7n);
  assert.equal(out.capability.profileHash, out.identity.capabilityProfileHash);
});

test('rejects stale worker revisions before client consumption', () => {
  assert.throws(
    () => validateWorkerRevision420(b32(23), 6n, identity(7n)),
    ComputeReadModelError420
  );
});

test('reconstructs latest accepted attempt under immutable root', async () => {
  const r = reader();
  const client = createComputeWorkerClient420(r.api);
  const out = await client.acceptedAttempt(r.jobId);
  assert.equal(out.index.attemptCount, 2n);
  assert.equal(out.assignment.attempt, 2n);
  assert.equal(out.lifecycle.rootAssignmentRef, out.index.rootAssignmentRef);
});

test('rejects stale attempt fixtures and root drift', () => {
  assert.throws(() => validateAttemptBundle420(
    b32(20),
    { rootAssignmentRef: b32(40), latestAssignmentRef: b32(41), attemptCount: 3n },
    assignment(),
    {
      rootAssignmentRef: b32(99),
      previousAttemptRef: b32(39),
      constraintCommitment: b32(42),
      acceptedDeadline: 1000n,
      openedAt: 500n,
      closedAt: 0n,
      resultCommittedAt: 0n,
      transitionRef: b32(0),
      status: 1,
      exists: true
    }
  ), ComputeReadModelError420);
});

test('supports explicit non-AI workloads without privileged matcher assumptions', async () => {
  const r = reader();
  const client = createComputeWorkerClient420(r.api);
  const query = {
    workloadType: 'VIDEO_TRANSCODE',
    workerId: b32(23),
    workerRevision: 7n,
    requirements: { requiredSoftwareCapability: b32(77) }
  };
  const out = await client.admission(query);
  assert.deepEqual(out, {
    workerEligible: true,
    capabilityEligible: true,
    trustEligible: true,
    stakeEligible: true
  });
  assert.equal(r.calls[0].workloadType, 'VIDEO_TRANSCODE');
});

test('rejects malformed public reference identifiers', async () => {
  const r = reader();
  const client = createComputeWorkerClient420(r.api);
  await assert.rejects(() => client.attestation('0x1234'), ComputeReadModelError420);
});


test('repository descriptor matches SDK canonical method surface', async () => {
  const raw = await readFile(new URL('../../../420-indexer/descriptors/compute-worker-read-model-v1.json', import.meta.url), 'utf8');
  const descriptor = JSON.parse(raw);
  assert.equal(descriptor.schema, '420-compute-worker-read-model-v1');
  assert.equal(descriptor.callerPrivilegesRequired, false);
  assert.deepEqual(descriptor.methods, [...COMPUTE_WORKER_READ_MODEL_METHODS_420]);
  assert.ok(descriptor.consumers.includes('matcher'));
  assert.ok(descriptor.consumers.includes('worker-agent'));
  assert.ok(descriptor.consumers.includes('indexer'));
  assert.ok(descriptor.consumers.includes('application'));
  assert.deepEqual(descriptor.explicitNonAiCoverage, ['VIDEO_TRANSCODE']);
});

test('stale and malformed fixtures remain machine-consumable and fail closed', async () => {
  const raw = await readFile(new URL('./fixtures/compute-worker-read-model-v1.json', import.meta.url), 'utf8');
  const fixtures = JSON.parse(raw);
  const stale = fixtures.staleRevision;
  assert.throws(
    () => validateWorkerRevision420(stale.workerId, BigInt(stale.expectedRevision), identity(BigInt(stale.actualRevision))),
    new RegExp(stale.expectedError)
  );
  const r = reader();
  const client = createComputeWorkerClient420(r.api);
  await assert.rejects(
    () => client.attestation(fixtures.invalidReference.attestationId),
    new RegExp(fixtures.invalidReference.expectedError)
  );
  assert.equal(fixtures.valid.workloadType, 'VIDEO_TRANSCODE');
});
