const METRIC_NAMES_420 = new Set([
  'quotes_requested_total',
  'quotes_issued_total',
  'quotes_rejected_total',
  'quota_rejections_total',
  'signer_failures_total',
  'reservations_active',
]);

const LABEL_KEYS_420 = new Set(['result', 'reason', 'source']);
const LABEL_VALUE_RE = /^[a-z0-9._-]{1,32}$/;

export class GasObservabilityError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasObservabilityError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasObservabilityError420(code);
}

function metricName420(value) {
  if (!METRIC_NAMES_420.has(value)) fail420('GAS10_METRIC_NAME_INVALID');
  return value;
}

function labels420(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail420('GAS10_LABELS_INVALID');
  const entries = Object.entries(input);
  if (entries.length > 2) fail420('GAS10_LABEL_CARDINALITY_EXCEEDED');
  const normalized = {};
  for (const [key, value] of entries) {
    if (!LABEL_KEYS_420.has(key)) fail420('GAS10_LABEL_KEY_INVALID');
    if (typeof value !== 'string' || !LABEL_VALUE_RE.test(value)) fail420('GAS10_LABEL_VALUE_INVALID');
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

function seriesKey420(name, labels) {
  return JSON.stringify([name, Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))]);
}

export class GasMetrics420 {
  constructor({ maxSeries = 64 } = {}) {
    if (!Number.isSafeInteger(maxSeries) || maxSeries < 1 || maxSeries > 1024) fail420('GAS10_MAX_SERIES_INVALID');
    this.maxSeries = maxSeries;
    this.series = new Map();
  }

  increment(name, labels = {}, amount = 1) {
    const metric = metricName420(name);
    const normalizedLabels = labels420(labels);
    if (!Number.isSafeInteger(amount) || amount < 1) fail420('GAS10_METRIC_AMOUNT_INVALID');
    const key = seriesKey420(metric, normalizedLabels);
    const current = this.series.get(key);
    if (!current && this.series.size >= this.maxSeries) fail420('GAS10_METRIC_SERIES_CAPACITY_EXCEEDED');
    const next = Object.freeze({ name: metric, labels: normalizedLabels, value: (current?.value ?? 0) + amount });
    this.series.set(key, next);
    return next;
  }

  snapshot() {
    return Object.freeze([...this.series.values()].map((entry) => Object.freeze({ ...entry })));
  }
}

export function createGasOperationalStatus420({ service = '420gas', state = 'unknown', observedAt, sponsor = 'unknown', settlement = 'unknown', detailCode = null } = {}) {
  if (service !== '420gas') fail420('GAS10_STATUS_SERVICE_INVALID');
  if (!['ready', 'degraded', 'unavailable', 'unknown'].includes(state)) fail420('GAS10_STATUS_STATE_INVALID');
  if (!['ready', 'low', 'unavailable', 'unknown'].includes(sponsor)) fail420('GAS10_STATUS_SPONSOR_INVALID');
  if (!['healthy', 'degraded', 'unknown'].includes(settlement)) fail420('GAS10_STATUS_SETTLEMENT_INVALID');
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) fail420('GAS10_STATUS_TIME_INVALID');
  if (detailCode !== null && (typeof detailCode !== 'string' || !LABEL_VALUE_RE.test(detailCode))) fail420('GAS10_STATUS_DETAIL_INVALID');
  return Object.freeze({
    schemaVersion: '1.0.0',
    service,
    state,
    sponsor,
    settlement,
    observedAt: new Date(observedMs).toISOString(),
    detailCode,
    authority: 'telemetry-only',
    executionAuthorization: false,
    settlementAuthority: false,
    canonicalProtocolAuthority: false,
  });
}
