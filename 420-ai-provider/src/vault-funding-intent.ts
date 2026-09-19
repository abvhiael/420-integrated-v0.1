import { getAddress, verifyTypedData } from 'ethers';
import type { JsonRpcProvider } from 'ethers';
import type { Hex32 } from './types.js';
import { verifyNativeVaultDeposit420, type NativeVaultDepositExpectation420 } from './vault-deposit-evidence.js';
import type { VaultEvidenceReader420 } from './vault-reconciliation.js';

const ID = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ID = `0x${'00'.repeat(32)}`;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
function nonzeroId(value: string): boolean { return ID.test(value) && !same(value, ZERO_ID); }
function checkedAddress(value: string): string {
  const address = getAddress(value);
  if (address === ZERO_ADDRESS) throw new Error('zero funding participant');
  return address;
}

/** An EOA-only, job-scoped signed intent. Contract-wallet/ERC-1271 authorization is NOT supported. */
export interface NativeFundingIntent420 {
  jobId: Hex32;
  providerId: Hex32;
  payer: string;
  beneficiary: string;
  vaultRef: Hex32;
  vaultAddress: string;
  fundingRef: Hex32;
  obligationId: Hex32;
  depositTxHash: Hex32;
  amount420: bigint;
  nonce: Hex32;
  deadline: bigint;
}

export const nativeFundingIntentTypes420 = {
  NativeFundingIntent: [
    { name: 'jobId', type: 'bytes32' },
    { name: 'providerId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'beneficiary', type: 'address' },
    { name: 'vaultRef', type: 'bytes32' },
    { name: 'vaultAddress', type: 'address' },
    { name: 'fundingRef', type: 'bytes32' },
    { name: 'obligationId', type: 'bytes32' },
    { name: 'depositTxHash', type: 'bytes32' },
    { name: 'amount420', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' }
  ]
};

export interface NativeFundingPreflightPolicy420 {
  chainId: bigint;
  confirmations: number;
  pinnedBlockNumber: number;
  pinnedBlockHash: string;
  approvedVaultAddress: string;
  /** Explicitly trusted clock in seconds; do not use a caller-controlled API request timestamp. */
  nowSeconds: bigint;
}

/**
 * Read-only preflight. A signed intent + deposit + RESERVED obligation is not authority to call
 * AIJobEscrow.confirmVaultFunding: the on-chain adapter still needs durable nonce/deposit
 * consumption, governance-scoped capability, independently verified payer authorization,
 * exact per-job collateral reservation and chain finality. This helper never writes to chain.
 */
export async function verifyNativeFundingPreflight420(
  rpc: JsonRpcProvider,
  reader: VaultEvidenceReader420,
  intent: NativeFundingIntent420,
  signature: string,
  policy: NativeFundingPreflightPolicy420
): Promise<{ jobId: Hex32; fundingRef: Hex32; obligationId: Hex32; depositTxHash: Hex32 }> {
  for (const value of [intent.jobId, intent.providerId, intent.vaultRef, intent.fundingRef, intent.obligationId, intent.depositTxHash, intent.nonce]) {
    if (!nonzeroId(value)) throw new Error('invalid funding intent identity');
  }
  const payer = checkedAddress(intent.payer);
  const beneficiary = checkedAddress(intent.beneficiary);
  const vaultAddress = checkedAddress(intent.vaultAddress);
  if (intent.amount420 <= 0n || intent.deadline <= 0n || policy.nowSeconds < 0n || policy.nowSeconds > intent.deadline || policy.chainId <= 0n) throw new Error('invalid or expired funding intent');
  if (!same(vaultAddress, checkedAddress(policy.approvedVaultAddress))) throw new Error('unapproved intent Vault');
  const recovered = verifyTypedData(
    { name: '420AI Native Vault Funding', version: '1', chainId: policy.chainId, verifyingContract: vaultAddress },
    nativeFundingIntentTypes420,
    { ...intent, payer, beneficiary, vaultAddress },
    signature
  );
  if (!same(recovered, payer)) throw new Error('funding intent signer is not payer');
  const deposit: NativeVaultDepositExpectation420 = {
    txHash: intent.depositTxHash, payer, vaultAddress, amount420: intent.amount420
  };
  await verifyNativeVaultDeposit420(rpc, deposit, policy);
  const [escrow, obligation] = await Promise.all([reader.escrow(intent.jobId), reader.obligation(intent.obligationId)]);
  if (!same(escrow.jobId, intent.jobId) || escrow.state !== 'NONE') throw new Error('job escrow already funded or mismatched');
  if (!same(obligation.obligationId, intent.obligationId) || !same(obligation.vaultRef, intent.vaultRef)
    || !same(obligation.sourceRef, intent.fundingRef) || obligation.state !== 'RESERVED'
    || !same(checkedAddress(obligation.asset), ZERO_ADDRESS)
    || !same(checkedAddress(obligation.beneficiary), beneficiary) || obligation.amount420 !== intent.amount420) {
    throw new Error('dedicated native funding obligation does not match intent');
  }
  return { jobId: intent.jobId, fundingRef: intent.fundingRef, obligationId: intent.obligationId, depositTxHash: intent.depositTxHash };
}
