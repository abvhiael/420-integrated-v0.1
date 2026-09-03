import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWalletActivity, summarizeExecutionReview } from '../ui-v1.js';

test('summarizeExecutionReview derives selector, byte length, and simulation status', () => {
  const review = summarizeExecutionReview(
    { target: '0x0000000000000000000000000000000000000420', value: '7', data: '0xa9059cbb00ff' },
    { simulation: { passed: true, gas: '0x5208' } },
  );
  assert.equal(review.selector, '0xa9059cbb');
  assert.equal(review.calldataBytes, 6);
  assert.equal(review.value, '7');
  assert.equal(review.simulationPassed, true);
  assert.equal(review.gas, '0x5208');
});

test('summarizeExecutionReview fails closed for invalid calldata presentation', () => {
  const review = summarizeExecutionReview({ target: '0xabc', value: '', data: '0x123' });
  assert.equal(review.value, '0');
  assert.equal(review.calldataBytes, null);
  assert.equal(review.simulationPassed, false);
});

test('classifyWalletActivity only records security-relevant wallet actions', () => {
  assert.deepEqual(
    classifyWalletActivity('Execution submitted: 0xabc. Waiting for confirmation…'),
    { kind: 'execution', state: 'pending', label: 'Smart Account execution submitted' },
  );
  assert.deepEqual(
    classifyWalletActivity('SmartAccount420 execution confirmed: 0xabc'),
    { kind: 'execution', state: 'confirmed', label: 'Smart Account execution confirmed' },
  );
  assert.equal(classifyWalletActivity('Ready.'), null);
});
