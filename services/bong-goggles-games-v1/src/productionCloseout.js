'use strict';

const { buildSafeGameTelemetry } = require('./integrityHardening');

const CLOSEOUT_DRILLS = Object.freeze([
  'projection-stall',
  'canonical-replay-divergence',
  'ruleset-disable-rollback',
  'randomness-unavailable',
  'hidden-state-reveal-failure',
  'policy-invalidation',
  'challenge-spam',
  'wager-boundary'
]);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function boundedInteger(value, field, min, max) {
  const n = Number(required(value, field));
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`invalid ${field}`);
  return n;
}

function buildGamesMetric({ operation, outcome, latencyMs, retries = 0, reason = null, labels = {} }) {
  const result = String(required(outcome, 'outcome')).trim().toLowerCase();
  if (!['success', 'failure', 'denied', 'rebuild'].includes(result)) throw new Error('invalid outcome');
  return buildSafeGameTelemetry({
    subsystem: 'bong-goggles-games',
    operation: String(required(operation, 'operation')).trim(),
    outcome: result,
    latencyMs: boundedInteger(latencyMs, 'latencyMs', 0, 300000),
    retries: boundedInteger(retries, 'retries', 0, 100),
    reason: reason === null ? null : String(reason).slice(0, 160),
    labels
  });
}

function buildLoadQualification(input = {}) {
  return Object.freeze({
    lobbySessions: boundedInteger(input.lobbySessions ?? 500, 'lobbySessions', 1, 5000),
    activeSessions: boundedInteger(input.activeSessions ?? 250, 'activeSessions', 1, 2500),
    canonicalMoves: boundedInteger(input.canonicalMoves ?? 5000, 'canonicalMoves', 1, 50000),
    historyRows: boundedInteger(input.historyRows ?? 10000, 'historyRows', 1, 100000),
    leaderboardPlayers: boundedInteger(input.leaderboardPlayers ?? 1000, 'leaderboardPlayers', 1, 10000),
    concurrentResolvers: boundedInteger(input.concurrentResolvers ?? 25, 'concurrentResolvers', 1, 100)
  });
}

function evaluateLoadEvidence({ profile, measurements, errorCount = 0, divergenceCount = 0 }) {
  const p = profile || buildLoadQualification();
  const m = measurements || {};
  const limits = {
    projectionP95Ms: 500,
    intentP95Ms: 250,
    replayP95Ms: 1500,
    historyP95Ms: 750,
    leaderboardP95Ms: 1000
  };
  const failures = [];
  for (const [name, limit] of Object.entries(limits)) {
    const value = Number(m[name]);
    if (!Number.isFinite(value) || value < 0 || value > limit) failures.push(name);
  }
  if (!Number.isSafeInteger(Number(errorCount)) || Number(errorCount) !== 0) failures.push('errorCount');
  if (!Number.isSafeInteger(Number(divergenceCount)) || Number(divergenceCount) !== 0) failures.push('divergenceCount');
  return Object.freeze({
    passed: failures.length === 0,
    profile: p,
    limits: Object.freeze(limits),
    measurements: Object.freeze({ ...m }),
    errorCount: Number(errorCount),
    divergenceCount: Number(divergenceCount),
    failures: Object.freeze(failures)
  });
}

function qualifyDrill({ name, expected = 'contained', observed }) {
  if (!CLOSEOUT_DRILLS.includes(name)) throw new Error('unknown closeout drill');
  const exp = String(required(expected, 'expected')).trim();
  const obs = String(required(observed, 'observed')).trim();
  return Object.freeze({ name, expected: exp, observed: obs, passed: exp === obs });
}

function evaluateCloseoutReadiness({ drills, load, telemetryVerified, runbookPresent, exactHeadQualification }) {
  const normalized = Array.isArray(drills) ? drills : [];
  const byName = new Map(normalized.map((d) => [d.name, d]));
  const missingDrills = CLOSEOUT_DRILLS.filter((name) => !byName.has(name));
  const failedDrills = CLOSEOUT_DRILLS.filter((name) => byName.has(name) && byName.get(name).passed !== true);
  const qualification = exactHeadQualification || {};
  const exactHeadGreen = ['games', 'media', 'docs', 'integrated'].every((key) => qualification[key] === true);
  const loadQualified = Boolean(load && load.passed === true);
  const ready = missingDrills.length === 0 && failedDrills.length === 0 && loadQualified && telemetryVerified === true && runbookPresent === true && exactHeadGreen;
  return Object.freeze({
    ready,
    missingDrills: Object.freeze(missingDrills),
    failedDrills: Object.freeze(failedDrills),
    loadQualified,
    telemetryVerified: telemetryVerified === true,
    runbookPresent: runbookPresent === true,
    exactHeadGreen
  });
}

module.exports = {
  CLOSEOUT_DRILLS,
  buildGamesMetric,
  buildLoadQualification,
  evaluateLoadEvidence,
  qualifyDrill,
  evaluateCloseoutReadiness
};
