export const MAX_OFFLINE_ELAPSED_MS = 24 * 60 * 60 * 1000;

export interface OfflineIncomeSource {
  id: string;
  intervalMs: number;
  cashPerInterval: number;
  remainingCashCap: number;
  enabled: boolean;
}

export interface OfflineProgressionInput {
  lastProcessedAtMs: number;
  nowMs: number;
  incomeSources?: readonly OfflineIncomeSource[];
}

export interface OfflineIncomeGrant {
  sourceId: string;
  intervals: number;
  cash: number;
}

export interface OfflineProgressionResult {
  rawElapsedMs: number;
  effectiveElapsedMs: number;
  discardedElapsedMs: number;
  nextLastProcessedAtMs: number;
  clockRollbackDetected: boolean;
  totalCash: number;
  grants: OfflineIncomeGrant[];
}

const assertTimestamp = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer timestamp`);
  }
};

const validateSource = (source: OfflineIncomeSource): void => {
  if (!source.id.trim()) throw new Error("offline income source id required");
  if (!Number.isSafeInteger(source.intervalMs) || source.intervalMs <= 0) {
    throw new Error("offline income interval must be a positive safe integer");
  }
  if (!Number.isSafeInteger(source.cashPerInterval) || source.cashPerInterval < 0) {
    throw new Error("offline income cash per interval must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(source.remainingCashCap) || source.remainingCashCap < 0) {
    throw new Error("offline income cap must be a non-negative safe integer");
  }
};

export const calculateOfflineProgression = (
  input: OfflineProgressionInput,
): OfflineProgressionResult => {
  assertTimestamp(input.lastProcessedAtMs, "last processed time");
  assertTimestamp(input.nowMs, "current time");

  if (input.nowMs < input.lastProcessedAtMs) {
    return {
      rawElapsedMs: 0,
      effectiveElapsedMs: 0,
      discardedElapsedMs: 0,
      nextLastProcessedAtMs: input.lastProcessedAtMs,
      clockRollbackDetected: true,
      totalCash: 0,
      grants: [],
    };
  }

  const rawElapsedMs = input.nowMs - input.lastProcessedAtMs;
  if (!Number.isSafeInteger(rawElapsedMs)) {
    throw new Error("offline elapsed time exceeds safe integer range");
  }

  const effectiveElapsedMs = Math.min(rawElapsedMs, MAX_OFFLINE_ELAPSED_MS);
  const discardedElapsedMs = rawElapsedMs - effectiveElapsedMs;
  const sources = input.incomeSources ?? [];
  const seenIds = new Set<string>();
  const grants: OfflineIncomeGrant[] = [];
  let totalCash = 0;

  for (const source of sources) {
    validateSource(source);
    if (seenIds.has(source.id)) throw new Error("duplicate offline income source id");
    seenIds.add(source.id);

    if (!source.enabled || source.cashPerInterval === 0 || source.remainingCashCap === 0) {
      grants.push({ sourceId: source.id, intervals: 0, cash: 0 });
      continue;
    }

    const intervals = Math.floor(effectiveElapsedMs / source.intervalMs);
    const uncappedCash = intervals * source.cashPerInterval;
    if (!Number.isSafeInteger(uncappedCash)) {
      throw new Error("offline income exceeds safe integer range");
    }

    const cash = Math.min(uncappedCash, source.remainingCashCap);
    if (!Number.isSafeInteger(totalCash + cash)) {
      throw new Error("offline total cash exceeds safe integer range");
    }

    totalCash += cash;
    grants.push({ sourceId: source.id, intervals, cash });
  }

  return {
    rawElapsedMs,
    effectiveElapsedMs,
    discardedElapsedMs,
    // Consume the entire observed gap, including time beyond the cap. This makes
    // repeated processing at the same wall-clock time replay-safe and prevents
    // callers from collecting a long absence in repeated capped chunks.
    nextLastProcessedAtMs: input.nowMs,
    clockRollbackDetected: false,
    totalCash,
    grants,
  };
};
