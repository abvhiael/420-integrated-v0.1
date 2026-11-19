import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import test from 'node:test';
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../accounting.js', import.meta.url))],
  bundle: true, format: 'esm', write: false
});
const { accountingCsv, reconcileAccounting } =
  await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const hash = byte => '0x' + byte.repeat(64);
const asset = '0x' + '0'.repeat(40);
const schema = JSON.parse(readFileSync(new URL('../../../contracts/config/pay/accounting-export-schema.json', import.meta.url)));
const record = {
  payment: {
    id: hash('a'), inputAsset: asset, inputAmount: 110n, settlementAsset: asset,
    settlementAmount: 100n, tipAmount: 10n, refundedAmount: 50n, status: 'PARTIALLY_REFUNDED',
    payer: 'private-test-value'
  },
  invoice: { id: hash('b'), amount: 100n, currency: '420', metadataHash: hash('0'), description: 'private-test-value' },
  delivered: 30n, networkFee: 900719925474099312345n
};

test('JSON and CSV use only the frozen fields and reconcile delivered refund separately from authorization', () => {
  const report = reconcileAccounting(record);
  assert.deepEqual(Object.keys(report.row), schema.fields.map(field => field.name));
  assert.equal(report.row.network_fee, '900719925474099312345');
  assert.equal(report.row.refund_total, '30');
  assert.equal(report.authorized, 50n);
  assert.equal(JSON.stringify(report.row).includes('private-test-value'), false);
  assert.equal(accountingCsv([report.row]).split('\r\n')[0], Object.keys(report.row).join(','));
  assert.match(accountingCsv([report.row]), /"900719925474099312345"/);
});

test('unverified fees, tax or refund facts do not become zero-valued exports', () => {
  for (const update of [
    { networkFee: null }, { delivered: null },
    { invoice: { ...record.invoice, metadataHash: hash('c') } },
    { payment: { ...record.payment, inputAsset: '0x' + 'a'.repeat(40) } }
  ]) assert.equal(reconcileAccounting({ ...record, ...update }).row, null);
  assert.throws(() => reconcileAccounting({ ...record, delivered: 111n }), /exceeds/);
});
