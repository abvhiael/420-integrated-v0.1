import type { AIReadSource420, Page420 } from './types.js';
import { address420, cursor420, enum420, hex32420, limit420 } from './validation.js';

const PROVIDER_STATES = ['REGISTERED', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
const JOB_STATES = [
  'CREATED','FUNDED','MATCHED','ACCEPTED','RUNNING','RESULT_COMMITTED','VERIFIED','SETTLED',
  'CANCELLED','EXPIRED','FAILED','DISPUTED','REFUNDED'
] as const;

export class AIReadApi420 {
  constructor(readonly source: AIReadSource420) {}

  async health() {
    return { status: 'ok' as const, service: '420-ai-api' as const, apiVersion: 'v1' as const, authoritative: false as const };
  }

  async readiness() {
    const status = await this.source.status();
    return {
      ready: status.ready && !status.stale,
      chainId: status.chainId,
      observedBlock: status.observedBlock,
      observedAtMs: status.observedAtMs,
      stale: status.stale,
      source: this.source.source,
      authoritative: false as const
    };
  }

  async providers(input: { state?: string; cursor?: string; limit?: number } = {}) {
    const state = enum420(input.state, PROVIDER_STATES, 'provider state');
    const result = await this.source.providers({ state, cursor: cursor420(input.cursor), limit: limit420(input.limit) });
    return this.page(result);
  }

  async models(input: { creator?: string; active?: boolean; cursor?: string; limit?: number } = {}) {
    const result = await this.source.models({
      creator: address420(input.creator),
      active: input.active,
      cursor: cursor420(input.cursor),
      limit: limit420(input.limit)
    });
    return this.page(result);
  }

  async modelVersions(modelId: string, input: { cursor?: string; limit?: number } = {}) {
    const result = await this.source.modelVersions({
      modelId: hex32420(modelId, 'modelId'),
      cursor: cursor420(input.cursor),
      limit: limit420(input.limit)
    });
    return this.page(result);
  }

  async jobs(input: { requester?: string; providerId?: string; state?: string; cursor?: string; limit?: number } = {}) {
    const state = enum420(input.state, JOB_STATES, 'job state');
    const result = await this.source.jobs({
      requester: address420(input.requester),
      providerId: input.providerId === undefined ? undefined : hex32420(input.providerId, 'providerId'),
      state,
      cursor: cursor420(input.cursor),
      limit: limit420(input.limit)
    });
    return this.page(result);
  }

  async job(jobId: string) {
    return this.source.job(hex32420(jobId, 'jobId'));
  }

  async jobEvents(jobId: string, input: { cursor?: string; limit?: number } = {}) {
    const result = await this.source.jobEvents(hex32420(jobId, 'jobId'), {
      cursor: cursor420(input.cursor),
      limit: limit420(input.limit)
    });
    return this.page(result);
  }

  private page<T>(result: { items: T[]; nextCursor: string | null }): Page420<T> {
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      meta: { authoritative: false, source: this.source.source }
    };
  }
}
