import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeSplitRetry420, type SplitChainReader420, type SplitIntent420,
  type SplitClaimEvidence420, type SplitObligationEvidence420, type SplitEscrowEvidence420,
  type SplitTxState420 } from '../src/native-split-retry.js';

const id = (digit: string) => `0x${digit.repeat(64)}` as `0x${string}`;
const ZERO = id('0');
const native = '0x0000000000000000000000000000000000000000';
const payer = '0x1111111111111111111111111111111111111111';
const provider = '0x2222222222222222222222222222222222222222';
const intent: SplitIntent420 = {
  jobId: id('1'), fundingRef: id('2'), settlementRef: id('3'), originalObligation: id('4'),
  providerObligation: id('5'), payerObligation: id('6'), providerClaimOperation: id('7'),
  payerClaimOperation: id('8'), vaultRef: id('9'), originalTxHash: id('a'), payer, provider,
  total: 100n, providerAmount: 37n, payerAmount: 63n,
};
function fixture() {
  let tx: SplitTxState420 = 'UNKNOWN';
  const escrow: SplitEscrowEvidence420 = { settlementRef: ZERO, state: 'FUNDED', payer, provider, fundedAmount: 100n };
  const original: SplitObligationEvidence420 = { id: intent.originalObligation, vaultRef: intent.vaultRef,
    fundingRef: intent.fundingRef, beneficiary: provider, asset: native, amount: 100n, state: 'RESERVED' };
  const paidProvider: SplitObligationEvidence420 = { ...original, id: intent.providerObligation, amount: 37n, state: 'NONE' };
  const paidPayer: SplitObligationEvidence420 = { ...original, id: intent.payerObligation,
    beneficiary: payer, amount: 63n, state: 'NONE' };
  let claimProvider: SplitClaimEvidence420 | null = null;
  let claimPayer: SplitClaimEvidence420 | null = null;
  const reader: SplitChainReader420 = {
    async transaction() { return tx; }, async escrow() { return escrow; },
    async obligation(key) { return key === intent.originalObligation ? original
      : key === intent.providerObligation ? paidProvider : paidPayer; },
    async claim(key) { return key === intent.providerClaimOperation ? claimProvider : claimPayer; },
  };
  return { escrow, original, paidProvider, paidPayer, reader,
    gate: new NativeSplitRetry420(reader),
    setTx(value: SplitTxState420) { tx = value; },
    setClaims(providerClaim: SplitClaimEvidence420 | null, payerClaim: SplitClaimEvidence420 | null) {
      claimProvider = providerClaim; claimPayer = payerClaim;
    },
  };
}
const claim = (op: `0x${string}`, obligation: `0x${string}`, recipient: string, amount: bigint): SplitClaimEvidence420 => ({
  operationId: op, obligationId: obligation, txHash: intent.originalTxHash, recipient,
  amount, asset: native, vaultRef: intent.vaultRef, canonical: true, withdrawalAndClaimProven: true,
});
test('unknown, pending, and reverted receipts never authorize a new transfer', async () => {
  const f = fixture();
  for (const state of ['UNKNOWN', 'PENDING', 'FINAL_REVERT'] as const) {
    f.setTx(state);
    assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
  }
});
test('finalized and independently proven absent original permits only the identical transaction', async () => {
  const f = fixture(); f.setTx('ABSENT_FINALIZED');
  assert.deepEqual(await f.gate.assess(intent), { action: 'RETRANSMIT_IDENTICAL', originalTxHash: intent.originalTxHash });
  f.paidProvider.state = 'CLAIMABLE';
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
});
test('complete requires both claimed obligations and both canonical withdrawals in same original tx', async () => {
  const f = fixture(); f.setTx('FINAL_SUCCESS');
  f.escrow.state = 'CLOSED'; f.escrow.settlementRef = intent.settlementRef;
  f.original.state = 'CANCELLED'; f.paidProvider.state = 'CLAIMED'; f.paidPayer.state = 'CLAIMED';
  const providerClaim = claim(intent.providerClaimOperation, intent.providerObligation, provider, 37n);
  const payerClaim = claim(intent.payerClaimOperation, intent.payerObligation, payer, 63n);
  f.setClaims(providerClaim, null);
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
  f.setClaims(providerClaim, payerClaim);
  assert.deepEqual(await f.gate.assess(intent), { action: 'COMPLETE', originalTxHash: intent.originalTxHash });
  payerClaim.txHash = id('b');
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
  payerClaim.txHash = intent.originalTxHash; payerClaim.withdrawalAndClaimProven = false;
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
});
test('ambiguous half-claim, payer substitution, or escrow mismatch is quarantined', async () => {
  const f = fixture(); f.setTx('ABSENT_FINALIZED');
  f.setClaims(claim(intent.providerClaimOperation, intent.providerObligation, provider, 37n), null);
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
  f.setClaims(null, null); f.paidPayer.beneficiary = provider;
  f.setTx('FINAL_SUCCESS'); f.escrow.state = 'CLOSED'; f.escrow.settlementRef = intent.settlementRef;
  f.original.state = 'CANCELLED'; f.paidProvider.state = 'CLAIMED'; f.paidPayer.state = 'CLAIMED';
  f.setClaims(claim(intent.providerClaimOperation, intent.providerObligation, provider, 37n),
    claim(intent.payerClaimOperation, intent.payerObligation, payer, 63n));
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
});
test('reader outages and malformed split amounts fail closed', async () => {
  const f = fixture();
  f.reader.transaction = async () => { throw new Error('RPC timeout'); };
  assert.equal((await f.gate.assess(intent)).action, 'RECONCILE');
  await assert.rejects(f.gate.assess({ ...intent, payerAmount: 62n }), /invalid split intent/);
});
