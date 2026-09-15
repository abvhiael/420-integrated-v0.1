export class GasReadinessError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasReadinessError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasReadinessError420(code);
}

function uint420(value, code) {
  const parsed = typeof value === 'bigint'
    ? value
    : (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : -1n);
  if (parsed < 0n) fail420(code);
  return parsed;
}

function positive420(value, code) {
  const parsed = uint420(value, code);
  if (parsed <= 0n) fail420(code);
  return parsed;
}

function time420(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail420('GAS10_READINESS_TIME_INVALID');
  return new Date(parsed).toISOString();
}

export function validateGasSponsorReadinessThresholds420(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail420('GAS10_READINESS_THRESHOLDS_INVALID');
  const allowed = new Set(['minReadyAvailableWei', 'minDegradedAvailableWei']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail420('GAS10_READINESS_THRESHOLDS_FIELD_INVALID');

  const minReadyAvailableWei = positive420(input.minReadyAvailableWei ?? '1000000000000000000', 'GAS10_READINESS_READY_THRESHOLD_INVALID');
  const minDegradedAvailableWei = positive420(input.minDegradedAvailableWei ?? '100000000000000000', 'GAS10_READINESS_DEGRADED_THRESHOLD_INVALID');
  if (minDegradedAvailableWei > minReadyAvailableWei) fail420('GAS10_READINESS_THRESHOLD_ORDER_INVALID');

  return Object.freeze({ minReadyAvailableWei, minDegradedAvailableWei });
}

export function evaluateGasSponsorReadiness420({
  depositWei,
  reservedWei,
  observedAt,
  thresholds = {},
} = {}) {
  const deposit = uint420(depositWei, 'GAS10_READINESS_DEPOSIT_INVALID');
  const reserved = uint420(reservedWei, 'GAS10_READINESS_RESERVED_INVALID');
  const observed = time420(observedAt);
  const limits = validateGasSponsorReadinessThresholds420(thresholds);

  if (reserved > deposit) {
    return Object.freeze({
      schemaVersion: '1.0.0',
      state: 'not-ready',
      sponsor: 'unavailable',
      detailCode: 'reservation_exceeds_deposit',
      depositWei: deposit.toString(10),
      reservedWei: reserved.toString(10),
      availableWei: '0',
      observedAt: observed,
      authority: 'telemetry-only',
      sponsorshipAuthorization: false,
      settlementAuthority: false,
      canonicalProtocolAuthority: false,
    });
  }

  const available = deposit - reserved;
  let state = 'not-ready';
  let sponsor = 'unavailable';
  let detailCode = 'deposit_below_degraded_threshold';
  if (available >= limits.minReadyAvailableWei) {
    state = 'ready';
    sponsor = 'ready';
    detailCode = 'deposit_ready';
  } else if (available >= limits.minDegradedAvailableWei) {
    state = 'degraded';
    sponsor = 'low';
    detailCode = 'deposit_low';
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    state,
    sponsor,
    detailCode,
    depositWei: deposit.toString(10),
    reservedWei: reserved.toString(10),
    availableWei: available.toString(10),
    observedAt: observed,
    authority: 'telemetry-only',
    sponsorshipAuthorization: false,
    settlementAuthority: false,
    canonicalProtocolAuthority: false,
  });
}
