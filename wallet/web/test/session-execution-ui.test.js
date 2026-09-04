import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionExecutionReview } from '../session-execution-ui.js';

const address = (digit) => `0x${digit.repeat(40)}`;
const bytes32 = (digit) => `0x${digit.repeat(64)}`;

test('session execution review is idle before transport preparation', () => {
  const review = buildSessionExecutionReview(null);
  assert.equal(review.state, 'idle');
  assert.equal(review.broadcastReady, false);
  assert.equal(review.userOpHash, null);
});

test('session execution review exposes signed simulated EntryPoint transport state', () => {
  const prepared = {
    signer: address('1'),
    target: address('2'),
    selector: '0xa9059cbb',
    spendAmount: 420n,
    scopeHash: bytes32('a'),
    activeGrantId: bytes32('b'),
    nonce: 9n,
    nonceKey: 7n,
    userOpHash: bytes32('c'),
    broadcastReady: true,
    entryPointSimulation: { simulationPassed: true, gas: '0x5208' },
  };
  const review = buildSessionExecutionReview(prepared);
  assert.equal(review.state, 'ready');
  assert.equal(review.stateLabel, 'Signed + simulated');
  assert.equal(review.broadcastReady, true);
  assert.equal(review.signer, prepared.signer);
  assert.equal(review.target, prepared.target);
  assert.equal(review.selector, '0xa9059cbb');
  assert.equal(review.spendAmount, '420');
  assert.equal(review.grantId, prepared.activeGrantId);
  assert.equal(review.scopeHash, prepared.scopeHash);
  assert.equal(review.nonce, '9');
  assert.equal(review.nonceKey, '7');
  assert.equal(review.userOpHash, prepared.userOpHash);
  assert.equal(review.gas, '0x5208');
});

test('review remains blocked if signed transport did not pass simulation', () => {
  const review = buildSessionExecutionReview({
    signer: address('1'),
    target: address('2'),
    spendAmount: 0n,
    nonce: 1n,
    nonceKey: 2n,
    broadcastReady: true,
    entryPointSimulation: { simulationPassed: false, gas: '0x5208' },
  });
  assert.equal(review.broadcastReady, false);
});
