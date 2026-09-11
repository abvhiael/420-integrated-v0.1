import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerPublicApiAdapter420 } from '../src/api-surface.js';
import { IndexerQueryService420 } from '../src/query-service.js';
import { IndexerRuntimeState420, evaluateIndexerRuntimeReadiness420 } from '../src/runtime-state.js';

class FakeDb420 implements SqlExecutor420 {
  queue: unknown[] = [];
  async query(): Promise<unknown> { return this.queue.shift() ?? { rows: [] }; }
}

test('runtime state fails closed until serving with a successful ingest', () => {
  const runtime = new IndexerRuntimeState420(1_000);
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 1_500, 1_000), {
    ready: false, stale: false, reason: 'starting'
  });

  runtime.markServing();
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 1_500, 1_000), {
    ready: false, stale: false, reason: 'no_ingest_success'
  });

  runtime.markIngestSuccess(1_400, 125n);
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 1_500, 1_000), {
    ready: true, stale: false, reason: null
  });
});

test('runtime readiness detects stale ingestion and draining state', () => {
  const runtime = new IndexerRuntimeState420(1_000);
  runtime.markServing();
  runtime.markIngestSuccess(1_100, 125n);
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 2_101, 1_000), {
    ready: false, stale: true, reason: 'stale_ingest'
  });

  runtime.markDraining();
  assert.deepEqual(evaluateIndexerRuntimeReadiness420(runtime.snapshot(), 2_101, 1_000), {
    ready: false, stale: false, reason: 'draining'
  });
});

test('runtime state rejects backwards ingest time and invalid recovery from terminal states', () => {
  const runtime = new IndexerRuntimeState420(1_000);
  runtime.markServing();
  runtime.markIngestSuccess(1_200, 10n);
  assert.throws(() => runtime.markIngestSuccess(1_199, 11n), /moved backwards/);
  runtime.markFailed('rpc_unavailable');
  assert.throws(() => runtime.markServing(), /cannot mark failed runtime as serving/);
  assert.throws(() => runtime.markDraining(), /failed runtime cannot enter draining/);
});

test('public adapter makes readiness stale-aware and exposes source lag', async () => {
  const db = new FakeDb420();
  const runtime = new IndexerRuntimeState420(1_000);
  runtime.markServing();
  runtime.markIngestSuccess(1_100, 125n);
  const api = new IndexerPublicApiAdapter420(
    new IndexerQueryService420(db),
    { mode: 'head' },
    { runtimeState: runtime, maxIngestStaleMs: 1_000, now: () => 2_101 }
  );

  db.queue.push({ rows: [{ ok: 1 }] }, { rows: [{ block_number: '120' }] });
  const readiness = await api.readiness(420n);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.runtime?.stale, true);
  assert.equal(readiness.runtime?.readinessReason, 'stale_ingest');

  db.queue.push({ rows: [{ block_number: '120', block_hash: '0x120', block_timestamp: '1700000120' }] });
  const status = await api.status(420n);
  assert.equal(status.lag, '5');
  assert.equal(status.runtime?.lastObservedSourceHead, '125');
  assert.equal(status.authoritative, false);
});
