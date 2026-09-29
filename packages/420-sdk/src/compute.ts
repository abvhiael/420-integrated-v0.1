export type Hex420 = `0x${string}`;

export const COMPUTE_WORKER_READ_MODEL_SCHEMA_420 = '420-compute-worker-read-model-v1' as const;
export const COMPUTE_WORKER_READ_MODEL_VERSION_420 = 1 as const;

export const COMPUTE_WORKER_READ_MODEL_METHODS_420 = Object.freeze([
  'schemaVersion()',
  'components()',
  'domains()',
  'currentWorker(bytes32)',
  'workerRevision(bytes32,uint64)',
  'capabilityProfile(bytes32,uint64)',
  'capabilityArchitectures(bytes32,uint64)',
  'capabilityCpuClasses(bytes32,uint64)',
  'capabilityGpuClasses(bytes32,uint64)',
  'capabilitySoftware(bytes32,uint64)',
  'eligibility((bytes32,uint64,(bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64,uint64,uint64,bytes32,bytes32,bytes32),bool,bytes32,bytes32,bytes32,bool,bytes32,bytes32,bool,bytes32))',
  'attestationCore(bytes32)',
  'attestationProvenance(bytes32)',
  'trustReference(bytes32)',
  'stakeReference(bytes32)',
  'capacityUsage(bytes32,uint64,bytes32,uint64)',
  'reservationForJob(bytes32)',
  'attemptIndex(bytes32)',
  'assignment(bytes32)',
  'attemptLifecycle(bytes32)'
] as const);

export interface ComputeWorkerIdentity420 {
  readonly providerId: Hex420;
  readonly nodeId: Hex420;
  readonly resourceId: Hex420;
  readonly operator: Hex420;
  readonly executionSigner: Hex420;
  readonly executionKeyCommitment: Hex420;
  readonly capabilityProfileHash: Hex420;
  readonly jurisdictionHash: Hex420;
  readonly resourceRevision: bigint;
  readonly createdAt: bigint;
  readonly revision: bigint;
  readonly status: number;
}

export interface ComputeCapabilityProfile420 {
  readonly profileHash: Hex420;
  readonly vramMiB: bigint;
  readonly memoryMiB: bigint;
  readonly storageGiB: bigint;
  readonly networkMbps: bigint;
  readonly storageClassHash: Hex420;
  readonly networkCapabilityHash: Hex420;
  readonly runtimeCapabilityHash: Hex420;
  readonly exists: boolean;
}

export interface ComputeEligibility420 {
  readonly workerEligible: boolean;
  readonly capabilityEligible: boolean;
  readonly trustEligible: boolean;
  readonly stakeEligible: boolean;
}

export interface ComputeCapacityView420 {
  readonly liveWorkerUnits: bigint;
  readonly liveWorkerRevisionUnits: bigint;
  readonly liveResourceUnits: bigint;
  readonly liveResourceRevisionUnits: bigint;
}

export interface ComputeAttemptIndex420 {
  readonly rootAssignmentRef: Hex420;
  readonly latestAssignmentRef: Hex420;
  readonly attemptCount: bigint;
}

export interface ComputeAdmissionRefs420 {
  readonly capabilityPolicyId: Hex420;
  readonly capabilityAttestationId: Hex420;
  readonly trustPolicyId: Hex420;
  readonly trustReference: Hex420;
  readonly stakePolicyId: Hex420;
  readonly stakeReference: Hex420;
}

export interface ComputeAssignment420 {
  readonly jobId: Hex420;
  readonly matchId: Hex420;
  readonly acceptanceRef: Hex420;
  readonly workerId: Hex420;
  readonly workerRevision: bigint;
  readonly providerId: Hex420;
  readonly nodeId: Hex420;
  readonly resourceId: Hex420;
  readonly resourceRevision: bigint;
  readonly operator: Hex420;
  readonly executionSigner: Hex420;
  readonly executionKeyCommitment: Hex420;
  readonly capabilityProfileHash: Hex420;
  readonly jurisdictionHash: Hex420;
  readonly admission: ComputeAdmissionRefs420;
  readonly snapshotCommitment: Hex420;
  readonly reservationId: Hex420;
  readonly attempt: bigint;
  readonly resultCommitment: Hex420;
  readonly receiptHash: Hex420;
  readonly exists: boolean;
}

export interface ComputeAttemptLifecycle420 {
  readonly rootAssignmentRef: Hex420;
  readonly previousAttemptRef: Hex420;
  readonly constraintCommitment: Hex420;
  readonly acceptedDeadline: bigint;
  readonly openedAt: bigint;
  readonly closedAt: bigint;
  readonly resultCommittedAt: bigint;
  readonly transitionRef: Hex420;
  readonly status: number;
  readonly exists: boolean;
}

export interface ComputeWorkerReader420 {
  workerRevision(workerId: Hex420, revision: bigint): Promise<ComputeWorkerIdentity420>;
  capabilityProfile(workerId: Hex420, revision: bigint): Promise<ComputeCapabilityProfile420>;
  eligibility(query: Readonly<Record<string, unknown>>): Promise<ComputeEligibility420>;
  attestationCore(attestationId: Hex420): Promise<unknown>;
  attestationProvenance(attestationId: Hex420): Promise<unknown>;
  trustReference(referenceId: Hex420): Promise<unknown>;
  stakeReference(referenceId: Hex420): Promise<unknown>;
  capacityUsage(workerId: Hex420, workerRevision: bigint, resourceId: Hex420, resourceRevision: bigint): Promise<ComputeCapacityView420>;
  attemptIndex(jobId: Hex420): Promise<ComputeAttemptIndex420>;
  assignment(assignmentRef: Hex420): Promise<ComputeAssignment420>;
  attemptLifecycle(assignmentRef: Hex420): Promise<ComputeAttemptLifecycle420>;
}

export class ComputeReadModelError420 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComputeReadModelError420';
  }
}

function assertBytes32420(value: string, label: string): asserts value is Hex420 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new ComputeReadModelError420(`${label} must be bytes32 hex`);
}

function assertAddress420(value: string, label: string): asserts value is Hex420 {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new ComputeReadModelError420(`${label} must be address hex`);
}

export function validateWorkerRevision420(
  workerId: Hex420,
  expectedRevision: bigint,
  worker: ComputeWorkerIdentity420
): ComputeWorkerIdentity420 {
  assertBytes32420(workerId, 'workerId');
  if (expectedRevision <= 0n || worker.revision !== expectedRevision) {
    throw new ComputeReadModelError420('stale or mismatched worker revision');
  }
  assertBytes32420(worker.providerId, 'providerId');
  assertBytes32420(worker.nodeId, 'nodeId');
  assertBytes32420(worker.resourceId, 'resourceId');
  assertAddress420(worker.operator, 'operator');
  assertAddress420(worker.executionSigner, 'executionSigner');
  assertBytes32420(worker.executionKeyCommitment, 'executionKeyCommitment');
  assertBytes32420(worker.capabilityProfileHash, 'capabilityProfileHash');
  return worker;
}

export function validateCapabilityProfile420(
  worker: ComputeWorkerIdentity420,
  profile: ComputeCapabilityProfile420
): ComputeCapabilityProfile420 {
  if (!profile.exists || profile.profileHash.toLowerCase() !== worker.capabilityProfileHash.toLowerCase()) {
    throw new ComputeReadModelError420('capability profile does not match frozen worker revision');
  }
  return profile;
}

export function validateAttemptBundle420(
  jobId: Hex420,
  index: ComputeAttemptIndex420,
  assignment: ComputeAssignment420,
  lifecycle: ComputeAttemptLifecycle420
): void {
  assertBytes32420(jobId, 'jobId');
  assertBytes32420(index.rootAssignmentRef, 'rootAssignmentRef');
  assertBytes32420(index.latestAssignmentRef, 'latestAssignmentRef');
  if (index.attemptCount <= 0n || !assignment.exists || !lifecycle.exists) {
    throw new ComputeReadModelError420('accepted attempt is missing');
  }
  if (assignment.jobId.toLowerCase() !== jobId.toLowerCase()) {
    throw new ComputeReadModelError420('assignment job mismatch');
  }
  if (assignment.attempt !== index.attemptCount) {
    throw new ComputeReadModelError420('stale attempt revision');
  }
  if (lifecycle.rootAssignmentRef.toLowerCase() !== index.rootAssignmentRef.toLowerCase()) {
    throw new ComputeReadModelError420('attempt root mismatch');
  }
}

export interface ComputeWorkerClient420 {
  worker(workerId: Hex420, revision: bigint): Promise<{
    readonly identity: ComputeWorkerIdentity420;
    readonly capability: ComputeCapabilityProfile420;
  }>;
  admission(query: Readonly<Record<string, unknown>>): Promise<ComputeEligibility420>;
  attestation(attestationId: Hex420): Promise<{ readonly core: unknown; readonly provenance: unknown }>;
  trust(referenceId: Hex420): Promise<unknown>;
  stake(referenceId: Hex420): Promise<unknown>;
  capacity(workerId: Hex420, workerRevision: bigint, resourceId: Hex420, resourceRevision: bigint): Promise<ComputeCapacityView420>;
  acceptedAttempt(jobId: Hex420): Promise<{
    readonly index: ComputeAttemptIndex420;
    readonly assignment: ComputeAssignment420;
    readonly lifecycle: ComputeAttemptLifecycle420;
  }>;
}

export function createComputeWorkerClient420(reader: ComputeWorkerReader420): ComputeWorkerClient420 {
  return Object.freeze({
    worker: async (workerId: Hex420, revision: bigint) => {
      const identity = validateWorkerRevision420(workerId, revision, await reader.workerRevision(workerId, revision));
      const capability = validateCapabilityProfile420(identity, await reader.capabilityProfile(workerId, revision));
      return { identity, capability };
    },
    admission: (query: Readonly<Record<string, unknown>>) => reader.eligibility(query),
    attestation: async (attestationId: Hex420) => {
      assertBytes32420(attestationId, 'attestationId');
      return {
        core: await reader.attestationCore(attestationId),
        provenance: await reader.attestationProvenance(attestationId)
      };
    },
    trust: async (referenceId: Hex420) => {
      assertBytes32420(referenceId, 'trustReferenceId');
      return reader.trustReference(referenceId);
    },
    stake: async (referenceId: Hex420) => {
      assertBytes32420(referenceId, 'stakeReferenceId');
      return reader.stakeReference(referenceId);
    },
    capacity: (workerId: Hex420, workerRevision: bigint, resourceId: Hex420, resourceRevision: bigint) =>
      reader.capacityUsage(workerId, workerRevision, resourceId, resourceRevision),
    acceptedAttempt: async (jobId: Hex420) => {
      const index = await reader.attemptIndex(jobId);
      const assignment = await reader.assignment(index.latestAssignmentRef);
      const lifecycle = await reader.attemptLifecycle(index.latestAssignmentRef);
      validateAttemptBundle420(jobId, index, assignment, lifecycle);
      return { index, assignment, lifecycle };
    }
  });
}
