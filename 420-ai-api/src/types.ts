export type Hex32 = `0x${string}`;
export type Address420 = `0x${string}`;
export type ProjectionSource420 = 'indexer' | 'rpc' | 'hybrid';

export interface ProjectionMeta420 {
  authoritative: false;
  source: ProjectionSource420;
  chainId: string;
  observedBlock: string;
  observedAtMs: number;
  stale: boolean;
}

export interface AIProviderDto420 {
  providerId: Hex32;
  operatorAccount: Address420;
  settlementAccount: Address420;
  computeProviderId: Hex32;
  metadataHash: Hex32;
  state: 'REGISTERED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
  stakeRef: Hex32;
  revision: number;
  meta: ProjectionMeta420;
}

export interface AIModelDto420 {
  modelId: Hex32;
  creator: Address420;
  metadataHash: Hex32;
  active: boolean;
  latestVersionId: Hex32 | null;
  meta: ProjectionMeta420;
}

export interface AIModelVersionDto420 {
  modelVersionId: Hex32;
  modelId: Hex32;
  artifactHash: Hex32;
  manifestHash: Hex32;
  runtimeProfile: Hex32;
  verificationProfileId: Hex32;
  active: boolean;
  meta: ProjectionMeta420;
}

export interface AIJobDto420 {
  jobId: Hex32;
  requester: Address420;
  modelVersionId: Hex32;
  workloadClass: Hex32;
  privacyPolicyId: Hex32;
  verificationProfileId: Hex32;
  maxSpend420: string;
  fundedAmount420: string;
  deadline: number;
  providerId: Hex32 | null;
  computeRequestId: Hex32 | null;
  computeJobId: Hex32 | null;
  resultHash: Hex32 | null;
  resultManifestHash: Hex32 | null;
  state: string;
  meta: ProjectionMeta420;
}

export interface AIJobEventDto420 {
  jobId: Hex32;
  state: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
  observedAtMs: number;
  meta: ProjectionMeta420;
}

export interface Page420<T> {
  items: T[];
  nextCursor: string | null;
  meta: {
    authoritative: false;
    source: ProjectionSource420;
  };
}

export interface AIReadSource420 {
  providers(input: { state?: string; cursor?: string; limit: number }): Promise<{ items: AIProviderDto420[]; nextCursor: string | null }>;
  models(input: { creator?: Address420; active?: boolean; cursor?: string; limit: number }): Promise<{ items: AIModelDto420[]; nextCursor: string | null }>;
  modelVersions(input: { modelId: Hex32; cursor?: string; limit: number }): Promise<{ items: AIModelVersionDto420[]; nextCursor: string | null }>;
  jobs(input: { requester?: Address420; providerId?: Hex32; state?: string; cursor?: string; limit: number }): Promise<{ items: AIJobDto420[]; nextCursor: string | null }>;
  job(jobId: Hex32): Promise<AIJobDto420 | null>;
  jobEvents(jobId: Hex32, input: { cursor?: string; limit: number }): Promise<{ items: AIJobEventDto420[]; nextCursor: string | null }>;
  status(): Promise<{ chainId: string; observedBlock: string; observedAtMs: number; stale: boolean; ready: boolean }>;
  readonly source: ProjectionSource420;
}
