import assert from 'node:assert/strict';
import test from 'node:test';
import { makeReceipt, formatUnits } from '../source.js';
import { createFixtureSource } from '../fixture.js';

test('fixed-point balances preserve precision and suppress insignificant zeros', () => {
  assert.equal(formatUnits(428420000000000000000n, 18), '428.42');
  assert.equal(formatUnits(1n, 18), '0.000000000000000001');
  assert.equal(formatUnits(900719925474099312345678n, 0), '900719925474099312345678');
});

test('receipt evidence is account-scoped and keeps submission and refund semantics', async () => {
  const source = createFixtureSource();
  const { account } = await source.connect();
  const { history } = await source.load(account);
  assert.throws(() => makeReceipt(history.payments[1], account, true), /unavailable/);
  assert.throws(() => makeReceipt(history.payments[0], '0x' + 'a'.repeat(40), true), /unavailable/);
  assert.throws(() => makeReceipt({ ...history.payments[0], receiptHash: '0x' + '0'.repeat(64) }, account, true), /unavailable/);
  const receipt = makeReceipt(history.payments[2], account, true);
  assert.equal(receipt.status, 'PARTIALLY_REFUNDED');
  assert.equal(receipt.authorizedRefundAmount, '1000000000000000000');
  assert.equal(receipt.source, 'fixture');
  assert.equal(Object.hasOwn(receipt, 'payer'), false);
});
