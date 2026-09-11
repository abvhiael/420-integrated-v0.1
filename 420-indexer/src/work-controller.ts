import type { IndexerOperationalTelemetry420 } from './operational-telemetry.js';
import type { IndexerRuntimeState420 } from './runtime-state.js';

export interface IndexerDrainResult420 {
  drained: boolean;
  timedOut: boolean;
  inFlight: number;
}

export interface IndexerShutdownResult420 extends IndexerDrainResult420 {
  runtimeFailed: boolean;
}

export interface IndexerTimer420 {
  wait(ms: number): Promise<void>;
}

const DEFAULT_TIMER_420: IndexerTimer420 = {
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

function boundedPositiveInteger420(value: number, field: string, max = 86_400_000): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${field} must be a positive safe integer no greater than ${max}`);
  }
  return value;
}

export class IndexerWorkController420 {
  private acceptingValue = true;
  private inFlightValue = 0;
  private readonly idleWaiters = new Set<() => void>();

  constructor(readonly telemetry?: IndexerOperationalTelemetry420) {}

  get accepting(): boolean { return this.acceptingValue; }
  get inFlight(): number { return this.inFlightValue; }

  beginDrain(): void {
    this.acceptingValue = false;
    this.resolveIdle420();
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.acceptingValue) {
      this.telemetry?.recordWorkRejected();
      throw new Error('indexer is draining and cannot accept new work');
    }
    this.inFlightValue += 1;
    this.telemetry?.setWorkInFlight(this.inFlightValue);
    try {
      return await operation();
    } finally {
      this.inFlightValue -= 1;
      this.telemetry?.setWorkInFlight(this.inFlightValue);
      this.resolveIdle420();
    }
  }

  private resolveIdle420(): void {
    if (this.inFlightValue !== 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  private idlePromise420(): Promise<void> {
    if (this.inFlightValue === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  async drain(timeoutMs: number, timer: IndexerTimer420 = DEFAULT_TIMER_420): Promise<IndexerDrainResult420> {
    boundedPositiveInteger420(timeoutMs, 'shutdown timeout');
    this.beginDrain();
    if (this.inFlightValue === 0) return { drained: true, timedOut: false, inFlight: 0 };

    let timedOut = false;
    await Promise.race([
      this.idlePromise420(),
      timer.wait(timeoutMs).then(() => { timedOut = true; })
    ]);
    return timedOut
      ? { drained: false, timedOut: true, inFlight: this.inFlightValue }
      : { drained: true, timedOut: false, inFlight: 0 };
  }
}

export class IndexerShutdownCoordinator420 {
  constructor(
    readonly runtime: IndexerRuntimeState420,
    readonly work: IndexerWorkController420,
    readonly telemetry?: IndexerOperationalTelemetry420
  ) {}

  async shutdown(timeoutMs: number, timer: IndexerTimer420 = DEFAULT_TIMER_420): Promise<IndexerShutdownResult420> {
    this.runtime.markDraining();
    const result = await this.work.drain(timeoutMs, timer);
    if (result.timedOut) {
      this.telemetry?.recordShutdownTimeout();
      this.runtime.markFailed('shutdown_timeout');
      return { ...result, runtimeFailed: true };
    }
    return { ...result, runtimeFailed: false };
  }
}
