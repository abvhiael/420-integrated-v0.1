import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionExecutionReview, resolveGasQuoteDiscovery420 } from '../session-execution-ui.js';

const address = (digit) => `0x${digit.repeat(40)}`;
const bytes32 = (digit) => `0x${digit.repeat(64)}`;

test('session execution review is idle before transport preparation', () => {
  const review = buildSessionExecutionReview(null);
  assert.equal(review.state, 'idle');
  assert.equal(review.broadcastReady, false);
  assert.equal(review.userOpHash, null);
  assert.equal(review.fundingStatus, 'self-funded');
  assert.equal(review.executionAuthorization, false);
});

test('session execution review exposes signed simulated self-funded EntryPoint transport state', () => {
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
    gasSponsorship: { sponsored: false, fundingMode: 'self-funded', fallbackReason: null, executionAuthorization: false },
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
  assert.equal(review.fundingTitle, 'You pay network gas');
  assert.equal(review.paymaster, null);
  assert.equal(review.executionAuthorization, false);
});

test('session execution review exposes bounded sponsorship details without execution authority', () => {
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
    gasSponsorship: {
      sponsored: true,
      fundingMode: 'paymaster',
      executionAuthorization: false,
      quote: {
        paymaster: address('3'),
        policyId: bytes32('d'),
        maxSponsoredCostWei: '420000',
        validUntil: '2026-09-15T00:00:00.000Z',
      },
    },
    broadcastReady: true,
    entryPointSimulation: { simulationPassed: true, gas: '0x5208' },
  };
  const review = buildSessionExecutionReview(prepared);
  assert.equal(review.fundingStatus, 'sponsored');
  assert.equal(review.fundingTitle, 'Network gas is sponsored');
  assert.equal(review.paymaster, address('3'));
  assert.equal(review.policyId, bytes32('d'));
  assert.equal(review.maxSponsoredCostWei, '420000');
  assert.equal(review.sponsorshipValidUntil, '2026-09-15T00:00:00.000Z');
  assert.equal(review.executionAuthorization, false);
});

test('review remains blocked if signed transport did not pass simulation', () => {
  const review = buildSessionExecutionReview({
    signer: address('1'),
    target: address('2'),
    spendAmount: 0n,
    nonce: 1n,
    nonceKey: 2n,
    gasSponsorship: { sponsored: false, fundingMode: 'self-funded', fallbackReason: null, executionAuthorization: false },
    broadcastReady: true,
    entryPointSimulation: { simulationPassed: false, gas: '0x5208' },
  });
  assert.equal(review.broadcastReady, false);
});

test('replaceable 420Gas quote provider boundary exposes only discoverQuote', async () => {
  assert.equal(resolveGasQuoteDiscovery420(null), null);
  assert.throws(() => resolveGasQuoteDiscovery420({}), /must expose discoverQuote/);
  const calls = [];
  const discover = resolveGasQuoteDiscovery420({ discoverQuote: async (request) => { calls.push(request); return { quoteId: 'q' }; } });
  const result = await discover({ operation: 'bounded' });
  assert.deepEqual(calls, [{ operation: 'bounded' }]);
  assert.deepEqual(result, { quoteId: 'q' });
});
