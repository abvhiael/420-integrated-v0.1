import test from 'node:test';
import assert from 'node:assert/strict';
import { IndexerRuntimeState420 } from '../src/runtime-state.js';
import { IndexerShutdownCoordinator420, IndexerWorkController420, type IndexerTimer420 } from '../src/work-controller.js';

function deferred420<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class ManualTimer420 implements IndexerTimer420 {
  readonly waits: Array<{ ms: number; deferred: ReturnType<typeof deferred420<void>> }> = [];
  wait(ms: number): Promise<void> {
    const pending = deferred420<void>();
    this.waits.push({ ms, deferred: pending });
    return pending.promise;
  }
}

test('drain stops new work and waits for already accepted work', async () => {
  const controller = new IndexerWorkController420();
  const operation = deferred420<string>();
  const running = controller.run(() => operation.promise);
  assert.equal(controller.inFlight, 1);

  const timer = new ManualTimer420();
  const draining = controller.drain(5_000, timer);
  assert.equal(controller.accepting, false);
  await assert.rejects(() => controller.run(async () => 'late'), /draining/);

  operation.resolve('done');
  assert.equal(await running, 'done');
  assert.deepEqual(await draining, { drained: true, timedOut: false, inFlight: 0 });
});

test('shutdown timeout fails runtime closed and reports remaining in-flight work', async () => {
  const runtime = new IndexerRuntimeState420(100);
  runtime.markServing();
  runtime.markIngestSuccess(101, 12n);
  const controller = new IndexerWorkController420();
  const operation = deferred420<void>();
  const running = controller.run(() => operation.promise);
  const timer = new ManualTimer420();
  const coordinator = new IndexerShutdownCoordinator420(runtime, controller);

  const shutdown = coordinator.shutdown(2_000, timer);
  assert.equal(runtime.snapshot().phase, 'draining');
  assert.equal(timer.waits[0]?.ms, 2_000);
  timer.waits[0]!.deferred.resolve();

  assert.deepEqual(await shutdown, { drained: false, timedOut: true, inFlight: 1, runtimeFailed: true });
  assert.equal(runtime.snapshot().phase, 'failed');
  assert.equal(runtime.snapshot().failureCode, 'shutdown_timeout');

  operation.resolve();
  await running;
});

test('shutdown with no work enters draining without failure', async () => {
  const runtime = new IndexerRuntimeState420(100);
  runtime.markServing();
  const controller = new IndexerWorkController420();
  const coordinator = new IndexerShutdownCoordinator420(runtime, controller);

  assert.deepEqual(await coordinator.shutdown(1_000), {
    drained: true,
    timedOut: false,
    inFlight: 0,
    runtimeFailed: false
  });
  assert.equal(runtime.snapshot().phase, 'draining');
});

test('invalid shutdown bounds fail closed', async () => {
  const controller = new IndexerWorkController420();
  await assert.rejects(() => controller.drain(0), /shutdown timeout/);
  await assert.rejects(() => controller.drain(Number.MAX_SAFE_INTEGER), /shutdown timeout/);
});
