import { performance } from 'node:perf_hooks';
import { normalizeManifestDescriptor } from './manifestDescriptor.js';

const SECRET_KEY = /(authorization|cookie|credential|password|private[_-]?key|secret|session|token)/i;
const SECRET_VALUE = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bBasic\s+[A-Za-z0-9+/=]+/gi;
const RESPONSIVE_ROLES = new Set(['ORIGINAL', 'THUMBNAIL', 'POSTER', 'PREVIEW', 'TRANSCODE']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function normalizeAccessMode(mode) {
  const value = String(mode ?? 'public').trim().toLowerCase();
  if (value !== 'public' && value !== 'private') throw new Error('invalid delivery access mode');
  return value;
}

function itemFor(descriptor, itemId) {
  const normalized = normalizeManifestDescriptor(descriptor);
  const id = String(required(itemId, 'itemId')).toLowerCase();
  const item = normalized.items.find((candidate) => candidate.itemId === id);
  if (!item) throw new Error(`unknown media item ${itemId}`);
  return { descriptor: normalized, item };
}

export function immutableObjectCacheKey(storageObject) {
  const objectId = String(required(storageObject?.objectId, 'storageObject.objectId')).toLowerCase();
  const manifestId = String(required(storageObject?.manifestId, 'storageObject.manifestId')).toLowerCase();
  const shardIndex = Number(storageObject?.shardIndex);
  const shardRoot = String(required(storageObject?.shardRoot, 'storageObject.shardRoot')).replace(/^0x/, '').toLowerCase();
  const sizeBytes = Number(storageObject?.sizeBytes);
  const commitmentId = String(required(storageObject?.commitmentId, 'storageObject.commitmentId')).toLowerCase();
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error('invalid canonical storage identity');
  }
  return `${objectId}:${manifestId}:${shardIndex}:${shardRoot}:${sizeBytes}:${commitmentId}`;
}

export function deliveryCachePolicy({ accessMode = 'public', verified = false, currentBinding = true } = {}) {
  const mode = normalizeAccessMode(accessMode);
  if (mode === 'private') {
    return Object.freeze({
      'cache-control': 'private, no-store',
      pragma: 'no-cache',
      vary: 'authorization, cookie',
    });
  }
  if (verified !== true || currentBinding !== true) {
    return Object.freeze({ 'cache-control': 'no-store' });
  }
  return Object.freeze({
    'cache-control': 'public, max-age=31536000, immutable',
  });
}

function sameMediaFamily(sourceMime, candidateMime) {
  const sourceFamily = String(sourceMime).split('/')[0];
  const candidateFamily = String(candidateMime).split('/')[0];
  return sourceFamily === candidateFamily && (sourceFamily === 'image' || sourceFamily === 'video');
}

export function selectResponsiveSources({ descriptor, itemId }) {
  const { descriptor: normalized, item: source } = itemFor(descriptor, itemId);
  const candidates = normalized.items.filter((candidate) => {
    if (!RESPONSIVE_ROLES.has(candidate.role)) return false;
    if (!sameMediaFamily(source.mimeType, candidate.mimeType)) return false;
    return candidate.itemId === source.itemId || candidate.derivativeOf === source.itemId;
  });
  candidates.sort((a, b) => {
    const widthA = Number.isSafeInteger(a.width) ? a.width : Number.MAX_SAFE_INTEGER;
    const widthB = Number.isSafeInteger(b.width) ? b.width : Number.MAX_SAFE_INTEGER;
    if (widthA !== widthB) return widthA - widthB;
    if (a.storageObject.sizeBytes !== b.storageObject.sizeBytes) return a.storageObject.sizeBytes - b.storageObject.sizeBytes;
    return a.itemId.localeCompare(b.itemId);
  });
  return candidates.map((candidate) => ({
    itemId: candidate.itemId,
    role: candidate.role,
    mimeType: candidate.mimeType,
    width: candidate.width ?? null,
    height: candidate.height ?? null,
    byteSize: candidate.storageObject.sizeBytes,
    cacheKey: immutableObjectCacheKey(candidate.storageObject),
    authoritative: false,
  }));
}

export function redactStructuredLog(value) {
  const walk = (input, key = '') => {
    if (SECRET_KEY.test(key)) return '[REDACTED]';
    if (typeof input === 'string') return input.replace(SECRET_VALUE, '[REDACTED]');
    if (Array.isArray(input)) return input.map((entry) => walk(entry));
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([childKey, childValue]) => [childKey, walk(childValue, childKey)]));
    }
    return input;
  };
  return walk(value);
}

export class DeliveryMetrics {
  constructor() {
    this.requests = 0;
    this.successes = 0;
    this.failures = 0;
    this.integrityFailures = 0;
    this.routeFailures = 0;
    this.cacheHits = 0;
    this.storeHits = 0;
    this.latenciesMs = [];
  }

  recordSuccess({ latencyMs, tier = null }) {
    this.requests += 1;
    this.successes += 1;
    this.latenciesMs.push(Number(latencyMs));
    if (tier === 'cache') this.cacheHits += 1;
    if (tier === 'store') this.storeHits += 1;
  }

  recordFailure({ latencyMs, integrity = false, route = false }) {
    this.requests += 1;
    this.failures += 1;
    this.latenciesMs.push(Number(latencyMs));
    if (integrity) this.integrityFailures += 1;
    if (route) this.routeFailures += 1;
  }

  snapshot() {
    const sorted = this.latenciesMs.filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (p) => sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
    return Object.freeze({
      requests: this.requests,
      successes: this.successes,
      failures: this.failures,
      integrityFailures: this.integrityFailures,
      routeFailures: this.routeFailures,
      cacheHits: this.cacheHits,
      storeHits: this.storeHits,
      p50LatencyMs: percentile(0.50),
      p95LatencyMs: percentile(0.95),
      p99LatencyMs: percentile(0.99),
      authoritative: false,
    });
  }
}

function classifyFailure(error) {
  const message = String(error?.message ?? error).toLowerCase();
  return {
    integrity: message.includes('integrity') || message.includes('shard root') || message.includes('size mismatch'),
    route: message.includes('route') || message.includes('gateway') || message.includes('retriev') || message.includes('provider'),
  };
}

export class BongGogglesProductionDelivery {
  constructor({ deliveryService, metrics = new DeliveryMetrics(), log = null }) {
    if (!deliveryService || typeof deliveryService.deliver !== 'function') throw new Error('deliveryService required');
    if (!(metrics instanceof DeliveryMetrics)) throw new Error('metrics must be DeliveryMetrics');
    if (log !== null && typeof log !== 'function') throw new Error('log must be a function');
    this.deliveryService = deliveryService;
    this.metrics = metrics;
    this.log = log;
  }

  async deliver(request) {
    const started = performance.now();
    try {
      const response = await this.deliveryService.deliver(request);
      const latencyMs = performance.now() - started;
      this.metrics.recordSuccess({ latencyMs, tier: response.route?.tier ?? null });
      const accessMode = normalizeAccessMode(request?.access?.mode ?? 'public');
      const cachePolicy = deliveryCachePolicy({ accessMode, verified: response.verified === true, currentBinding: true });
      const output = {
        ...response,
        headers: { ...(response.headers ?? {}), ...cachePolicy },
        cacheKey: response.verified === true
          ? immutableObjectCacheKey(itemFor(request.descriptor, request.itemId).item.storageObject)
          : null,
      };
      this.#emit({ event: 'media.delivery.success', itemId: request.itemId, tier: response.route?.tier ?? null, latencyMs });
      return output;
    } catch (error) {
      const latencyMs = performance.now() - started;
      const failure = classifyFailure(error);
      this.metrics.recordFailure({ latencyMs, ...failure });
      this.#emit({ event: 'media.delivery.failure', itemId: request?.itemId ?? null, latencyMs, ...failure, error: String(error?.message ?? error) });
      throw error;
    }
  }

  #emit(record) {
    if (this.log) this.log(redactStructuredLog(record));
  }
}

export async function runFailureDrill({ name, operation, expectFailure = true }) {
  if (typeof operation !== 'function') throw new Error('drill operation required');
  const started = performance.now();
  try {
    await operation();
    return Object.freeze({ name: String(required(name, 'name')), passed: expectFailure !== true, observedFailure: false, latencyMs: performance.now() - started });
  } catch (error) {
    return Object.freeze({
      name: String(required(name, 'name')),
      passed: expectFailure === true,
      observedFailure: true,
      latencyMs: performance.now() - started,
      errorClass: classifyFailure(error),
    });
  }
}

export async function runLoadQualification({ operation, requests = 100, concurrency = 8, maxFailures = 0, maxP95LatencyMs = 2000 }) {
  if (typeof operation !== 'function') throw new Error('load operation required');
  if (!Number.isSafeInteger(requests) || requests <= 0 || !Number.isSafeInteger(concurrency) || concurrency <= 0) throw new Error('invalid load configuration');
  const latencies = [];
  let failures = 0;
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= requests) return;
      const started = performance.now();
      try { await operation(index); }
      catch { failures += 1; }
      latencies.push(performance.now() - started);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  latencies.sort((a, b) => a - b);
  const p95LatencyMs = latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] ?? 0;
  return Object.freeze({
    requests,
    concurrency,
    failures,
    p95LatencyMs,
    passed: failures <= maxFailures && p95LatencyMs <= maxP95LatencyMs,
    authoritative: false,
  });
}

export function launchReadiness({ drills = [], loadQualifications = [], metrics }) {
  const snapshot = metrics instanceof DeliveryMetrics ? metrics.snapshot() : required(metrics, 'metrics');
  const drillsPassed = drills.every((drill) => drill?.passed === true);
  const loadPassed = loadQualifications.every((qualification) => qualification?.passed === true);
  const cleanIntegrity = snapshot.integrityFailures === 0;
  return Object.freeze({
    ready: drillsPassed && loadPassed && cleanIntegrity,
    drillsPassed,
    loadPassed,
    cleanIntegrity,
    metrics: snapshot,
    authoritative: false,
  });
}
