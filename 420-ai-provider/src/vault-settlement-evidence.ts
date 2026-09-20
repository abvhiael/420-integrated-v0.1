import { getAddress, keccak256, AbiCoder } from 'ethers';
import type { Hex32 } from './types.js';
import type {
  VaultEvidenceReader420, VaultFundingExpectation420, VaultObligationSnapshot420,
  CanonicalVaultOperation420, VaultEscrowSnapshot420,
} from './vault-reconciliation.js';

const ZERO = `0x${'00'.repeat(32)}`;
const ABI = AbiCoder.defaultAbiCoder();
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const valid = (id: string): boolean => /^0x[\da-fA-F]{64}$/.test(id) && !same(id, ZERO);
const equalAddress = (a: string, b: string): boolean => getAddress(a) === getAddress(b);

/** 6.4.3.1 is READ-ONLY. Reader implementations must authenticate approved contract addresses,
 * successful canonical receipt/log pairs, pinned history and finality independently. Neither a
 * supplied snapshot nor a CLOSED escrow alone establishes a transfer or authorizes settlement. */
export class VaultSettlementEvidence420 {
  constructor(readonly reader: VaultEvidenceReader420) {}

  private async original(e: VaultFundingExpectation420, settlementRef: Hex32): Promise<{
    escrow: VaultEscrowSnapshot420; obligation: VaultObligationSnapshot420;
  }> {
    if (![e.jobId,e.providerId,e.vaultRef,e.fundingRef,e.fundingObligationId,settlementRef].every(valid)
      || e.amount420 <= 0n || !equalAddress(e.payer,e.payer) || !equalAddress(e.beneficiary,e.beneficiary)) {
      throw new Error('invalid settlement identity');
    }
    const [escrow,obligation] = await Promise.all([
      this.reader.escrow(e.jobId), this.reader.obligation(e.fundingObligationId),
    ]);
    if (!same(escrow.jobId,e.jobId) || !same(escrow.providerId,e.providerId)
      || !same(escrow.vaultRef,e.vaultRef) || !same(escrow.fundingRef,e.fundingRef)
      || !same(escrow.settlementRef,settlementRef) || !equalAddress(escrow.payer,e.payer)
      || !equalAddress(escrow.beneficiary,e.beneficiary) || escrow.amount420 !== e.amount420
      || escrow.state !== 'CLOSED') throw new Error('escrow closure is unqualified');
    if (!same(obligation.obligationId,e.fundingObligationId)
      || !same(obligation.vaultRef,e.vaultRef) || !same(obligation.sourceRef,e.fundingRef)
      || !equalAddress(obligation.asset,e.asset) || !equalAddress(obligation.beneficiary,e.beneficiary)
      || obligation.amount420 !== e.amount420) throw new Error('original funding obligation mismatch');
    return { escrow, obligation };
  }

  private async disbursement(operationId: Hex32, obligationId: Hex32, e: VaultFundingExpectation420,
    recipient: string, amount: bigint): Promise<CanonicalVaultOperation420> {
    if (!valid(operationId)) throw new Error('invalid payout operation');
    const payout = await this.reader.payout(operationId);
    if (!payout || !payout.canonical || !payout.withdrawalAndClaimProven || !valid(payout.txHash)
      || !same(payout.operationId,operationId) || !same(payout.obligationId,obligationId)
      || !same(payout.vaultRef,e.vaultRef) || !equalAddress(payout.asset,e.asset)
      || !equalAddress(payout.recipient,recipient) || payout.amount420 !== amount) {
      throw new Error('canonical Vault disbursement is unproven');
    }
    return payout;
  }

  /** Full-amount provider payout: original obligation must actually be CLAIMED. */
  async verifyProviderPaid(e: VaultFundingExpectation420, settlementRef: Hex32,
    operationId: Hex32): Promise<CanonicalVaultOperation420> {
    const {obligation} = await this.original(e,settlementRef);
    if (obligation.state !== 'CLAIMED') throw new Error('provider obligation not claimed');
    return this.disbursement(operationId,e.fundingObligationId,e,e.beneficiary,e.amount420);
  }

  /** Full refund only. A distinct, deterministic payer-beneficiary obligation must be CLAIMED,
   * while the original provider obligation is CANCELLED, never CLAIMABLE or CLAIMED.
   * A future partial-charge protocol requires a separately reviewed evidence shape. */
  async verifyPayerRefund(e: VaultFundingExpectation420, settlementRef: Hex32,
    operationId: Hex32, refundObligationId: Hex32): Promise<CanonicalVaultOperation420> {
    const {obligation: original} = await this.original(e,settlementRef);
    const expectedRefundId = keccak256(ABI.encode(['string','bytes32','bytes32','bytes32'],
      ['420AI_REFUND_OBLIGATION_V1',e.fundingRef,e.jobId,settlementRef]));
    if (original.state !== 'CANCELLED') throw new Error('provider obligation not cancelled');
    if (!valid(refundObligationId) || !same(refundObligationId,expectedRefundId)
      || same(refundObligationId,e.fundingObligationId)) throw new Error('refund obligation identity mismatch');
    const refund = await this.reader.obligation(refundObligationId);
    if (!same(refund.obligationId,refundObligationId) || !same(refund.vaultRef,e.vaultRef)
      || !same(refund.sourceRef,e.fundingRef) || !equalAddress(refund.asset,e.asset)
      || !equalAddress(refund.beneficiary,e.payer) || refund.amount420 !== e.amount420
      || refund.state !== 'CLAIMED') throw new Error('payer refund obligation is unproven');
    return this.disbursement(operationId,refundObligationId,e,e.payer,e.amount420);
  }
}
