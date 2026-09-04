import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBatchExecutionReview, moveBatchCall } from '../batch-execution-ui.js';

const a = { target: '0x1111111111111111111111111111111111111111', value: '4', data: '0x1234' };
const b = { target: '0x2222222222222222222222222222222222222222', value: '20', data: '0xaabbcc' };
const c = { target: '0x3333333333333333333333333333333333333333', value: '0', data: '0x' };

test('batch review summarizes unsimulated composition without claiming readiness', () => {
  const review = buildBatchExecutionReview(null, [a, b]);
  assert.equal(review.state, 'idle');
  assert.equal(review.stateLabel, 'Not simulated');
  assert.equal(review.callCount, 2);
  assert.equal(review.totalValue, '24');
  assert.equal(review.totalCalldataBytes, 5);
  assert.equal(review.ready, false);
});

test('batch review exposes qualified simulation totals and gas', () => {
  const review = buildBatchExecutionReview({
    calls: [a, b],
    totalValue: 24n,
    totalCalldataBytes: 5,
    smartAccount: '0x4444444444444444444444444444444444444444',
    simulation: { passed: true, gas: '0x12345' },
  });
  assert.equal(review.state, 'ready');
  assert.equal(review.stateLabel, 'Simulation passed');
  assert.equal(review.callCount, 2);
  assert.equal(review.totalValue, '24');
  assert.equal(review.totalCalldataBytes, 5);
  assert.equal(review.gas, '0x12345');
  assert.equal(review.ready, true);
});

test('batch calls can be reordered deterministically without mutating the source list', () => {
  const original = [a, b, c];
  const moved = moveBatchCall(original, 2, 0);
  assert.deepEqual(moved, [c, a, b]);
  assert.deepEqual(original, [a, b, c]);
});

test('batch call reordering fails closed on invalid indexes', () => {
  assert.throws(() => moveBatchCall([a, b], -1, 0), /out of range/i);
  assert.throws(() => moveBatchCall([a, b], 0, 2), /out of range/i);
  assert.throws(() => moveBatchCall(null, 0, 0), /calls array required/i);
});
