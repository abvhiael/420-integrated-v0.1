import test from 'node:test';
import assert from 'node:assert/strict';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import { IndexerEventCanonicality420 } from '../src/event-canonicality.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const EVENT_A: ProtocolEventDto420 = {
  chainId: '420',
  blockNumber: '90',
  blockHash: '0xaaa',
  transactionHash: '0xtx-a',
  transactionIndex: 1,
  logIndex: 2,
  contractAddress: '0xcontract',
  protocol: '420Pay',
  eventName: 'PaymentSettled',
  objectKey: 'payment:7',
  lifecycleState: 'COMPLETED',
  fields: { paymentId: '7' }
};

const EVENT_B: ProtocolEventDto420 = {
  ...EVENT_A,
  blockHash: '0xbbb',
  transactionHash: '0xtx-b',
  fields: { paymentId: '7', replacement: true }
};

test('finalized event history is immutable', () => {
  const tracker = new IndexerEventCanonicality420();
  const event = indexerEventEnvelope420(EVENT_A);
  tracker.observe(event);

  const finalized = tracker.finalize(event.id);
  assert.equal(finalized.kind, 'finalized');
  assert.equal(finalized.authoritative, false);
  assert.equal(tracker.records.get(event.id)?.state, 'finalized');
  assert.strictEqual(tracker.finalize(event.id), finalized);
  assert.throws(() => tracker.retract(event.id, 'reorg'), /finalized event history is immutable/);
  assert.throws(() => tracker.supersede(event.id, indexerEventEnvelope420(EVENT_B), 'reorg'), /finalized event history is immutable/);
});

test('non-finalized event can be retracted idempotently', () => {
  const tracker = new IndexerEventCanonicality420();
  const event = indexerEventEnvelope420(EVENT_A);
  tracker.observe(event);

  const first = tracker.retract(event.id, 'block removed by reorg');
  const replay = tracker.retract(event.id, 'different wording is ignored after first signal');
  assert.strictEqual(replay, first);
  assert.equal(first.kind, 'retracted');
  assert.equal(first.replacementEventId, null);
  assert.equal(tracker.records.get(event.id)?.state, 'retracted');
  assert.throws(() => tracker.finalize(event.id), /non-canonical event cannot be finalized/);
});

test('supersession links the replaced event to a distinct fork-sensitive replacement', () => {
  const tracker = new IndexerEventCanonicality420();
  const original = indexerEventEnvelope420(EVENT_A);
  const replacement = indexerEventEnvelope420(EVENT_B);
  tracker.observe(original);

  const signal = tracker.supersede(original.id, replacement, 'canonical branch replaced');
  assert.equal(signal.kind, 'superseded');
  assert.equal(signal.eventId, original.id);
  assert.equal(signal.replacementEventId, replacement.id);
  assert.notEqual(original.id, replacement.id);
  assert.equal(tracker.records.get(original.id)?.state, 'superseded');
  assert.equal(tracker.records.get(replacement.id)?.state, 'observed');
  assert.strictEqual(tracker.supersede(original.id, replacement, 'replay'), signal);
});

test('supersession fails closed for cross-chain or conflicting replacements', () => {
  const tracker = new IndexerEventCanonicality420();
  const original = indexerEventEnvelope420(EVENT_A);
  const replacement = indexerEventEnvelope420(EVENT_B);
  tracker.observe(original);

  const otherChain = indexerEventEnvelope420({ ...EVENT_B, chainId: '421' });
  assert.throws(() => tracker.supersede(original.id, otherChain, 'bad'), /same chain/);

  tracker.supersede(original.id, replacement, 'good');
  const conflicting = indexerEventEnvelope420({ ...EVENT_B, blockHash: '0xccc', transactionHash: '0xtx-c' });
  assert.throws(() => tracker.supersede(original.id, conflicting, 'conflict'), /already superseded/);
});

test('canonicality operations fail closed for unknown events and identity collisions', () => {
  const tracker = new IndexerEventCanonicality420();
  assert.throws(() => tracker.finalize('missing'), /record not found/);

  const event = indexerEventEnvelope420(EVENT_A);
  tracker.observe(event);
  const colliding = { ...event, protocol: 'OtherProtocol' };
  assert.throws(() => tracker.observe(colliding), /event identity collision/);
});
