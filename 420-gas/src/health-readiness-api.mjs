export class GasHealthReadinessError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasHealthReadinessError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasHealthReadinessError420(code);
}

function isoTime420(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail420('GAS10_HEALTH_TIME_INVALID');
  return new Date(ms).toISOString();
}

function object420(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail420(code);
  return value;
}

function enum420(value, allowed, code) {
  if (!allowed.has(value)) fail420(code);
  return value;
}

function nonNegativeInt420(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail420(code);
  return value;
}

const READINESS_STATES_420 = new Set(['ready', 'degraded', 'not-ready']);
const SPONSOR_STATES_420 = new Set(['ready', 'low', 'unavailable']);
const RECOVERY_STATES_420 = new Set(['healthy', 'degraded', 'unavailable', 'recovering']);
const SAFE_DETAIL_CODES_420 = new Set([
  'deposit_ready',
  'deposit_low',
  'deposit_below_degraded_threshold',
  'reservation_exceeds_deposit',
]);

function normalizeReadiness420(input) {
  const readiness = object420(input, 'GAS10_HEALTH_READINESS_INVALID');
  const state = enum420(readiness.state, READINESS_STATES_420, 'GAS10_HEALTH_READINESS_STATE_INVALID');
  const sponsor = enum420(readiness.sponsor, SPONSOR_STATES_420, 'GAS10_HEALTH_SPONSOR_STATE_INVALID');
  if (!SAFE_DETAIL_CODES_420.has(readiness.detailCode)) fail420('GAS10_HEALTH_READINESS_REASON_INVALID');
  return Object.freeze({ state, sponsor, reasonCode: readiness.detailCode });
}

function normalizeRecovery420(input) {
  const recovery = object420(input, 'GAS10_HEALTH_RECOVERY_INVALID');
  const state = enum420(recovery.state, RECOVERY_STATES_420, 'GAS10_HEALTH_RECOVERY_STATE_INVALID');
  if (typeof recovery.sponsorshipAvailable !== 'boolean') fail420('GAS10_HEALTH_RECOVERY_SPONSORSHIP_INVALID');
  return Object.freeze({ state, sponsorshipAvailable: recovery.sponsorshipAvailable });
}

function normalizeSettlement420(input) {
  const settlement = object420(input, 'GAS10_HEALTH_SETTLEMENT_INVALID');
  const entries = nonNegativeInt420(settlement.entries, 'GAS10_HEALTH_SETTLEMENT_ENTRIES_INVALID');
  const finalizedCount = nonNegativeInt420(settlement.finalizedCount, 'GAS10_HEALTH_SETTLEMENT_FINALIZED_INVALID');
  const discrepancyCount = nonNegativeInt420(settlement.discrepancyCount, 'GAS10_HEALTH_SETTLEMENT_DISCREPANCIES_INVALID');
  if (finalizedCount > entries || discrepancyCount > entries) fail420('GAS10_HEALTH_SETTLEMENT_COUNTS_INVALID');
  return Object.freeze({ entries, finalizedCount, discrepancyCount });
}

function deriveReason420({ readiness, recovery, settlement }) {
  if (recovery.state === 'unavailable') return 'component_unavailable';
  if (recovery.state === 'recovering') return 'component_recovering';
  if (readiness.state === 'not-ready') return readiness.reasonCode;
  if (settlement.discrepancyCount > 0) return 'settlement_discrepancy_observed';
  if (recovery.state === 'degraded') return 'component_degraded';
  if (readiness.state === 'degraded') return readiness.reasonCode;
  return 'healthy';
}

export function createGasHealthReadinessProjection420({ readiness, recovery, settlementSummary, observedAt } = {}) {
  const normalizedReadiness = normalizeReadiness420(readiness);
  const normalizedRecovery = normalizeRecovery420(recovery);
  const normalizedSettlement = normalizeSettlement420(settlementSummary);
  const observed = isoTime420(observedAt);

  let state = 'ready';
  if (normalizedRecovery.state === 'unavailable' || normalizedRecovery.state === 'recovering' || normalizedReadiness.state === 'not-ready') {
    state = 'not-ready';
  } else if (normalizedRecovery.state === 'degraded' || normalizedReadiness.state === 'degraded' || normalizedSettlement.discrepancyCount > 0) {
    state = 'degraded';
  }

  const sponsorshipAvailable = state !== 'not-ready' && normalizedRecovery.sponsorshipAvailable && normalizedReadiness.state !== 'not-ready';

  return Object.freeze({
    schemaVersion: '1.0.0',
    service: '420gas',
    state,
    reasonCode: deriveReason420({ readiness: normalizedReadiness, recovery: normalizedRecovery, settlement: normalizedSettlement }),
    sponsor: normalizedReadiness.sponsor,
    recovery: normalizedRecovery.state,
    settlement: Object.freeze({
      retainedEntries: normalizedSettlement.entries,
      finalizedEntries: normalizedSettlement.finalizedCount,
      discrepancyCount: normalizedSettlement.discrepancyCount,
    }),
    observedAt: observed,
    sponsorshipAvailable,
    authority: 'status-projection-only',
    executionAuthorization: false,
    sponsorshipAuthorization: false,
    settlementAuthority: false,
    accountingAuthority: false,
    canonicalProtocolAuthority: false,
  });
}
