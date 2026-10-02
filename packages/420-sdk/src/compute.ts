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

export interface ComputeReadComponents420 {
  readonly workers: Hex420;
  readonly profiles: Hex420;
  readonly capabilityEligibility: Hex420;
  readonly attestation: Hex420;
  readonly trust: Hex420;
  readonly stake: Hex420;
  readonly capacity: Hex420;
  readonly snapshots: Hex420;
}

export interface ComputeReadDomains420 {
  readonly workerIdentity: Hex420;
  readonly capabilityProfile: Hex420;
  readonly attestation: Hex420;
  readonly provenance: Hex420;
  readonly trustReference: Hex420;
  readonly stakeReference: Hex420;
  readonly capacityReservation: Hex420;
  readonly executionAccept: Hex420;
  readonly executionResult: Hex420;
  readonly attemptTransition: Hex420;
  readonly acceptedConstraint: Hex420;
}

export interface ComputeCapabilityRequirements420 {
  readonly requiredResourceComputeClass: Hex420;
  readonly requiredArchitecture: Hex420;
  readonly requiredCpuClass: Hex420;
  readonly requiredGpuClass: Hex420;
  readonly requiredSoftwareCapability: Hex420;
  readonly minVramMiB: bigint;
  readonly minMemoryMiB: bigint;
  readonly minStorageGiB: bigint;
  readonly minNetworkMbps: bigint;
  readonly requiredStorageClassHash: Hex420;
  readonly requiredNetworkCapabilityHash: Hex420;
  readonly requiredRuntimeCapabilityHash: Hex420;
}

export interface ComputeEligibilityQuery420 {
  readonly workerId: Hex420;
  readonly workerRevision: bigint;
  readonly requirements: ComputeCapabilityRequirements420;
  readonly requireTrustedAttestation: boolean;
  readonly attestationPolicyId: Hex420;
  readonly attestationId: Hex420;
  readonly trustPolicyId: Hex420;
  readonly requireTrustReference: boolean;
  readonly trustReferenceId: Hex420;
  readonly stakePolicyId: Hex420;
  readonly requireStakeReference: boolean;
  readonly stakeReferenceId: Hex420;
}

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
  schemaVersion(): Promise<number>;
  components(): Promise<ComputeReadComponents420>;
  domains(): Promise<ComputeReadDomains420>;
  workerRevision(workerId: Hex420, revision: bigint): Promise<ComputeWorkerIdentity420>;
  capabilityProfile(workerId: Hex420, revision: bigint): Promise<ComputeCapabilityProfile420>;
  eligibility(query: ComputeEligibilityQuery420): Promise<ComputeEligibility420>;
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
  descriptor(): Promise<{
    readonly schemaVersion: 1;
    readonly components: ComputeReadComponents420;
    readonly domains: ComputeReadDomains420;
  }>;
  worker(workerId: Hex420, revision: bigint): Promise<{
    readonly identity: ComputeWorkerIdentity420;
    readonly capability: ComputeCapabilityProfile420;
  }>;
  admission(query: ComputeEligibilityQuery420): Promise<ComputeEligibility420>;
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
    descriptor: async () => {
      const schemaVersion = await reader.schemaVersion();
      if (schemaVersion !== COMPUTE_WORKER_READ_MODEL_VERSION_420) {
        throw new ComputeReadModelError420('unsupported compute worker read-model schema version');
      }
      const components = await reader.components();
      for (const [key, value] of Object.entries(components)) assertAddress420(value, key);
      const domains = await reader.domains();
      for (const [key, value] of Object.entries(domains)) assertBytes32420(value, key);
      return { schemaVersion: COMPUTE_WORKER_READ_MODEL_VERSION_420, components, domains };
    },
    worker: async (workerId: Hex420, revision: bigint) => {
      const identity = validateWorkerRevision420(workerId, revision, await reader.workerRevision(workerId, revision));
      const capability = validateCapabilityProfile420(identity, await reader.capabilityProfile(workerId, revision));
      return { identity, capability };
    },
    admission: (query: ComputeEligibilityQuery420) => reader.eligibility(query),
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


export const COMPUTE_WORKER_OFFER_SCHEMA_420 = '420-compute-worker-offer-v2' as const;
export const COMPUTE_WORKER_OFFER_VERSION_420 = 2 as const;

export interface ComputeWorkerOffer420 {
  readonly providerId: Hex420;
  readonly nodeId: Hex420;
  readonly resourceId: Hex420;
  readonly providerRevision: bigint;
  readonly resourceRevision: bigint;
  readonly operator: Hex420;
  readonly settlementAccount: Hex420;
  readonly computeClass: Hex420;
  readonly hardwareProfileHash: Hex420;
  readonly runtimeProfileHash: Hex420;
  readonly capabilityHash: Hex420;
  readonly capacityUnits: bigint;
  readonly jurisdictionHash: Hex420;
  readonly availableFrom: bigint;
  readonly validUntil: bigint;
  readonly pricingPolicyId: Hex420;
  readonly pricingVersion: number;
  readonly fixedPrice: bigint;
  readonly revision: bigint;
  readonly predecessorCommitment: Hex420;
  readonly exists: boolean;
  readonly active: boolean;
}

export function validateComputeWorkerOffer420(
  offer: ComputeWorkerOffer420,
  expectedRevision?: bigint
): ComputeWorkerOffer420 {
  for (const [label, value] of [
    ['providerId', offer.providerId],
    ['nodeId', offer.nodeId],
    ['resourceId', offer.resourceId],
    ['computeClass', offer.computeClass],
    ['hardwareProfileHash', offer.hardwareProfileHash],
    ['runtimeProfileHash', offer.runtimeProfileHash],
    ['capabilityHash', offer.capabilityHash],
    ['jurisdictionHash', offer.jurisdictionHash],
    ['pricingPolicyId', offer.pricingPolicyId],
    ['predecessorCommitment', offer.predecessorCommitment]
  ] as const) {
    assertBytes32420(value, label);
  }
  assertAddress420(offer.operator, 'operator');
  assertAddress420(offer.settlementAccount, 'settlementAccount');

  if (!offer.exists || !offer.active) throw new ComputeReadModelError420('worker offer is not active');
  if (offer.providerRevision <= 0n || offer.resourceRevision <= 0n || offer.revision <= 0n) {
    throw new ComputeReadModelError420('worker offer revision must be positive');
  }
  if (expectedRevision !== undefined && offer.revision !== expectedRevision) {
    throw new ComputeReadModelError420('stale or mismatched worker offer revision');
  }
  if (offer.capacityUnits <= 0n) throw new ComputeReadModelError420('worker offer capacity must be positive');
  if (offer.fixedPrice <= 0n || offer.pricingVersion <= 0) {
    throw new ComputeReadModelError420('worker offer price must be positive and versioned');
  }
  if (offer.availableFrom > offer.validUntil) {
    throw new ComputeReadModelError420('worker offer availability window is invalid');
  }
  const zero = /^0x0{64}$/i;
  if (
    zero.test(offer.computeClass) || zero.test(offer.hardwareProfileHash)
      || zero.test(offer.runtimeProfileHash) || zero.test(offer.capabilityHash)
      || zero.test(offer.jurisdictionHash) || zero.test(offer.pricingPolicyId)
  ) {
    throw new ComputeReadModelError420('worker offer contains an empty canonical commitment');
  }
  return offer;
}

export const COMPUTE_REQUEST_SCHEMA_420 = '420-compute-market-request-v1' as const;
export const COMPUTE_REQUEST_VERSION_420 = 1 as const;
export interface ComputeRequestPolicy420 {
  readonly id: Hex420;
  readonly version: number;
  readonly commitment: Hex420;
}
export interface ComputeRequestTerms420 {
  readonly resourceClass: Hex420;
  readonly runtimeHash: Hex420;
  readonly capabilityHash: Hex420;
  readonly verification: ComputeRequestPolicy420;
  readonly privacy: ComputeRequestPolicy420;
  readonly jurisdictionHash: Hex420;
  readonly dataAccessHash: Hex420;
  readonly partitionPlanHash: Hex420;
  readonly partitionCount: number;
  readonly replicationFactor: number;
  readonly capacityUnits: bigint;
  readonly pricing: ComputeRequestPolicy420;
  readonly sla: ComputeRequestPolicy420;
  readonly deadline: bigint;
  readonly expiresAt: bigint;
  readonly maximumPrice: bigint;
  readonly fundingReference: Hex420;
}
export interface ComputeRequest420 {
  readonly owner: Hex420;
  readonly payer: Hex420;
  readonly signedRequestId: Hex420;
  readonly manifestHash: Hex420;
  readonly workloadType: Hex420;
  readonly inputCommitment: Hex420;
  readonly outputSchemaCommitment: Hex420;
  readonly terms: ComputeRequestTerms420;
  readonly createdAt: bigint;
  readonly revision: bigint;
  readonly predecessorCommitment: Hex420;
  readonly status: number;
}
const REQUEST_UINT256_MAX_420 = (1n << 256n) - 1n;
function requestUint420(value: bigint, bits: number, label: string, positive = false): void {
  if (typeof value !== 'bigint' || value < (positive ? 1n : 0n) || value >= (1n << BigInt(bits))) {
    throw new ComputeReadModelError420(`request ${label} is outside uint${bits}`);
  }
}
function requestNumber420(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0 || value > 0xffffffff) {
    throw new ComputeReadModelError420(`request ${label} is outside positive uint32`);
  }
}
function requestCommitment420(value: Hex420, label: string): void {
  assertBytes32420(value, label);
  if (/^0x0{64}$/i.test(value)) throw new ComputeReadModelError420(`request ${label} is empty`);
}
export function validateComputeRequest420(
  request: ComputeRequest420,
  expectedRevision?: bigint,
  now?: bigint,
  signedMaximumPrice?: bigint
): ComputeRequest420 {
  assertAddress420(request.owner, 'owner'); assertAddress420(request.payer, 'payer');
  if (/^0x0{40}$/i.test(request.owner) || /^0x0{40}$/i.test(request.payer)) {
    throw new ComputeReadModelError420('request owner/payer is empty');
  }
  for (const label of ['signedRequestId', 'manifestHash', 'workloadType', 'inputCommitment', 'outputSchemaCommitment'] as const) {
    requestCommitment420(request[label], label);
  }
  assertBytes32420(request.predecessorCommitment, 'predecessorCommitment');
  requestUint420(request.revision, 64, 'revision', true);
  requestUint420(request.createdAt, 64, 'createdAt');
  if (expectedRevision !== undefined && request.revision !== expectedRevision) {
    throw new ComputeReadModelError420('stale or mismatched request revision');
  }
  if (request.status !== 1) throw new ComputeReadModelError420('request is not open');
  const t = request.terms;
  for (const label of ['resourceClass', 'runtimeHash', 'capabilityHash', 'jurisdictionHash', 'dataAccessHash', 'partitionPlanHash'] as const) {
    requestCommitment420(t[label], label);
  }
  assertBytes32420(t.fundingReference, 'fundingReference');
  for (const label of ['verification', 'privacy', 'pricing', 'sla'] as const) {
    requestCommitment420(t[label].id, `${label}.id`);
    requestNumber420(t[label].version, `${label}.version`);
    requestCommitment420(t[label].commitment, `${label}.commitment`);
  }
  requestNumber420(t.partitionCount, 'partitionCount'); requestNumber420(t.replicationFactor, 'replicationFactor');
  requestUint420(t.capacityUnits, 256, 'capacityUnits', true);
  requestUint420(t.maximumPrice, 256, 'maximumPrice', true);
  requestUint420(t.deadline, 64, 'deadline', true); requestUint420(t.expiresAt, 64, 'expiresAt', true);
  if (BigInt(t.partitionCount) * BigInt(t.replicationFactor) * t.capacityUnits > REQUEST_UINT256_MAX_420) {
    throw new ComputeReadModelError420('request aggregate capacity overflows uint256');
  }
  if (t.expiresAt > t.deadline || t.expiresAt <= request.createdAt || (now !== undefined && now >= t.expiresAt)) {
    throw new ComputeReadModelError420('request availability window is invalid or expired');
  }
  if (signedMaximumPrice !== undefined && t.maximumPrice > signedMaximumPrice) {
    throw new ComputeReadModelError420('request exceeds payer signed maximum price');
  }
  return request;
}

// Static ABI encoding: each nested tuple field occupies one 32-byte word in declaration order.
function requestWord420(value: Hex420 | bigint | number): string {
  if (typeof value === 'string') {
    if (!/^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)) throw new ComputeReadModelError420('invalid ABI word');
    return value.slice(2).toLowerCase().padStart(64, '0');
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new ComputeReadModelError420('invalid ABI integer');
  const n = BigInt(value); requestUint420(n, 256, 'ABI word'); return n.toString(16).padStart(64, '0');
}
export function encodeComputeRequestId420(domain: Hex420, chainId: bigint, registry: Hex420, owner: Hex420, nonce: bigint): Hex420 {
  assertBytes32420(domain, 'domain'); assertAddress420(registry, 'registry'); assertAddress420(owner, 'owner');
  requestUint420(chainId, 256, 'chainId'); requestUint420(nonce, 64, 'nonce', true);
  return `0x${[domain,chainId,registry,owner,nonce].map(requestWord420).join('')}`;
}
export function encodeComputeRequestCommitment420(domain: Hex420, chainId: bigint, registry: Hex420, id: Hex420, r: ComputeRequest420): Hex420 {
  // Historical terminal revisions are encodable; live eligibility uses validateComputeRequest420 separately.
  assertBytes32420(domain, 'domain'); assertBytes32420(id, 'requestId'); assertAddress420(registry, 'registry');
  validateComputeRequest420({ ...r, status: 1 });
  if (!Number.isInteger(r.status) || r.status < 1 || r.status > 3) throw new ComputeReadModelError420('invalid historical request status');
  requestUint420(chainId, 256, 'chainId');
  const t = r.terms;
  const policy = (p: ComputeRequestPolicy420) => [p.id,p.version,p.commitment] as const;
  const words = [domain,chainId,registry,id,r.owner,r.payer,r.signedRequestId,r.manifestHash,r.workloadType,
    r.inputCommitment,r.outputSchemaCommitment,t.resourceClass,t.runtimeHash,t.capabilityHash,
    ...policy(t.verification),...policy(t.privacy),t.jurisdictionHash,t.dataAccessHash,t.partitionPlanHash,
    t.partitionCount,t.replicationFactor,t.capacityUnits,...policy(t.pricing),...policy(t.sla),
    t.deadline,t.expiresAt,t.maximumPrice,t.fundingReference,r.createdAt,r.revision,r.predecessorCommitment,r.status];
  return `0x${words.map(requestWord420).join('')}`;
}
