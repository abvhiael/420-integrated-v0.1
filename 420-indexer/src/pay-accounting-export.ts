export interface PayAccountingExport420 {
  payment_id: string;
  invoice_id: string;
  invoice_currency: string;
  invoice_amount: string;
  input_asset: string;
  input_amount: string;
  settlement_asset: string;
  settlement_amount: string;
  swap_fee: string;
  slippage: string;
  network_fee: string;
  tip: string;
  refund_total: string;
  tax_summary_hash: string;
  finality_status: string;
}

export interface PayAccountingExportSource420 {
  paymentId: string;
  invoiceId: string;
  invoiceCurrency: string;
  invoiceAmount: bigint | string;
  inputAsset: string;
  inputAmount: bigint | string;
  settlementAsset: string;
  settlementAmount: bigint | string;
  swapFee: bigint | string;
  slippage: bigint | string;
  networkFee: bigint | string;
  tip: bigint | string;
  refundTotal: bigint | string;
  taxSummaryHash: string;
  finalityStatus: string;
}

export interface PayAccountingExportSink420 {
  write(record: PayAccountingExport420): Promise<void> | void;
}

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const UINT_RE = /^\d+$/;

function required(value: string, field: string): string {
  if (value.length === 0) throw new Error(`invalid ${field}`);
  return value;
}

function bytes32(value: string, field: string): string {
  if (!BYTES32_RE.test(value)) throw new Error(`invalid ${field}`);
  return value.toLowerCase();
}

function uintString(value: bigint | string, field: string): string {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error(`invalid ${field}`);
    return value.toString();
  }
  if (!UINT_RE.test(value)) throw new Error(`invalid ${field}`);
  return BigInt(value).toString();
}

export function payAccountingExport420(source: PayAccountingExportSource420): PayAccountingExport420 {
  const settlementAmount = uintString(source.settlementAmount, 'settlement_amount');
  const tip = uintString(source.tip, 'tip');
  const refundTotal = uintString(source.refundTotal, 'refund_total');
  if (BigInt(refundTotal) > BigInt(settlementAmount) + BigInt(tip)) {
    throw new Error('refund_total exceeds canonical refundable value');
  }

  return {
    payment_id: bytes32(source.paymentId, 'payment_id'),
    invoice_id: bytes32(source.invoiceId, 'invoice_id'),
    invoice_currency: required(source.invoiceCurrency, 'invoice_currency'),
    invoice_amount: uintString(source.invoiceAmount, 'invoice_amount'),
    input_asset: required(source.inputAsset, 'input_asset'),
    input_amount: uintString(source.inputAmount, 'input_amount'),
    settlement_asset: required(source.settlementAsset, 'settlement_asset'),
    settlement_amount: settlementAmount,
    swap_fee: uintString(source.swapFee, 'swap_fee'),
    slippage: uintString(source.slippage, 'slippage'),
    network_fee: uintString(source.networkFee, 'network_fee'),
    tip,
    refund_total: refundTotal,
    tax_summary_hash: bytes32(source.taxSummaryHash, 'tax_summary_hash'),
    finality_status: required(source.finalityStatus, 'finality_status')
  };
}

export class PayAccountingExportService420 {
  constructor(readonly sink: PayAccountingExportSink420) {}

  async export(source: PayAccountingExportSource420): Promise<PayAccountingExport420> {
    const record = payAccountingExport420(source);
    await this.sink.write(record);
    return record;
  }
}
