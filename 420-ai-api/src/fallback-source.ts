import type { AIReadSource420 } from './types.js';

export class FallbackAIReadSource420 implements AIReadSource420 {
  readonly source = 'hybrid' as const;

  constructor(
    readonly primary: AIReadSource420,
    readonly rpcFallback: AIReadSource420
  ) {
    if (primary.source !== 'indexer') throw new Error('primary AI read source must be indexer');
    if (rpcFallback.source !== 'rpc') throw new Error('fallback AI read source must be rpc');
  }

  private async use<T>(primaryCall: () => Promise<T>, fallbackCall: () => Promise<T>): Promise<T> {
    try {
      const status = await this.primary.status();
      if (status.ready && !status.stale) return await primaryCall();
    } catch {}
    return fallbackCall();
  }

  providers(input: Parameters<AIReadSource420['providers']>[0]) {
    return this.use(() => this.primary.providers(input), () => this.rpcFallback.providers(input));
  }
  models(input: Parameters<AIReadSource420['models']>[0]) {
    return this.use(() => this.primary.models(input), () => this.rpcFallback.models(input));
  }
  modelVersions(input: Parameters<AIReadSource420['modelVersions']>[0]) {
    return this.use(() => this.primary.modelVersions(input), () => this.rpcFallback.modelVersions(input));
  }
  jobs(input: Parameters<AIReadSource420['jobs']>[0]) {
    return this.use(() => this.primary.jobs(input), () => this.rpcFallback.jobs(input));
  }
  job(jobId: Parameters<AIReadSource420['job']>[0]) {
    return this.use(() => this.primary.job(jobId), () => this.rpcFallback.job(jobId));
  }
  jobEvents(jobId: Parameters<AIReadSource420['jobEvents']>[0], input: Parameters<AIReadSource420['jobEvents']>[1]) {
    return this.use(() => this.primary.jobEvents(jobId, input), () => this.rpcFallback.jobEvents(jobId, input));
  }
  async status() {
    try {
      const primary = await this.primary.status();
      if (primary.ready && !primary.stale) return primary;
    } catch {}
    return this.rpcFallback.status();
  }
}
