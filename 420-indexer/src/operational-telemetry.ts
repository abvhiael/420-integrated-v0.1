export interface IndexerTelemetrySnapshot420 {
  ingestRuns: number;
  ingestFailures: number;
  blocksProcessed: number;
  reorgRecoveries: number;
  reorgBlocksRecovered: number;
  deliveryEnqueued: number;
  deliveryAttempts: number;
  deliverySucceeded: number;
  deliveryFailed: number;
  deliveryDeadLettered: number;
  workRejected: number;
  shutdownTimeouts: number;
  indexedHead: string | null;
  sourceHead: string | null;
  lagBlocks: string | null;
  workInFlight: number;
  deliveryQueued: number;
  deliveryInFlight: number;
  deliveryRetryWait: number;
  deliveryDeadLetter: number;
  authoritative: false;
}

function nonNegativeSafeInteger420(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`);
  return value;
}

function nonNegativeBigintString420(value: bigint | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (value < 0n) throw new Error(`${field} must be non-negative`);
  return value.toString();
}

export class IndexerOperationalTelemetry420 {
  private ingestRunsValue = 0;
  private ingestFailuresValue = 0;
  private blocksProcessedValue = 0;
  private reorgRecoveriesValue = 0;
  private reorgBlocksRecoveredValue = 0;
  private deliveryEnqueuedValue = 0;
  private deliveryAttemptsValue = 0;
  private deliverySucceededValue = 0;
  private deliveryFailedValue = 0;
  private deliveryDeadLetteredValue = 0;
  private workRejectedValue = 0;
  private shutdownTimeoutsValue = 0;
  private indexedHeadValue: string | null = null;
  private sourceHeadValue: string | null = null;
  private lagBlocksValue: string | null = null;
  private workInFlightValue = 0;
  private deliveryQueuedValue = 0;
  private deliveryInFlightValue = 0;
  private deliveryRetryWaitValue = 0;
  private deliveryDeadLetterValue = 0;

  recordIngestRun(processed: number, recoveredReorgDepth = 0): void {
    const blocks = nonNegativeSafeInteger420(processed, 'processed blocks');
    const depth = nonNegativeSafeInteger420(recoveredReorgDepth, 'reorg depth');
    this.ingestRunsValue += 1;
    this.blocksProcessedValue += blocks;
    if (depth > 0) {
      this.reorgRecoveriesValue += 1;
      this.reorgBlocksRecoveredValue += depth;
    }
  }

  recordIngestFailure(): void { this.ingestFailuresValue += 1; }
  recordDeliveryEnqueued(): void { this.deliveryEnqueuedValue += 1; }
  recordDeliveryAttempt(): void { this.deliveryAttemptsValue += 1; }
  recordDeliverySuccess(): void { this.deliverySucceededValue += 1; }
  recordDeliveryFailure(deadLettered = false): void {
    this.deliveryFailedValue += 1;
    if (deadLettered) this.deliveryDeadLetteredValue += 1;
  }
  recordWorkRejected(): void { this.workRejectedValue += 1; }
  recordShutdownTimeout(): void { this.shutdownTimeoutsValue += 1; }

  setHeads(indexedHead?: bigint | null, sourceHead?: bigint | null): void {
    this.indexedHeadValue = nonNegativeBigintString420(indexedHead, 'indexed head');
    this.sourceHeadValue = nonNegativeBigintString420(sourceHead, 'source head');
    if (indexedHead === null || indexedHead === undefined || sourceHead === null || sourceHead === undefined) {
      this.lagBlocksValue = null;
      return;
    }
    this.lagBlocksValue = (sourceHead > indexedHead ? sourceHead - indexedHead : 0n).toString();
  }

  setWorkInFlight(count: number): void {
    this.workInFlightValue = nonNegativeSafeInteger420(count, 'work in flight');
  }

  setDeliveryPressure(queued: number, inFlight: number, retryWait: number, deadLetter: number): void {
    this.deliveryQueuedValue = nonNegativeSafeInteger420(queued, 'delivery queued');
    this.deliveryInFlightValue = nonNegativeSafeInteger420(inFlight, 'delivery in flight');
    this.deliveryRetryWaitValue = nonNegativeSafeInteger420(retryWait, 'delivery retry wait');
    this.deliveryDeadLetterValue = nonNegativeSafeInteger420(deadLetter, 'delivery dead letter');
  }

  snapshot(): IndexerTelemetrySnapshot420 {
    return {
      ingestRuns: this.ingestRunsValue,
      ingestFailures: this.ingestFailuresValue,
      blocksProcessed: this.blocksProcessedValue,
      reorgRecoveries: this.reorgRecoveriesValue,
      reorgBlocksRecovered: this.reorgBlocksRecoveredValue,
      deliveryEnqueued: this.deliveryEnqueuedValue,
      deliveryAttempts: this.deliveryAttemptsValue,
      deliverySucceeded: this.deliverySucceededValue,
      deliveryFailed: this.deliveryFailedValue,
      deliveryDeadLettered: this.deliveryDeadLetteredValue,
      workRejected: this.workRejectedValue,
      shutdownTimeouts: this.shutdownTimeoutsValue,
      indexedHead: this.indexedHeadValue,
      sourceHead: this.sourceHeadValue,
      lagBlocks: this.lagBlocksValue,
      workInFlight: this.workInFlightValue,
      deliveryQueued: this.deliveryQueuedValue,
      deliveryInFlight: this.deliveryInFlightValue,
      deliveryRetryWait: this.deliveryRetryWaitValue,
      deliveryDeadLetter: this.deliveryDeadLetterValue,
      authoritative: false
    };
  }
}
