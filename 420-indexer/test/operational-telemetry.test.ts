import test from 'node:test';
import assert from 'node:assert/strict';
import { IndexerOperationalTelemetry420 } from '../src/operational-telemetry.js';
import { IndexerDeliveryQueue420 } from '../src/event-delivery.js';
import { IndexerWorkController420 } from '../src/work-controller.js';
import type { IndexerEventEnvelope420 } from '../src/event-stream.js';

function event420(): IndexerEventEnvelope420 {
  return {
    streamVersion: 'v1',
    id: '420evt:v1:420:block:tx:1',
    source: 'protocol',
    topic: '420Pay.PaymentSettled',
    protocol: '420Pay',
    eventName: 'PaymentSettled',
    objectKey: 'payment:42',
    lifecycleState: 'COMPLETED',
    fields: { secretLikePayload: 'must-not-appear-in-telemetry' },
    provenance: {
      chainId: '420',
      blockNumber: '88',
      blockHash: '0xblock',
      transactionHash: '0xtx',
      transactionIndex: 0,
      logIndex: 1,
      contractAddress: '0xcontract'
    },
    authoritative: false
  };
}

test('telemetry records ingest, lag and reorg progress as non-authoritative aggregates', () => {
  const telemetry = new IndexerOperationalTelemetry420();
  telemetry.recordIngestRun(3, 2);
  telemetry.recordIngestFailure();
  telemetry.setHeads(100n, 107n);

  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.ingestRuns, 1);
  assert.equal(snapshot.ingestFailures, 1);
  assert.equal(snapshot.blocksProcessed, 3);
  assert.equal(snapshot.reorgRecoveries, 1);
  assert.equal(snapshot.reorgBlocksRecovered, 2);
  assert.equal(snapshot.indexedHead, '100');
  assert.equal(snapshot.sourceHead, '107');
  assert.equal(snapshot.lagBlocks, '7');
  assert.equal(snapshot.authoritative, false);
});

test('delivery telemetry tracks pressure and retry/dead-letter transitions without payload leakage', () => {
  const telemetry = new IndexerOperationalTelemetry420();
  const queue = new IndexerDeliveryQueue420(telemetry);
  const event = event420();
  const match = { subscriptionId: 'private-subscription', eventId: event.id, matched: true };
  const policy = { provider: 'mail', destination: 'private@example.test', maxAttempts: 1 };

  const record = queue.enqueue(match, event, policy, 1000);
  assert.equal(telemetry.snapshot().deliveryQueued, 1);
  queue.claim(record.id, 1000);
  assert.equal(telemetry.snapshot().deliveryInFlight, 1);
  queue.fail(record.id, 'provider failed with private detail', 1001);

  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.deliveryEnqueued, 1);
  assert.equal(snapshot.deliveryAttempts, 1);
  assert.equal(snapshot.deliveryFailed, 1);
  assert.equal(snapshot.deliveryDeadLettered, 1);
  assert.equal(snapshot.deliveryDeadLetter, 1);

  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('private@example.test'), false);
  assert.equal(serialized.includes('private-subscription'), false);
  assert.equal(serialized.includes('must-not-appear-in-telemetry'), false);
  assert.equal(serialized.includes('0xtx'), false);
  assert.equal(serialized.includes('0xcontract'), false);
});

test('work telemetry exposes only aggregate pressure and rejected admission', async () => {
  const telemetry = new IndexerOperationalTelemetry420();
  const work = new IndexerWorkController420(telemetry);
  let release!: () => void;
  const pending = work.run(() => new Promise<void>((resolve) => { release = resolve; }));
  assert.equal(telemetry.snapshot().workInFlight, 1);
  work.beginDrain();
  await assert.rejects(() => work.run(async () => undefined), /draining/);
  assert.equal(telemetry.snapshot().workRejected, 1);
  release();
  await pending;
  assert.equal(telemetry.snapshot().workInFlight, 0);
});

test('telemetry fails closed on invalid numeric gauges', () => {
  const telemetry = new IndexerOperationalTelemetry420();
  assert.throws(() => telemetry.recordIngestRun(-1), /non-negative/);
  assert.throws(() => telemetry.setHeads(-1n, 0n), /non-negative/);
  assert.throws(() => telemetry.setWorkInFlight(-1), /non-negative/);
  assert.throws(() => telemetry.setDeliveryPressure(0, -1, 0, 0), /non-negative/);
});
