import { getAddress } from 'ethers';
import type { Hex32 } from './types.js';

/** This module is read-only: it never signs, sends, replaces, or retries a transaction. */
export type SplitTxState420 = 'PENDING' | 'FINAL_SUCCESS' | 'FINAL_REVERT' | 'ABSENT_FINALIZED' | 'UNKNOWN';
export interface SplitIntent420 {
  jobId: Hex32;
  fundingRef: Hex32;
  settlementRef: Hex32;
  originalObligation: Hex32;
  providerObligation: Hex32;
  payerObligation: Hex32;
  providerClaimOperation: Hex32;
  payerClaimOperation: Hex32;
  payer: string;
  provider: string;
  vaultRef: Hex32;
  total: bigint;
  providerAmount: bigint;
  payerAmount: bigint;
  /** Hash of the exact originally signed transaction; never regenerate it with a new decisionRef. */
  originalTxHash: Hex32;
}
export interface SplitObligationEvidence420 {
  id: Hex32;
  vaultRef: Hex32;
  fundingRef: Hex32;
  beneficiary: string;
  asset: string;
  amount: bigint;
  state: 'NONE' | 'RESERVED' | 'CLAIMABLE' | 'CLAIMED' | 'CANCELLED';
}
export interface SplitClaimEvidence420 {
  operationId: Hex32;
  obligationId: Hex32;
  txHash: Hex32;
  recipient: string;
  amount: bigint;
  asset: string;
  vaultRef: Hex32;
  canonical: boolean;
  withdrawalAndClaimProven: boolean;
}
export interface SplitEscrowEvidence420 {
  settlementRef: Hex32;
  state: 'NONE' | 'FUNDED' | 'CLAIMABLE' | 'REFUNDABLE' | 'CLOSED' | 'SPLIT_CLAIMABLE';
  payer: string;
  provider: string;
  fundedAmount: bigint;
}
export interface SplitChainReader420 {
  /** ABSENT_FINALIZED requires independent canonical finality AND replacement/nonce clearance. */
  transaction(txHash: Hex32): Promise<SplitTxState420>;
  escrow(jobId: Hex32): Promise<SplitEscrowEvidence420>;
  obligation(id: Hex32): Promise<SplitObligationEvidence420>;
  claim(operationId: Hex32): Promise<SplitClaimEvidence420 | null>;
}
export type SplitRetryDecision420 =
  | { action: 'COMPLETE'; originalTxHash: Hex32 }
  | { action: 'RECONCILE'; reason: string }
  | { action: 'RETRANSMIT_IDENTICAL'; originalTxHash: Hex32 };

const ZERO = `0x${'00'.repeat(32)}`;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const valid = (x: string) => /^0x[\da-fA-F]{64}$/.test(x) && !same(x, ZERO);
const address = (x: string) => getAddress(x);

/** A timeout, missing RPC response, or a single claimed leg NEVER authorizes another payment. */
export class NativeSplitRetry420 {
  constructor(readonly reader: SplitChainReader420) {}

  async assess(intent: SplitIntent420): Promise<SplitRetryDecision420> {
    const ids = [intent.jobId, intent.fundingRef, intent.settlementRef, intent.originalObligation,
      intent.providerObligation, intent.payerObligation, intent.providerClaimOperation,
      intent.payerClaimOperation, intent.vaultRef, intent.originalTxHash];
    if (ids.some(id => !valid(id)) || new Set(ids.map(id => id.toLowerCase())).size !== ids.length
      || intent.total < 2n || intent.providerAmount <= 0n || intent.payerAmount <= 0n
      || intent.providerAmount + intent.payerAmount !== intent.total
      || same(address(intent.payer), address(intent.provider))) throw new Error('invalid split intent');

    let tx: SplitTxState420;
    let escrow: SplitEscrowEvidence420;
    let original: SplitObligationEvidence420;
    let provider: SplitObligationEvidence420;
    let payer: SplitObligationEvidence420;
    let providerClaim: SplitClaimEvidence420 | null;
    let payerClaim: SplitClaimEvidence420 | null;
    try {
      [tx, escrow, original, provider, payer, providerClaim, payerClaim] = await Promise.all([
        this.reader.transaction(intent.originalTxHash), this.reader.escrow(intent.jobId),
        this.reader.obligation(intent.originalObligation), this.reader.obligation(intent.providerObligation),
        this.reader.obligation(intent.payerObligation), this.reader.claim(intent.providerClaimOperation),
        this.reader.claim(intent.payerClaimOperation),
      ]);
    } catch {
      return { action: 'RECONCILE', reason: 'unavailable or inconsistent canonical reader' };
    }
    if (!same(escrow.payer, intent.payer) || !same(escrow.provider, intent.provider)
      || escrow.fundedAmount !== intent.total) return { action: 'RECONCILE', reason: 'escrow identity differs' };

    const obligationMatches = (o: SplitObligationEvidence420, id: Hex32, to: string, amount: bigint) =>
      same(o.id, id) && same(o.vaultRef, intent.vaultRef) && same(o.fundingRef, intent.fundingRef)
      && same(o.beneficiary, to) && same(o.asset, '0x0000000000000000000000000000000000000000')
      && o.amount === amount;
    const claimMatches = (c: SplitClaimEvidence420 | null, op: Hex32, id: Hex32, to: string, amount: bigint) =>
      !!c && c.canonical && c.withdrawalAndClaimProven && same(c.operationId, op)
      && same(c.obligationId, id) && same(c.txHash, intent.originalTxHash)
      && same(c.recipient, to) && same(c.asset, '0x0000000000000000000000000000000000000000')
      && same(c.vaultRef, intent.vaultRef) && c.amount === amount;

    if (tx === 'FINAL_SUCCESS' && escrow.state === 'CLOSED'
      && same(escrow.settlementRef, intent.settlementRef)
      && original.state === 'CANCELLED'
      && obligationMatches(provider, intent.providerObligation, intent.provider, intent.providerAmount)
      && obligationMatches(payer, intent.payerObligation, intent.payer, intent.payerAmount)
      && provider.state === 'CLAIMED' && payer.state === 'CLAIMED'
      && claimMatches(providerClaim, intent.providerClaimOperation, intent.providerObligation,
        intent.provider, intent.providerAmount)
      && claimMatches(payerClaim, intent.payerClaimOperation, intent.payerObligation,
        intent.payer, intent.payerAmount)) return { action: 'COMPLETE', originalTxHash: intent.originalTxHash };

    // Any half-paid, pending, reverted, replaced, unknown, or mismatched observation requires
    // manual reconciliation. We never invent a new decision/operation ID to retry.
    if (tx !== 'ABSENT_FINALIZED') return { action: 'RECONCILE', reason: 'transaction not proven absent or dual-claim finality incomplete' };
    if (escrow.state !== 'FUNDED' || !same(escrow.settlementRef, ZERO)
      || original.state !== 'RESERVED' || !obligationMatches(original, intent.originalObligation,
        intent.provider, intent.total) || provider.state !== 'NONE' || payer.state !== 'NONE'
      || providerClaim !== null || payerClaim !== null)
      return { action: 'RECONCILE', reason: 'original escrow/obligation or split-leg evidence is not pristine' };
    return { action: 'RETRANSMIT_IDENTICAL', originalTxHash: intent.originalTxHash };
  }
}
