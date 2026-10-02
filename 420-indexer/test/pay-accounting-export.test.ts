import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PayAccountingExportService420,
  payAccountingExport420,
  type PayAccountingExport420,
  type PayAccountingExportSource420
} from '../src/pay-accounting-export.js';

const id = (byte: string) => '0x' + byte.repeat(64);

function source(): PayAccountingExportSource420 {
  return {
    paymentId: id('1'),
    invoiceId: id('2'),
    invoiceCurrency: 'CAD',
    invoiceAmount: 1000n,
    inputAsset: '0x0000000000000000000000000000000000000420',
    inputAmount: 1010n,
    settlementAsset: '0x000000000000000000000000000000000000CA42',
    settlementAmount: 1000n,
    swapFee: 5n,
    slippage: 3n,
    networkFee: 2n,
    tip: 20n,
    refundTotal: 100n,
    taxSummaryHash: id('a'),
    finalityStatus: 'SETTLED'
  };
}

test('420Pay accounting export preserves every frozen field exactly once', () => {
  const record = payAccountingExport420(source());
  assert.deepEqual(Object.keys(record), [
    'payment_id',
    'invoice_id',
    'invoice_currency',
    'invoice_amount',
    'input_asset',
    'input_amount',
    'settlement_asset',
    'settlement_amount',
    'swap_fee',
    'slippage',
    'network_fee',
    'tip',
    'refund_total',
    'tax_summary_hash',
    'finality_status'
  ]);
  assert.equal(record.payment_id, id('1'));
  assert.equal(record.invoice_amount, '1000');
  assert.equal(record.refund_total, '100');
  assert.equal(record.finality_status, 'SETTLED');
});

test('420Pay accounting export rejects refund totals above canonical settlement plus tip', () => {
  const record = source();
  record.refundTotal = 1021n;
  assert.throws(() => payAccountingExport420(record), /refund_total exceeds canonical refundable value/);
});

test('420Pay accounting export rejects malformed canonical commitments', () => {
  const record = source();
  record.taxSummaryHash = '0x42';
  assert.throws(() => payAccountingExport420(record), /invalid tax_summary_hash/);
});

test('420Pay accounting exporter is replaceable and receives the canonical DTO', async () => {
  const written: PayAccountingExport420[] = [];
  const service = new PayAccountingExportService420({
    write(record) {
      written.push(record);
    }
  });
  const record = await service.export(source());
  assert.equal(written.length, 1);
  assert.deepEqual(written[0], record);
});
