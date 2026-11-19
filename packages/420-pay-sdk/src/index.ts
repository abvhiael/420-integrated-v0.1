import { invoiceView, paymentView } from './abi.js';

export { invoiceView, paymentView } from './abi.js';

export const PAY_SERVICE_ID = '420/service/pay/v1';
export const QUOTE_LIFETIME_SECONDS = 42n;
export const INVOICE_MODES = Object.freeze(['SINGLE_USE', 'MULTI_USE', 'PARTIAL_PAYMENT'] as const);
export const ACCEPTANCE_MODES = Object.freeze(['FAST', 'FINALIZED', 'HIGH_VALUE'] as const);
export const PAYMENT_STATUSES = Object.freeze([
  'NONE', 'SUBMITTED', 'INCLUDED', 'CERTIFIED', 'FINALIZED',
  'SETTLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'
] as const);

export type Hex = `0x${string}`;
export type PayComponent = typeof invoiceView.component | typeof paymentView.component;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type Currency = 'CAD' | 'USD' | '420';

const zeroWord = '0'.repeat(64);
const zeroAddress = `0x${'0'.repeat(40)}`;
const currencyCodes: Readonly<Record<string, Currency>> = Object.freeze({
  '0x434144': 'CAD', '0x555344': 'USD', '0x343230': '420'
});

export interface PaySnapshot {
  readonly chainId: bigint;
  readonly blockHash: Hex;
}

// A Registry-backed adapter supplies the read. It must resolve the component
// at the same canonical block used for the call and verify chain/runtime identity.
export interface PayReadTransport {
  read(input: {
    readonly component: PayComponent;
    readonly snapshot: Readonly<PaySnapshot>;
    readonly calldata: Hex;
  }): Promise<unknown>;
}

type WordType = 'address' | 'bytes32' | 'bytes3' | 'bool' | 'uint8' | 'uint16' | 'uint64' | 'uint256';
type Fields = readonly (readonly [string, WordType])[];
type Decoded<T extends Fields> = {
  readonly [P in T[number] as P[0]]: P[1] extends `uint${number}` ? bigint : P[1] extends 'bool' ? boolean : Hex
};

function identifier(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value) || /^0x0{64}$/i.test(value)) {
    throw new TypeError(`invalid ${label}`);
  }
  return value.toLowerCase() as Hex;
}

function decodeWord(type: WordType, word: string): bigint | boolean | Hex {
  if (type === 'bytes32') return `0x${word}`;
  if (type === 'address' || type === 'bytes3') {
    const address = type === 'address';
    const padding = address ? word.slice(0, 24) : word.slice(6);
    if (/[1-9a-f]/.test(padding)) throw new TypeError(`noncanonical ABI ${type} padding`);
    return `0x${address ? word.slice(24) : word.slice(0, 6)}`;
  }
  const value = BigInt(`0x${word}`);
  if (type === 'bool') {
    if (value > 1n) throw new TypeError('invalid ABI boolean');
    return value === 1n;
  }
  if (value >= 1n << BigInt(type.slice(4))) throw new TypeError(`ABI ${type} overflow`);
  return value;
}

function decode<T extends Fields>(schema: T, raw: unknown): Decoded<T> | null {
  if (typeof raw !== 'string' || raw.length !== 2 + 64 * schema.length || !/^0x[0-9a-f]+$/i.test(raw)) {
    throw new TypeError('invalid Pay ABI response');
  }
  const payload = raw.slice(2).toLowerCase();
  if (payload === zeroWord.repeat(schema.length)) return null;
  return Object.fromEntries(schema.map(([name, type], i) =>
    [name, decodeWord(type, payload.slice(i * 64, (i + 1) * 64))])) as Decoded<T>;
}

function enumAt<T>(values: readonly T[], index: bigint): T {
  const result = values[Number(index)];
  if (result === undefined) throw new TypeError('unknown Pay enum value');
  return result;
}

export type PayInvoice = Omit<Decoded<typeof invoiceView.output>, 'currency' | 'mode' | 'acceptance'> & {
  readonly id: Hex;
  readonly snapshot: Readonly<PaySnapshot>;
  readonly currency: Currency;
  readonly mode: typeof INVOICE_MODES[number];
  readonly acceptance: typeof ACCEPTANCE_MODES[number];
};

export type PayPayment = Omit<Decoded<typeof paymentView.output>, 'status'> & {
  readonly id: Hex;
  readonly snapshot: Readonly<PaySnapshot>;
  readonly status: Exclude<PaymentStatus, 'NONE'>;
};

export interface PayReader {
  invoice(id: Hex): Promise<PayInvoice | null>;
  payment(id: Hex): Promise<PayPayment | null>;
}

export function createPayReader(transport: PayReadTransport, snapshot: PaySnapshot): PayReader {
  if (typeof snapshot.chainId !== 'bigint' || snapshot.chainId <= 0n) throw new TypeError('invalid chain ID');
  const pinned = Object.freeze({ chainId: snapshot.chainId, blockHash: identifier(snapshot.blockHash, 'block hash') });
  async function read<T extends Fields>(
    view: { readonly component: PayComponent; readonly selector: Hex; readonly output: T }, id: Hex
  ): Promise<Decoded<T> | null> {
    const raw = await transport.read({
      component: view.component, snapshot: pinned, calldata: `${view.selector}${id.slice(2)}`
    });
    return decode(view.output, raw);
  }

  return {
    async invoice(value) {
      const id = identifier(value, 'invoice ID');
      const record = await read(invoiceView, id);
      if (record === null) return null;
      const currency = currencyCodes[record.currency];
      const mode = enumAt(INVOICE_MODES, record.mode);
      const acceptance = enumAt(ACCEPTANCE_MODES, record.acceptance);
      if (!currency || record.merchant === zeroAddress || record.amount === 0n || record.expiresAt === 0n ||
          record.refundUntil < record.expiresAt || record.quoteMaxSlippageBps > 42n ||
          /^0x0{64}$/.test(record.acceptedAssetsHash) ||
          (mode === 'SINGLE_USE' && record.partialPayments) || (mode === 'PARTIAL_PAYMENT' && !record.partialPayments)) {
        throw new TypeError('invalid canonical invoice response');
      }
      return Object.freeze({ ...record, id, snapshot: pinned, currency, mode, acceptance });
    },
    async payment(value) {
      const id = identifier(value, 'payment ID');
      const record = await read(paymentView, id);
      if (record === null) return null;
      const status = enumAt(PAYMENT_STATUSES, record.status);
      if (status === 'NONE' || /^0x0{64}$/.test(record.invoiceId)) throw new TypeError('invalid canonical payment response');
      return Object.freeze({ ...record, id, snapshot: pinned, status });
    }
  };
}

export function isPayQuoteFresh(issuedAt: bigint, chainTime: bigint): boolean {
  return typeof issuedAt === 'bigint' && typeof chainTime === 'bigint' &&
    issuedAt >= 0n && issuedAt < 1n << 64n && chainTime >= issuedAt &&
    chainTime - issuedAt <= QUOTE_LIFETIME_SECONDS;
}

/** Private off-chain state. The server derives tenant scope after authentication. */
export interface MerchantDraftScope {
  readonly chainId: bigint;
  readonly merchantId: Hex;
}

export interface MerchantInvoiceDraft {
  readonly draftId: string;
  readonly currency: Currency;
  readonly amount: bigint;
  readonly privateMemo: string;
}

export interface MerchantDraftReader {
  load(scope: MerchantDraftScope, draftId: string): Promise<MerchantInvoiceDraft | null>;
}

/** An authorized HTTP view of canonical payment status. */
export interface PayPaymentSummary {
  readonly paymentId: Hex;
  readonly invoiceId: Hex;
  readonly chainId: string;
  readonly blockHash: Hex;
  readonly status: PayPayment['status'];
}

export function toPayPaymentSummary(payment: PayPayment): PayPaymentSummary {
  return Object.freeze({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    chainId: payment.snapshot.chainId.toString(),
    blockHash: payment.snapshot.blockHash,
    status: payment.status
  });
}

export { createPayRegistry, PAYMENT_ROUTER } from './registry.js';
export type { PayDeployment, PayRegistry, PayRpc } from './registry.js';
export { createPayWallet } from './wallet.js';
export type { PayWalletProvider } from './wallet.js';
export { createPayDeveloperClient, developerCheckout, PAY_API_VERSION } from './developer.js';
