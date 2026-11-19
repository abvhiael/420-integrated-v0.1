import { NATIVE, makeReceipt } from './source.js';

const account = '0x' + '24'.repeat(20);
const peer = '0x' + '42'.repeat(20);
const snapshot = Object.freeze({ chainId: 420n, blockHash: '0x' + '5a'.repeat(32) });
const assets = [{ address: NATIVE, symbol: '420', decimals: 18 }];
const payments = [
  [1, 'SETTLED', peer, 42000000000000000000n, account],
  [2, 'SUBMITTED', account, 12000000000000000000n, peer],
  [3, 'PARTIALLY_REFUNDED', account, 7050000000000000000n, peer]
].map(([index, status, payer, amount, merchant]) => ({
  id: '0x' + String(index).repeat(64), invoiceId: '0x' + String(index + 3).repeat(64),
  status, payer, merchant, snapshot, inputAsset: NATIVE, settlementAsset: NATIVE,
  inputAmount: amount, settlementAmount: amount, tipAmount: 0n,
  refundedAmount: index === 3 ? 1000000000000000000n : 0n,
  receiptHash: '0x' + (index === 2 ? '0' : 'b').repeat(64)
}));

export function createFixtureSource() {
  return {
    assets,
    connect: async () => ({ account, chainId: snapshot.chainId }),
    load: async () => ({
      snapshot, amounts: [428420000000000000000n],
      history: { payments, first: 129n, last: 256n, next: 128n }
    }),
    older: async () => ({ payments: [], first: 0n, last: 128n, next: null }),
    receipt: async (owner, payment) => makeReceipt(payment, owner, true),
    disconnect: async () => {}
  };
}
