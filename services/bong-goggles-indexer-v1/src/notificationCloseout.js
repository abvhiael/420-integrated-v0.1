import { performance } from 'node:perf_hooks';

function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil((p / 100) * ordered.length) - 1));
  return ordered[index];
}

export async function qualifyNotificationLoad({
  operation,
  iterations = 1000,
  concurrency = 25,
  p95BudgetMs = 250,
} = {}) {
  if (typeof operation !== 'function') throw new Error('notification qualification operation required');
  const total = positiveInt(iterations, 'iterations');
  const width = positiveInt(concurrency, 'concurrency');
  const budget = Number(p95BudgetMs);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('p95BudgetMs must be positive');

  const durations = [];
  let failures = 0;
  for (let offset = 0; offset < total; offset += width) {
    const batchSize = Math.min(width, total - offset);
    const batch = Array.from({ length: batchSize }, async (_, index) => {
      const started = performance.now();
      try {
        await operation(offset + index);
      } catch {
        failures += 1;
      } finally {
        durations.push(performance.now() - started);
      }
    });
    await Promise.all(batch);
  }

  const p95Ms = percentile(durations, 95);
  return Object.freeze({
    iterations: total,
    concurrency: width,
    failures,
    p95Ms,
    p95BudgetMs: budget,
    qualified: failures === 0 && p95Ms <= budget,
    authoritative: false,
  });
}

export function qualifyReplayDrill({ before, after } = {}) {
  if (!before || !after) throw new Error('replay snapshots required');
  const beforeIds = JSON.stringify(before.deliveredIds ?? []);
  const afterIds = JSON.stringify(after.deliveredIds ?? []);
  const beforeCheckpoint = JSON.stringify(before.checkpoint ?? null);
  const afterCheckpoint = JSON.stringify(after.checkpoint ?? null);
  const converged = beforeIds === afterIds && beforeCheckpoint === afterCheckpoint;
  return Object.freeze({ converged, authoritative: false });
}

export function qualifyCanonicalityDrill({ local, canonical } = {}) {
  if (!local || !canonical) throw new Error('canonicality checkpoints required');
  const heightMatches = Number(local.blockNumber) === Number(canonical.blockNumber);
  const hashMatches = String(local.blockHash ?? '').toLowerCase() === String(canonical.blockHash ?? '').toLowerCase();
  return Object.freeze({
    converged: heightMatches && hashMatches,
    degradedRequired: !(heightMatches && hashMatches),
    authoritative: false,
  });
}

export async function qualifyProviderDegradation({ handoffs = [], deliver } = {}) {
  if (!Array.isArray(handoffs)) throw new Error('handoffs must be an array');
  if (typeof deliver !== 'function') throw new Error('provider deliver function required');
  const results = [];
  for (const handoff of handoffs) {
    try {
      await deliver(handoff);
      results.push({ providerId: handoff.providerId, ok: true });
    } catch (error) {
      results.push({ providerId: handoff.providerId, ok: false, error: String(error?.message ?? error) });
    }
  }
  const successful = results.filter((item) => item.ok).length;
  const failed = results.length - successful;
  return Object.freeze({
    results: Object.freeze(results.map((item) => Object.freeze(item))),
    successful,
    failed,
    isolated: failed === 0 || successful > 0,
    authoritative: false,
  });
}

export function notificationCloseoutDecision({ load, replay, canonicality, provider } = {}) {
  if (!load || !replay || !canonicality || !provider) throw new Error('complete notification closeout evidence required');
  const qualified = load.qualified === true
    && replay.converged === true
    && canonicality.converged === true
    && provider.isolated === true;
  return Object.freeze({
    qualified,
    mergeReady: qualified,
    authoritative: false,
  });
}
