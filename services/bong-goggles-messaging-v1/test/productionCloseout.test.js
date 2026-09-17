import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSEOUT_DRILLS,
  redactTelemetry,
  buildMessagingMetric,
  qualifyDrill,
  buildLoadQualification,
  evaluateCloseoutReadiness
} from '../src/productionCloseout.js';

test('telemetry redacts nested messaging secrets', () => {
  const out = redactTelemetry({
    body: 'secret',
    nested: { token: 'abc', safe: 'ok' },
    list: [{ privateKey: 'key', count: 2 }]
  });
  assert.equal(out.body, '[REDACTED]');
  assert.equal(out.nested.token, '[REDACTED]');
  assert.equal(out.nested.safe, 'ok');
  assert.equal(out.list[0].privateKey, '[REDACTED]');
  assert.equal(out.list[0].count, 2);
});

test('metric builder keeps operational fields and redacts label secrets', () => {
  const metric = buildMessagingMetric({
    operation: 'send',
    outcome: 'success',
    latencyMs: 42,
    retries: 1,
    labels: { conversationClass: 'direct', sessionSecret: 'nope' }
  });
  assert.equal(metric.subsystem, 'bong-goggles-messaging');
  assert.equal(metric.latencyMs, 42);
  assert.equal(metric.retries, 1);
  assert.equal(metric.labels.sessionSecret, '[REDACTED]');
});

test('all required failure drills can be qualified deterministically', () => {
  const drills = CLOSEOUT_DRILLS.map((name) => qualifyDrill({ name, expected: 'fail-closed', observed: 'fail-closed' }));
  assert.equal(drills.length, 6);
  assert.ok(drills.every((d) => d.passed));
});

test('failed drill prevents production readiness', () => {
  const drills = CLOSEOUT_DRILLS.map((name) => qualifyDrill({
    name,
    expected: 'fail-closed',
    observed: name === 'blocked-peer' ? 'allowed' : 'fail-closed'
  }));
  const readiness = evaluateCloseoutReadiness({
    drills,
    load: { passed: true },
    telemetryRedactionVerified: true,
    runbookPresent: true
  });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.failedDrills, ['blocked-peer']);
});

test('bounded load profile rejects runaway qualification input', () => {
  assert.deepEqual(buildLoadQualification(), {
    inboxConversations: 500,
    sends: 1000,
    receipts: 2000,
    attachments: 250,
    concurrency: 20
  });
  assert.throws(() => buildLoadQualification({ sends: 10001 }), /invalid sends/);
  assert.throws(() => buildLoadQualification({ concurrency: 101 }), /invalid concurrency/);
});

test('complete green closeout evidence is ready', () => {
  const drills = CLOSEOUT_DRILLS.map((name) => qualifyDrill({ name, expected: 'contained', observed: 'contained' }));
  const readiness = evaluateCloseoutReadiness({
    drills,
    load: { passed: true, profile: buildLoadQualification() },
    telemetryRedactionVerified: true,
    runbookPresent: true
  });
  assert.deepEqual(readiness, {
    ready: true,
    missingDrills: [],
    failedDrills: [],
    loadQualified: true,
    telemetryRedactionVerified: true,
    runbookPresent: true
  });
});
