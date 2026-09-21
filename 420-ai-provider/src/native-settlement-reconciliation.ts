import { getAddress } from 'ethers';
import type { Hex32 } from './types.js';

/** Read-only classification. This function MUST NOT authorize a transaction or new decision. */
export type NativeSettlementRoute420 = 'PROVIDER_FULL' | 'PAYER_REFUND' | 'PARTIAL_SPLIT';
export type NativeSettlementVerdict420 = 'FINAL_PAID' | 'RECONCILE';
export interface NativeSettlementObligation420 {
  id: Hex32;
  fundingRef: Hex32;
  vaultRef: Hex32;
  beneficiary: string;
  asset: string;
  amount: bigint;
  state: 'RESERVED' | 'CLAIMABLE' | 'CLAIMED' | 'CANCELLED' | 'NONE';
}
export interface NativeSettlementTransfer420 {
  operationId: Hex32;
  obligationId: Hex32;
  recipient: string;
  amount: bigint;
  txHash: Hex32;
  /** Must be derived from a canonical finalized receipt AND independently checked balance delta. */
  canonicalFinalizedReceipt: boolean;
  nativeBalanceDeltaVerified: boolean;
}
export interface NativeSettlementEvidence420 {
  route: NativeSettlementRoute420;
  chainId: bigint;
  expectedChainId: bigint;
  deploymentCodeHash: Hex32;
  expectedDeploymentCodeHash: Hex32;
  jobId: Hex32;
  fundingRef: Hex32;
  settlementRef: Hex32;
  expectedSettlementRef: Hex32;
  txHash: Hex32;
  /** Reorg-resistant canonical receipt check; unknown or unfinalized is never paid. */
  transaction: 'FINAL_SUCCESS' | 'FINAL_REVERT' | 'PENDING' | 'UNKNOWN';
  escrowState: 'CLOSED' | 'FUNDED' | 'CLAIMABLE' | 'REFUNDABLE' | 'SPLIT_CLAIMABLE' | 'NONE';
  managerState: 'SETTLED' | 'REFUNDED' | 'OTHER';
  payer: string;
  provider: string;
  vaultRef: Hex32;
  total: bigint;
  original: NativeSettlementObligation420;
  replacements: NativeSettlementObligation420[];
  transfers: NativeSettlementTransfer420[];
}
export interface NativeSettlementExpected420 {
  route: NativeSettlementRoute420;
  jobId: Hex32;
  fundingRef: Hex32;
  vaultRef: Hex32;
  settlementRef: Hex32;
  txHash: Hex32;
  payer: string;
  provider: string;
  total: bigint;
  /** Full provider/refund: ignored; split: strictly between zero and total. */
  providerAmount?: bigint;
  originalObligation: Hex32;
  replacementObligations: Hex32[];
  claimOperations: Hex32[];
}
const native = '0x0000000000000000000000000000000000000000';
const validHex = (id: string) => /^0x[\da-fA-F]{64}$/.test(id) && !/^0x0{64}$/i.test(id);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sameAddress = (a: string, b: string) => {
  try { return getAddress(a) === getAddress(b); } catch { return false; }
};

/** Requires caller-supplied expected IDs from independently approved, immutable intent. */
export function reconcileNativeSettlement420(
  expected: NativeSettlementExpected420, evidence: NativeSettlementEvidence420,
): NativeSettlementVerdict420 {
  const ids = [expected.jobId, expected.fundingRef, expected.vaultRef, expected.settlementRef,
    expected.txHash, expected.originalObligation, ...expected.replacementObligations,
    ...expected.claimOperations, evidence.deploymentCodeHash, evidence.expectedDeploymentCodeHash];
  if (ids.some(id => !validHex(id)) || expected.total <= 0n || evidence.total !== expected.total
    || evidence.chainId <= 0n || evidence.chainId !== evidence.expectedChainId
    || !same(evidence.deploymentCodeHash, evidence.expectedDeploymentCodeHash)
    || expected.route !== evidence.route || !same(expected.jobId, evidence.jobId)
    || !same(expected.fundingRef, evidence.fundingRef) || !same(expected.vaultRef, evidence.vaultRef)
    || !same(expected.settlementRef, evidence.settlementRef)
    || !same(evidence.settlementRef, evidence.expectedSettlementRef)
    || !same(expected.txHash, evidence.txHash)
    || !sameAddress(expected.payer, evidence.payer) || !sameAddress(expected.provider, evidence.provider)
    || evidence.transaction !== 'FINAL_SUCCESS' || evidence.escrowState !== 'CLOSED') return 'RECONCILE';

  const original = evidence.original;
  if (!same(original.id, expected.originalObligation) || !same(original.fundingRef, expected.fundingRef)
    || !same(original.vaultRef, expected.vaultRef) || !sameAddress(original.beneficiary, expected.provider)
    || !sameAddress(original.asset, native) || original.amount !== expected.total) return 'RECONCILE';

  const amount = expected.route === 'PARTIAL_SPLIT' ? expected.providerAmount : expected.total;
  if (amount === undefined || amount <= 0n || (expected.route === 'PARTIAL_SPLIT' && amount >= expected.total))
    return 'RECONCILE';
  const recipients = expected.route === 'PAYER_REFUND' ? [expected.payer]
    : expected.route === 'PROVIDER_FULL' ? [expected.provider] : [expected.provider, expected.payer];
  const amounts = expected.route === 'PARTIAL_SPLIT' ? [amount, expected.total - amount] : [expected.total];
  const replacementCount = expected.route === 'PROVIDER_FULL' ? 0 : recipients.length;
  if (expected.replacementObligations.length !== replacementCount || expected.claimOperations.length !== recipients.length
    || evidence.replacements.length !== replacementCount || evidence.transfers.length !== recipients.length
    || new Set([...expected.replacementObligations, ...expected.claimOperations, expected.originalObligation]
      .map(x => x.toLowerCase())).size !== replacementCount + recipients.length + 1
    || original.state !== (expected.route === 'PROVIDER_FULL' ? 'CLAIMED' : 'CANCELLED')
    || evidence.managerState !== (expected.route === 'PAYER_REFUND' ? 'REFUNDED' : 'SETTLED')) return 'RECONCILE';

  for (let i = 0; i < recipients.length; i++) {
    const obligation = expected.route === 'PROVIDER_FULL' ? original : evidence.replacements[i];
    const obligationId = expected.route === 'PROVIDER_FULL' ? expected.originalObligation : expected.replacementObligations[i];
    const transfer = evidence.transfers[i];
    if (!same(obligation.id, obligationId) || !same(obligation.fundingRef, expected.fundingRef)
      || !same(obligation.vaultRef, expected.vaultRef) || !sameAddress(obligation.asset, native)
      || !sameAddress(obligation.beneficiary, recipients[i]) || obligation.amount !== amounts[i]
      || obligation.state !== 'CLAIMED' || !same(transfer.operationId, expected.claimOperations[i])
      || !same(transfer.obligationId, obligationId) || !same(transfer.txHash, expected.txHash)
      || !sameAddress(transfer.recipient, recipients[i]) || transfer.amount !== amounts[i]
      || !transfer.canonicalFinalizedReceipt || !transfer.nativeBalanceDeltaVerified) return 'RECONCILE';
  }
  return 'FINAL_PAID';
}
