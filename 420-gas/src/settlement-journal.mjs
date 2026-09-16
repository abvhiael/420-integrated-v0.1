const MAX_UINT256_420 = (1n << 256n) - 1n;
const MAX_UINT256_DECIMAL_DIGITS_420 = 78;

export class GasSettlementJournalError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasSettlementJournalError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasSettlementJournalError420(code);
}

function positiveInt420(value, code, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) fail420(code);
  return value;
}

function nonNegativeBigInt420(value, code) {
  let parsed = -1n;
  if (typeof value === 'bigint') {
    parsed = value;
  } else if (
    typeof value === 'string'
    && value.length <= MAX_UINT256_DECIMAL_DIGITS_420
    && /^(0|[1-9][0-9]*)$/.test(value)
  ) {
    parsed = BigInt(value);
  }
  if (parsed < 0n || parsed > MAX_UINT256_420) fail420(code);
  return parsed;
}

function commitment420(value, code) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) fail420(code);
  return value.toLowerCase();
}

function observedAt420(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail420('GAS10_SETTLEMENT_TIME_INVALID');
  return new Date(ms).toISOString();
}

const OUTCOMES_420 = new Set(['success', 'reverted', 'unknown']);
const CONFIRMATIONS_420 = new Set(['observed', 'finalized']);

export class GasSettlementJournal420 {
  constructor({ maxEntries = 1_000 } = {}) {
    this.maxEntries = positiveInt420(maxEntries, 'GAS10_SETTLEMENT_MAX_ENTRIES_INVALID', 10_000);
    this.entries = [];
    this.byCommitment = new Map();
  }

  append({ settlementCommitment, reservedWei, actualCostWei, outcome = 'unknown', confirmation = 'observed', observedAt }) {
    const key = commitment420(settlementCommitment, 'GAS10_SETTLEMENT_COMMITMENT_INVALID');
    const reserved = nonNegativeBigInt420(reservedWei, 'GAS10_SETTLEMENT_RESERVED_INVALID');
    const actual = nonNegativeBigInt420(actualCostWei, 'GAS10_SETTLEMENT_ACTUAL_INVALID');
    if (!OUTCOMES_420.has(outcome)) fail420('GAS10_SETTLEMENT_OUTCOME_INVALID');
    if (!CONFIRMATIONS_420.has(confirmation)) fail420('GAS10_SETTLEMENT_CONFIRMATION_INVALID');
    const time = observedAt420(observedAt);

    if (this.byCommitment.has(key)) fail420('GAS10_SETTLEMENT_DUPLICATE');

    const record = Object.freeze({
      schemaVersion: '1.0.0',
      settlementCommitment: key,
      reservedWei: reserved,
      actualCostWei: actual,
      outcome,
      confirmation,
      observedAt: time,
      discrepancy: actual > reserved ? 'actual_exceeds_reserved' : 'none',
      authority: 'projection-only',
      settlementAuthority: false,
      accountingAuthority: false,
      executionAuthorization: false,
    });

    if (this.entries.length >= this.maxEntries) {
      const evicted = this.entries.shift();
      this.byCommitment.delete(evicted.settlementCommitment);
    }
    this.entries.push(record);
    this.byCommitment.set(key, record);
    return record;
  }

  get(settlementCommitment) {
    const key = commitment420(settlementCommitment, 'GAS10_SETTLEMENT_COMMITMENT_INVALID');
    return this.byCommitment.get(key) ?? null;
  }

  snapshot() {
    return Object.freeze(this.entries.map((entry) => entry));
  }

  summary() {
    let observedActualCostWei = 0n;
    let observedReservedWei = 0n;
    let discrepancyCount = 0;
    let finalizedCount = 0;
    for (const entry of this.entries) {
      observedActualCostWei += entry.actualCostWei;
      observedReservedWei += entry.reservedWei;
      if (entry.discrepancy !== 'none') discrepancyCount += 1;
      if (entry.confirmation === 'finalized') finalizedCount += 1;
    }
    return Object.freeze({
      entries: this.entries.length,
      finalizedCount,
      discrepancyCount,
      observedReservedWei,
      observedActualCostWei,
      authority: 'projection-only',
      settlementAuthority: false,
      accountingAuthority: false,
    });
  }
}
