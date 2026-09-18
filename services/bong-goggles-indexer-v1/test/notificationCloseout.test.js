import test from 'node:test';
import assert from 'node:assert/strict';

import {
  notificationCloseoutDecision,
  qualifyCanonicalityDrill,
  qualifyNotificationLoad,
  qualifyProviderDegradation,
  qualifyReplayDrill,
} from '../src/notificationCloseout.js';

test('bounded load qualification reports p95 and requires zero failures', async () => {
  const result = await qualifyNotificationLoad({
    iterations: 40,
    concurrency: 8,
    p95BudgetMs: 100,
    operation: async () => {},
  });
  assert.equal(result.iterations, 40);
  assert.equal(result.failures, 0);
  assert.equal(result.qualified, true);
  assert.equal(result.authoritative, false);
});

test('bounded load qualification fails when any iteration fails', async () => {
  const result = await qualifyNotificationLoad({
    iterations: 10,
    concurrency: 5,
    p95BudgetMs: 100,
    operation: async (index) => {
      if (index === 4) throw new Error('boom');
    },
  });
  assert.equal(result.failures, 1);
  assert.equal(result.qualified, false);
});

test('replay drill requires identical delivered IDs and checkpoint', () => {
  const snapshot = {
    deliveredIds: ['a', 'b'],
    checkpoint: { blockNumber: 10, blockHash: '0xabc' },
  };
  assert.equal(qualifyReplayDrill({ before: snapshot, after: structuredClone(snapshot) }).converged, true);
  assert.equal(qualifyReplayDrill({ before: snapshot, after: { ...snapshot, deliveredIds: ['a'] } }).converged, false);
});

test('canonicality drill exposes divergence and requires degraded presentation', () => {
  const good = qualifyCanonicalityDrill({
    local: { blockNumber: 100, blockHash: '0xABC' },
    canonical: { blockNumber: 100, blockHash: '0xabc' },
  });
  assert.equal(good.converged, true);
  assert.equal(good.degradedRequired, false);

  const bad = qualifyCanonicalityDrill({
    local: { blockNumber: 99, blockHash: '0xold' },
    canonical: { blockNumber: 100, blockHash: '0xnew' },
  });
  assert.equal(bad.converged, false);
  assert.equal(bad.degradedRequired, true);
});

test('provider degradation is isolated when one provider fails and others continue', async () => {
  const result = await qualifyProviderDegradation({
    handoffs: [
      { providerId: 'genesis-in-app' },
      { providerId: 'genesis-web' },
      { providerId: 'genesis-push' },
    ],
    deliver: async ({ providerId }) => {
      if (providerId === 'genesis-web') throw new Error('web provider unavailable');
    },
  });
  assert.equal(result.successful, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.isolated, true);
});

test('closeout decision is merge-ready only when every gate passes', () => {
  const qualified = notificationCloseoutDecision({
    load: { qualified: true },
    replay: { converged: true },
    canonicality: { converged: true },
    provider: { isolated: true },
  });
  assert.equal(qualified.mergeReady, true);

  const blocked = notificationCloseoutDecision({
    load: { qualified: true },
    replay: { converged: false },
    canonicality: { converged: true },
    provider: { isolated: true },
  });
  assert.equal(blocked.mergeReady, false);
});
