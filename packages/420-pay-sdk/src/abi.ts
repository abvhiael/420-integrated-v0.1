// Static view bindings checked against the retained V3 compiler ABI.
function freezeView<T extends { output: readonly (readonly string[])[] }>(view: T): Readonly<T> {
  for (const field of view.output) Object.freeze(field);
  Object.freeze(view.output);
  return Object.freeze(view);
}
export const invoiceView = freezeView({
  contract: 'InvoiceRegistry420',
  component: '420/APP/420PAY/INVOICE_REGISTRY',
  signature: 'getInvoice(bytes32)',
  selector: '0xcb802c8b',
  output: [
    ['merchantId', 'bytes32'],
    ['merchant', 'address'],
    ['metadataHash', 'bytes32'],
    ['currency', 'bytes3'],
    ['amount', 'uint256'],
    ['expiresAt', 'uint64'],
    ['refundUntil', 'uint64'],
    ['mode', 'uint8'],
    ['acceptance', 'uint8'],
    ['partialPayments', 'bool'],
    ['quoteMaxSlippageBps', 'uint16'],
    ['acceptedAssetsHash', 'bytes32'],
    ['settlementPlanHash', 'bytes32'],
    ['tipPolicyHash', 'bytes32'],
    ['active', 'bool'],
  ]
} as const);

export const paymentView = freezeView({
  contract: 'PaymentRegistry420',
  component: '420/APP/420PAY/PAYMENT_REGISTRY',
  signature: 'getPayment(bytes32)',
  selector: '0xe66eefc8',
  output: [
    ['invoiceId', 'bytes32'],
    ['payer', 'address'],
    ['merchant', 'address'],
    ['inputAsset', 'address'],
    ['inputAmount', 'uint256'],
    ['settlementAsset', 'address'],
    ['settlementAmount', 'uint256'],
    ['quoteId', 'bytes32'],
    ['payerNonce', 'uint256'],
    ['receiptHash', 'bytes32'],
    ['tipAmount', 'uint256'],
    ['refundedAmount', 'uint256'],
    ['status', 'uint8'],
  ]
} as const);
