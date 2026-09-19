import { Interface, JsonRpcProvider, getAddress } from 'ethers';
import type { Hex32 } from './types.js';

const deposits = new Interface(['event NativeDeposited(address indexed from,uint256 amount)']);
const nativeEvent = deposits.getEvent('NativeDeposited')!;
const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();

/** Explicitly native-asset only. ERC-20 funding requires a separate allowance and exact-delta path. */
export interface NativeVaultDepositExpectation420 {
  txHash: Hex32;
  payer: string;
  vaultAddress: string;
  amount420: bigint;
}
export interface ConfirmedNativeVaultDeposit420 extends NativeVaultDepositExpectation420 {
  blockNumber: number;
  blockHash: string;
  canonical: true;
}

/** Checks deposit provenance against a confirmation-pinned, independently approved Vault address.
 * This does NOT prove user consent, job attribution, obligation creation, escrow funding or finality
 * against a malicious RPC. None of those claims may be inferred from this return value.
 */
export async function verifyNativeVaultDeposit420(
  rpc: JsonRpcProvider,
  expectation: NativeVaultDepositExpectation420,
  policy: {chainId: bigint; confirmations: number; pinnedBlockNumber: number; pinnedBlockHash: string; approvedVaultAddress: string}
): Promise<ConfirmedNativeVaultDeposit420> {
  if (!HASH.test(expectation.txHash) || /^0x0{64}$/i.test(expectation.txHash)) throw new Error('invalid deposit transaction hash');
  const payer=getAddress(expectation.payer);
  const vault=getAddress(expectation.vaultAddress);
  if (payer===ZERO_ADDRESS || vault===ZERO_ADDRESS || !eq(vault,getAddress(policy.approvedVaultAddress)) || payer===vault) throw new Error('unapproved Vault deposit participants');
  if (expectation.amount420<=0n || policy.chainId<=0n || !Number.isSafeInteger(policy.confirmations) || policy.confirmations<1 || !Number.isSafeInteger(policy.pinnedBlockNumber) || policy.pinnedBlockNumber<0 || !HASH.test(policy.pinnedBlockHash)) throw new Error('invalid native deposit policy');
  const assertPinned=async()=>{
    if ((await rpc.getNetwork()).chainId!==policy.chainId || await rpc.getBlockNumber()<policy.pinnedBlockNumber+policy.confirmations) throw new Error('native deposit chain or confirmation mismatch');
    if (!eq((await rpc.getBlock(policy.pinnedBlockNumber))?.hash??'',policy.pinnedBlockHash)) throw new Error('native deposit pinned block reorganized');
  };
  await assertPinned();
  const [tx,receipt]=await Promise.all([rpc.getTransaction(expectation.txHash),rpc.getTransactionReceipt(expectation.txHash)]);
  if (!tx || !receipt || !eq(tx.hash,expectation.txHash) || !eq(receipt.hash,expectation.txHash) || receipt.status!==1 || !tx.to || !eq(tx.to,vault) || !eq(tx.from,payer) || tx.value!==expectation.amount420 || receipt.blockNumber>policy.pinnedBlockNumber || receipt.blockNumber!==tx.blockNumber || !eq(receipt.blockHash,tx.blockHash??'')) throw new Error('native deposit transaction does not match payer, value, Vault or confirmed receipt');
  const canonical=await rpc.getBlock(receipt.blockNumber);
  if (!eq(canonical?.hash??'',receipt.blockHash)) throw new Error('native deposit receipt reorganized');
  const matches=receipt.logs.filter(log=>eq(log.address,vault) && eq(log.topics[0]??'',nativeEvent.topicHash));
  if (matches.length!==1) throw new Error('native deposit missing unique approved Vault event');
  const parsed=deposits.parseLog(matches[0]);
  if (!parsed || parsed.name!=='NativeDeposited' || !eq(parsed.args.from,payer) || parsed.args.amount!==expectation.amount420) throw new Error('native deposit event disagrees with transaction');
  await assertPinned();
  return {...expectation,payer,vaultAddress:vault,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,canonical:true};
}
