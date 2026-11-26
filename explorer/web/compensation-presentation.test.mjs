import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompensation420 } from './static/compensation.mjs';

test('renders compensation, splitter credit, and claim using exact integer strings', () => {
  const events = ['DevelopmentCompensationForwarded', 'FounderCompensationDeposited',
    'FounderTokenCompensationCredited', 'FounderCompensationClaimed'].map(eventName => ({
    eventName, transactionHash: '0xtx', blockHash: '0xblock', blockNumber: '7',
    fields: { amount: '9007199254740993001', beneficiary: '<script>' }
  }));
  const html = renderCompensation420({events, confirmations: 3, finality: 'FINALIZED'});
  for (const label of ['Development compensation contribution', 'Native splitter credit',
    'Token splitter credit', 'Founder claim', '9007199254740993001', '0xtx', '0xblock',
    'Indexed confirmations', 'FINALIZED', '&lt;script&gt;']) assert.ok(html.includes(label), label);
  assert.ok(!html.includes('<script>'));
});

test('distinguishes unavailable records from empty canonical activity', () => {
  assert.match(renderCompensation420(null), /records are unavailable/);
  assert.match(renderCompensation420({events: []}), /No compensation activity/);
});
