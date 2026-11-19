import { payAccountingExport420 } from '../../420-indexer/src/pay-accounting-export.ts';

const zeroHash = '0x' + '0'.repeat(64);
const settled = new Set(['SETTLED', 'REFUNDED', 'PARTIALLY_REFUNDED']);

export function reconcileAccounting({ payment, invoice, delivered, networkFee }) {
  const issues = [];
  if (!settled.has(payment.status)) issues.push('Settlement is unavailable');
  if (networkFee === null) issues.push('Settlement transaction fee is unavailable in this interval');
  if (payment.inputAsset !== payment.settlementAsset) issues.push('Conversion quote economics are unavailable');
  if (invoice.metadataHash !== zeroHash) issues.push('Tax summary commitment is unverified');
  if (delivered === null) issues.push('Refund delivery total is unverified');
  const row = issues.length ? null : payAccountingExport420({
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceCurrency: invoice.currency,
    invoiceAmount: invoice.amount,
    inputAsset: payment.inputAsset,
    inputAmount: payment.inputAmount,
    settlementAsset: payment.settlementAsset,
    settlementAmount: payment.settlementAmount,
    swapFee: 0n,
    slippage: 0n,
    networkFee,
    tip: payment.tipAmount,
    refundTotal: delivered,
    taxSummaryHash: zeroHash,
    finalityStatus: payment.status
  });
  return {
    row, paymentId: payment.id, authorized: payment.refundedAmount, delivered, issues
  };
}

export function accountingCsv(rows) {
  if (!rows.length) throw new Error('No accounting rows are available.');
  const keys = Object.keys(rows[0]);
  const cell = value => '"' + value.replaceAll('"', '""') + '"';
  return keys.join(',') + '\r\n' + rows.map(row => keys.map(key => cell(row[key])).join(',')).join('\r\n') + '\r\n';
}
