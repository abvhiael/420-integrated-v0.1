export type Hex32 = `0x${string}`;
export type Address420 = `0x${string}`;

export type AIJobState420 =
  | 'CREATED' | 'FUNDED' | 'MATCHED' | 'ACCEPTED' | 'RUNNING'
  | 'RESULT_COMMITTED' | 'VERIFIED' | 'SETTLED'
  | 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'DISPUTED' | 'REFUNDED';

export type ComputeJobState420 =
  | 'MATCHED' | 'ACCEPTED' | 'RUNNING' | 'RESULT_COMMITTED'
  | 'VERIFIED' | 'SETTLED' | 'FAILED' | 'DISPUTED' | 'REFUNDED';

export interface AIProviderSnapshot420 {
  providerId: Hex32;
  operatorAccount: Address420;
  settlementAccount: Address420;
  stakeRef: Hex32;
  computeProviderRef: Hex32;
  state: 'REGISTERED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
}

export interface CanonicalAIJob420 {
  jobId: Hex32;
  requester: Address420;
  modelVersionId: Hex32;
  workloadClass: Hex32;
  requestHash: Hex32;
  privacyPolicyId: Hex32;
  verificationProfileId: Hex32;
  maxSpend420: bigint;
  deadline: number;
  computeRequestId: Hex32;
  computeJobId: Hex32;
  providerId: Hex32;
  state: AIJobState420;
}

export interface CanonicalComputeJob420 {
  jobId: Hex32;
  requestId: Hex32;
  providerId: Hex32;
  resourceId: Hex32;
  state: ComputeJobState420;
  outputCommitment?: Hex32;
  resultManifestHash?: Hex32;
}

export interface CanonicalComputeRequest420 {
  requestId: Hex32;
  requester: Address420;
  workloadClass: Hex32;
  inputCommitment: Hex32;
  maxSpend420: bigint;
  fundedAmount420: bigint;
  deadline: number;
  privacyPolicyId: Hex32;
  verificationProfileId: Hex32;
}

export interface CanonicalWork420 {
  provider: AIProviderSnapshot420;
  aiJob: CanonicalAIJob420;
  computeJob: CanonicalComputeJob420;
  computeRequest: CanonicalComputeRequest420;
}

export interface ProviderWorkItem420 {
  aiJobId: Hex32;
  computeJobId: Hex32;
  payloadRef: string;
}

export interface InferenceRequest420 {
  jobId: Hex32;
  modelVersionId: Hex32;
  workloadClass: Hex32;
  input: Uint8Array;
  privacyPolicyId: Hex32;
  verificationProfileId: Hex32;
}

export interface InferenceResult420 {
  output: Uint8Array;
  units: bigint;
  evidence?: Uint8Array;
  runtimeMetadata?: Record<string, string | number | boolean>;
}

export interface PayloadPort420 {
  get(ref: string): Promise<Uint8Array>;
  put(bytes: Uint8Array, contentType: string): Promise<string>;
}

export interface InferenceBackend420 {
  health(): Promise<boolean>;
  execute(request: InferenceRequest420): Promise<InferenceResult420>;
}

export interface CanonicalStatePort420 {
  getCanonicalWork(aiJobId: Hex32, computeJobId: Hex32): Promise<CanonicalWork420>;
}

export interface ProviderTransactionPort420 {
  acceptComputeJob(jobId: Hex32): Promise<string>;
  markComputeRunning(jobId: Hex32): Promise<string>;
  commitComputeResult(jobId: Hex32, outputCommitment: Hex32, resultManifestHash: Hex32): Promise<string>;
  submitFinalReceipt(input: {
    jobId: Hex32;
    cumulativeUnits: bigint;
    cumulativeCharge420: bigint;
    executionManifestHash: Hex32;
    evidenceRef: Hex32;
  }): Promise<string>;
}

export interface RuntimeClock420 {
  nowMs(): number;
}
