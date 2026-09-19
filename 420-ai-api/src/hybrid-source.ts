import type {
  Address420, AIJobDto420, AIJobEventDto420, AIModelDto420, AIModelVersionDto420,
  AIProviderDto420, AIReadSource420, Hex32, ProjectionMeta420
} from './types.js';

export interface AIIndexCatalog420 {
  providerIds(input: { state?: string; cursor?: string; limit: number }): Promise<{ ids: Hex32[]; nextCursor: string | null }>;
  modelIds(input: { creator?: Address420; active?: boolean; cursor?: string; limit: number }): Promise<{ ids: Hex32[]; nextCursor: string | null }>;
  modelVersionIds(input: { modelId: Hex32; cursor?: string; limit: number }): Promise<{ ids: Hex32[]; nextCursor: string | null }>;
  jobIds(input: { requester?: Address420; providerId?: Hex32; state?: string; cursor?: string; limit: number }): Promise<{ ids: Hex32[]; nextCursor: string | null }>;
  jobEvents(jobId: Hex32, input: { cursor?: string; limit: number }): Promise<{ items: AIJobEventDto420[]; nextCursor: string | null }>;
  status(): Promise<{ chainId: string; observedBlock: string; observedAtMs: number; stale: boolean; ready: boolean }>;
}

export interface AICanonicalReader420 {
  provider(providerId: Hex32): Promise<Omit<AIProviderDto420, 'meta'> | null>;
  model(modelId: Hex32): Promise<Omit<AIModelDto420, 'meta'> | null>;
  modelVersion(modelVersionId: Hex32): Promise<Omit<AIModelVersionDto420, 'meta'> | null>;
  job(jobId: Hex32): Promise<Omit<AIJobDto420, 'meta'> | null>;
  status(): Promise<{ chainId: string; observedBlock: string; observedAtMs: number; stale: boolean; ready: boolean }>;
}

export class HybridAIReadSource420 implements AIReadSource420 {
  readonly source = 'hybrid' as const;

  constructor(readonly index: AIIndexCatalog420, readonly canonical: AICanonicalReader420) {}

  private async meta(): Promise<ProjectionMeta420> {
    const [indexStatus, rpcStatus] = await Promise.all([this.index.status(), this.canonical.status()]);
    if (indexStatus.chainId !== rpcStatus.chainId) throw new Error('AI index/RPC chain mismatch');
    return {
      authoritative: false,
      source: 'hybrid',
      chainId: rpcStatus.chainId,
      observedBlock: rpcStatus.observedBlock,
      observedAtMs: Math.min(indexStatus.observedAtMs, rpcStatus.observedAtMs),
      stale: indexStatus.stale || rpcStatus.stale
    };
  }

  private async hydrate<T>(
    ids: Hex32[],
    read: (id: Hex32) => Promise<T | null>
  ): Promise<Array<T & { meta: ProjectionMeta420 }>> {
    const meta = await this.meta();
    const rows = await Promise.all(ids.map(read));
    return rows.flatMap((row) => row === null ? [] : [{ ...row, meta }]);
  }

  async providers(input: Parameters<AIReadSource420['providers']>[0]) {
    const page = await this.index.providerIds(input);
    return { items: await this.hydrate(page.ids, (id) => this.canonical.provider(id)), nextCursor: page.nextCursor };
  }

  async models(input: Parameters<AIReadSource420['models']>[0]) {
    const page = await this.index.modelIds(input);
    return { items: await this.hydrate(page.ids, (id) => this.canonical.model(id)), nextCursor: page.nextCursor };
  }

  async modelVersions(input: Parameters<AIReadSource420['modelVersions']>[0]) {
    const page = await this.index.modelVersionIds(input);
    return { items: await this.hydrate(page.ids, (id) => this.canonical.modelVersion(id)), nextCursor: page.nextCursor };
  }

  async jobs(input: Parameters<AIReadSource420['jobs']>[0]) {
    const page = await this.index.jobIds(input);
    return { items: await this.hydrate(page.ids, (id) => this.canonical.job(id)), nextCursor: page.nextCursor };
  }

  async job(jobId: Hex32) {
    const row = await this.canonical.job(jobId);
    if (!row) return null;
    return { ...row, meta: await this.meta() };
  }

  async jobEvents(jobId: Hex32, input: Parameters<AIReadSource420['jobEvents']>[1]) {
    const page = await this.index.jobEvents(jobId, input);
    return {
      items: page.items.map((item) => ({ ...item, meta: { ...item.meta, source: 'indexer' as const, authoritative: false as const } })),
      nextCursor: page.nextCursor
    };
  }

  async status() {
    const [indexStatus, rpcStatus] = await Promise.all([this.index.status(), this.canonical.status()]);
    if (indexStatus.chainId !== rpcStatus.chainId) throw new Error('AI index/RPC chain mismatch');
    return {
      chainId: rpcStatus.chainId,
      observedBlock: rpcStatus.observedBlock,
      observedAtMs: Math.min(indexStatus.observedAtMs, rpcStatus.observedAtMs),
      stale: indexStatus.stale || rpcStatus.stale,
      ready: indexStatus.ready && rpcStatus.ready
    };
  }
}
