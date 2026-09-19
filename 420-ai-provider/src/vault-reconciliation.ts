import { getAddress } from 'ethers';
import type { Hex32 } from './types.js';

export type EscrowState420 = 'NONE' | 'FUNDED' | 'CLAIMABLE' | 'REFUNDABLE' | 'CLOSED';
export type ObligationState420 = 'NONE' | 'RESERVED' | 'CLAIMABLE' | 'CLAIMED' | 'CANCELLED';
export interface VaultEscrowSnapshot420 {
  jobId: Hex32;
  payer: string;
  beneficiary: string;
  providerId: Hex32;
  vaultRef: Hex32;
  fundingRef: Hex32;
  settlementRef: Hex32;
  amount420: bigint;
  state: EscrowState420;
}
export interface VaultObligationSnapshot420 {
  obligationId: Hex32;
  vaultRef: Hex32;
  sourceRef: Hex32;
  asset: string;
  beneficiary: string;
  amount420: bigint;
  state: ObligationState420;
}
/** An independently confirmed vault operation, not a self-attested payment flag. */
export interface CanonicalVaultOperation420 {
  operationId: Hex32;
  vaultRef: Hex32;
  obligationId: Hex32;
  asset: string;
  recipient: string;
  amount420: bigint;
  txHash: Hex32;
  /** Must be established by a chain/receipt reader against the configured finality policy. */
  canonical: boolean;
  /** Must be verified from AssetVault420 Withdrawal AND VaultAccounting420 ObligationClaimed logs in the same successful receipt. */
  withdrawalAndClaimProven: boolean;
}
export interface VaultEvidenceReader420 {
  escrow(jobId: Hex32): Promise<VaultEscrowSnapshot420>;
  obligation(obligationId: Hex32): Promise<VaultObligationSnapshot420>;
  payout(operationId: Hex32): Promise<CanonicalVaultOperation420 | null>;
}
export interface VaultFundingExpectation420 {
  jobId: Hex32;
  payer: string;
  beneficiary: string;
  providerId: Hex32;
  vaultRef: Hex32;
  fundingRef: Hex32;
  amount420: bigint;
  /** A distinct obligation created by the Vault after actual deposit; must not be inferred from a transfer alone. */
  fundingObligationId: Hex32;
  asset: string;
}
const ZERO = `0x${'00'.repeat(32)}`;
function sameId(a: string, b: string): boolean { return a.toLowerCase() === b.toLowerCase(); }
function validId(x: string): boolean { return /^0x[\da-fA-F]{64}$/.test(x) && !sameId(x, ZERO); }
function addr(x: string): string { const a = getAddress(x); if (a === '0x0000000000000000000000000000000000000000') throw new Error('zero beneficiary/payer address'); return a; }
function matchAddress(a: string, b: string): boolean { return addr(a) === addr(b); }
function validAmount(n: bigint): boolean { return n > 0n; }

/** Read-only evidence gate. Does not send funds, sign transactions, authorize Vault capabilities or close escrow. */
export class VaultReconciliation420 {
  constructor(readonly reader: VaultEvidenceReader420) {}

  async verifyFunding(e: VaultFundingExpectation420): Promise<VaultEscrowSnapshot420> {
    for (const value of [e.jobId, e.providerId, e.vaultRef, e.fundingRef, e.fundingObligationId]) if (!validId(value)) throw new Error('invalid funding identity');
    if (!validAmount(e.amount420)) throw new Error('invalid funding amount');
    addr(e.payer); addr(e.beneficiary); getAddress(e.asset);
    const [escrow, obligation] = await Promise.all([this.reader.escrow(e.jobId), this.reader.obligation(e.fundingObligationId)]);
    if (!sameId(escrow.jobId,e.jobId) || !sameId(escrow.providerId,e.providerId) || !sameId(escrow.vaultRef,e.vaultRef) || !sameId(escrow.fundingRef,e.fundingRef)
      || !matchAddress(escrow.payer,e.payer) || !matchAddress(escrow.beneficiary,e.beneficiary) || escrow.amount420 !== e.amount420
      || !['FUNDED','CLAIMABLE','REFUNDABLE','CLOSED'].includes(escrow.state)) throw new Error('escrow funding does not match canonical expectation');
    if (!sameId(obligation.obligationId,e.fundingObligationId) || !sameId(obligation.vaultRef,e.vaultRef) || !sameId(obligation.sourceRef,e.fundingRef)
      || !matchAddress(obligation.beneficiary,e.beneficiary) || !matchAddress(obligation.asset,e.asset) || obligation.amount420 !== e.amount420
      || !['RESERVED','CLAIMABLE','CLAIMED'].includes(obligation.state)) throw new Error('Vault obligation does not match funding');
    return escrow;
  }

  /** A CLOSED escrow alone never proves disbursement. Refunds must prove payout to the payer, releases to the bound beneficiary. */
  async verifyPaid(e: VaultFundingExpectation420, settlementRef: Hex32, operationId: Hex32, kind: 'release' | 'refund'): Promise<CanonicalVaultOperation420> {
    if (!validId(settlementRef) || !validId(operationId)) throw new Error('invalid settlement identity');
    const escrow = await this.verifyFunding(e);
    if (escrow.state !== 'CLOSED' || !sameId(escrow.settlementRef,settlementRef)) throw new Error('escrow has not closed against settlement reference');
    const obligation = await this.reader.obligation(e.fundingObligationId);
    if (obligation.state !== 'CLAIMED') throw new Error('Vault obligation has not been claimed');
    const payout = await this.reader.payout(operationId);
    const recipient = kind === 'refund' ? e.payer : e.beneficiary;
    if (!payout || !payout.canonical || !payout.withdrawalAndClaimProven || !validId(payout.txHash) || !sameId(payout.operationId,operationId)
      || !sameId(payout.vaultRef,e.vaultRef) || !sameId(payout.obligationId,e.fundingObligationId)
      || !matchAddress(payout.asset,e.asset) || !matchAddress(payout.recipient,recipient) || payout.amount420 !== e.amount420)
      throw new Error('canonical Vault disbursement is unproven or inconsistent');
    return payout;
  }
}
