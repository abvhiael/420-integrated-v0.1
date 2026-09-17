'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLOSEOUT_DRILLS,
  buildGamesMetric,
  buildLoadQualification,
  evaluateLoadEvidence,
  qualifyDrill,
  evaluateCloseoutReadiness
} = require('../src/productionCloseout');

test('games metrics preserve operational fields and redact hidden labels', () => {
  const metric = buildGamesMetric({
    operation: 'canonical-rebuild',
    outcome: 'rebuild',
    latencyMs: 91,
    retries: 1,
    labels: { gameType: 'CHESS', hand: ['secret-card'], salt: 'secret-salt' }
  });
  assert.equal(metric.subsystem, 'bong-goggles-games');
  assert.equal(metric.latencyMs, 91);
  assert.equal(metric.labels.gameType, 'CHESS');
  assert.equal(metric.labels.hand, '[REDACTED]');
  assert.equal(metric.labels.salt, '[REDACTED]');
});

test('bounded load profile has production closeout defaults and runaway caps', () => {
  assert.deepEqual(buildLoadQualification(), {
    lobbySessions: 500,
    activeSessions: 250,
    canonicalMoves: 5000,
    historyRows: 10000,
    leaderboardPlayers: 1000,
    concurrentResolvers: 25
  });
  assert.throws(() => buildLoadQualification({ canonicalMoves: 50001 }), /invalid canonicalMoves/);
  assert.throws(() => buildLoadQualification({ concurrentResolvers: 101 }), /invalid concurrentResolvers/);
});

test('load evidence passes only within latency and integrity budgets', () => {
  const measurements = {
    projectionP95Ms: 120,
    intentP95Ms: 80,
    replayP95Ms: 450,
    historyP95Ms: 220,
    leaderboardP95Ms: 300
  };
  const evidence = evaluateLoadEvidence({ measurements, errorCount: 0, divergenceCount: 0 });
  assert.equal(evidence.passed, true);
  assert.deepEqual(evidence.failures, []);
});

test('load evidence fails closed on latency overrun or canonical divergence', () => {
  const evidence = evaluateLoadEvidence({
    measurements: {
      projectionP95Ms: 120,
      intentP95Ms: 80,
      replayP95Ms: 1600,
      historyP95Ms: 220,
      leaderboardP95Ms: 300
    },
    errorCount: 0,
    divergenceCount: 1
  });
  assert.equal(evidence.passed, false);
  assert.deepEqual(evidence.failures, ['replayP95Ms', 'divergenceCount']);
});

test('all required production failure drills qualify deterministically', () => {
  const drills = CLOSEOUT_DRILLS.map((name) => qualifyDrill({ name, observed: 'contained' }));
  assert.equal(drills.length, 8);
  assert.ok(drills.every((drill) => drill.passed));
});

test('missing drill or exact-head lane prevents readiness', () => {
  const drills = CLOSEOUT_DRILLS.slice(1).map((name) => qualifyDrill({ name, observed: 'contained' }));
  const readiness = evaluateCloseoutReadiness({
    drills,
    load: { passed: true },
    telemetryVerified: true,
    runbookPresent: true,
    exactHeadQualification: { games: true, media: true, docs: true, integrated: false }
  });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missingDrills, ['projection-stall']);
  assert.equal(readiness.exactHeadGreen, false);
});

test('complete green evidence closes BG-15.9 without granting new authority', () => {
  const drills = CLOSEOUT_DRILLS.map((name) => qualifyDrill({ name, observed: 'contained' }));
  const load = evaluateLoadEvidence({
    measurements: {
      projectionP95Ms: 100,
      intentP95Ms: 50,
      replayP95Ms: 300,
      historyP95Ms: 180,
      leaderboardP95Ms: 250
    }
  });
  const readiness = evaluateCloseoutReadiness({
    drills,
    load,
    telemetryVerified: true,
    runbookPresent: true,
    exactHeadQualification: { games: true, media: true, docs: true, integrated: true }
  });
  assert.deepEqual(readiness, {
    ready: true,
    missingDrills: [],
    failedDrills: [],
    loadQualified: true,
    telemetryVerified: true,
    runbookPresent: true,
    exactHeadGreen: true
  });
});
