export type IndexerRuntimePhase420 = 'starting' | 'serving' | 'draining' | 'failed';

export type IndexerRuntimeReadinessReason420 =
  | 'starting'
  | 'draining'
  | 'failed'
  | 'no_ingest_success'
  | 'stale_ingest';

export interface IndexerRuntimeSnapshot420 {
  phase: IndexerRuntimePhase420;
  startedAtMs: number;
  lastSuccessfulIngestAtMs: number | null;
  lastObservedSourceHead: string | null;
  failureCode: string | null;
}

export interface IndexerRuntimeReadiness420 {
  ready: boolean;
  stale: boolean;
  reason: IndexerRuntimeReadinessReason420 | null;
}

function assertTimestamp420(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`);
}

function sourceHead420(value: bigint | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value < 0n) throw new Error('source head must be non-negative');
  return value.toString();
}

export class IndexerRuntimeState420 {
  private phaseValue: IndexerRuntimePhase420 = 'starting';
  private readonly startedAtValue: number;
  private lastSuccessfulIngestAtValue: number | null = null;
  private lastObservedSourceHeadValue: string | null = null;
  private failureCodeValue: string | null = null;

  constructor(startedAtMs = Date.now()) {
    assertTimestamp420(startedAtMs, 'startedAtMs');
    this.startedAtValue = startedAtMs;
  }

  markServing(): void {
    if (this.phaseValue === 'draining' || this.phaseValue === 'failed') {
      throw new Error(`cannot mark ${this.phaseValue} runtime as serving`);
    }
    this.phaseValue = 'serving';
  }

  markIngestSuccess(atMs = Date.now(), observedSourceHead?: bigint | null): void {
    assertTimestamp420(atMs, 'ingest timestamp');
    if (atMs < this.startedAtValue) throw new Error('ingest timestamp precedes runtime start');
    if (this.lastSuccessfulIngestAtValue !== null && atMs < this.lastSuccessfulIngestAtValue) {
      throw new Error('ingest timestamp moved backwards');
    }
    this.lastSuccessfulIngestAtValue = atMs;
    this.lastObservedSourceHeadValue = sourceHead420(observedSourceHead);
  }

  markDraining(): void {
    if (this.phaseValue === 'failed') throw new Error('failed runtime cannot enter draining state');
    this.phaseValue = 'draining';
  }

  markFailed(code: string): void {
    const normalized = code.trim();
    if (!normalized) throw new Error('failure code is required');
    if (normalized.length > 128) throw new Error('failure code exceeds maximum length');
    this.phaseValue = 'failed';
    this.failureCodeValue = normalized;
  }

  snapshot(): IndexerRuntimeSnapshot420 {
    return {
      phase: this.phaseValue,
      startedAtMs: this.startedAtValue,
      lastSuccessfulIngestAtMs: this.lastSuccessfulIngestAtValue,
      lastObservedSourceHead: this.lastObservedSourceHeadValue,
      failureCode: this.failureCodeValue
    };
  }
}

// Readiness evaluates only local service health. Aggregate telemetry is likewise local,
// rebuildable and non-authoritative; neither surface may substitute for canonical chain state.
export function evaluateIndexerRuntimeReadiness420(
  snapshot: IndexerRuntimeSnapshot420,
  nowMs: number,
  maxIngestStaleMs: number
): IndexerRuntimeReadiness420 {
  assertTimestamp420(nowMs, 'nowMs');
  if (!Number.isSafeInteger(maxIngestStaleMs) || maxIngestStaleMs < 1) {
    throw new Error('maxIngestStaleMs must be a positive safe integer');
  }
  if (nowMs < snapshot.startedAtMs) throw new Error('nowMs precedes runtime start');

  if (snapshot.phase === 'starting') return { ready: false, stale: false, reason: 'starting' };
  if (snapshot.phase === 'draining') return { ready: false, stale: false, reason: 'draining' };
  if (snapshot.phase === 'failed') return { ready: false, stale: false, reason: 'failed' };
  if (snapshot.lastSuccessfulIngestAtMs === null) {
    return { ready: false, stale: false, reason: 'no_ingest_success' };
  }
  if (snapshot.lastSuccessfulIngestAtMs > nowMs) throw new Error('last successful ingest is in the future');

  const stale = nowMs - snapshot.lastSuccessfulIngestAtMs > maxIngestStaleMs;
  return stale
    ? { ready: false, stale: true, reason: 'stale_ingest' }
    : { ready: true, stale: false, reason: null };
}
