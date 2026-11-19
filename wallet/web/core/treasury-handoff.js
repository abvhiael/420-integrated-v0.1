import { prepareSmartAccountExecution, sendSmartAccountExecution } from './execution.js';
import { assertWalletChain420, readWalletTransactionStatus420 } from './transaction-lifecycle.js';
import { normalizeAddress } from './abi.js';

async function connected(provider, controller, chainId) {
  await assertWalletChain420(provider, chainId);
  const accounts = await provider.request('eth_accounts');
  if (!Array.isArray(accounts) || !accounts.some(x=>typeof x==='string'&&x.toLowerCase()===normalizeAddress(controller))) throw new Error('Treasury Wallet controller no longer authorized');
}

export async function prepareTreasuryWalletRelease420(provider, controller, smartAccount, client, disbursementId) {
  const review=await client.prepareRelease(disbursementId,smartAccount.smartAccount);
  await connected(provider,controller,review.chainId);
  const prepared=await prepareSmartAccountExecution(provider,controller,smartAccount,{target:review.target,value:0n,data:review.data,expectedChainId:review.chainId});
  return Object.freeze({...prepared,transaction:Object.freeze(prepared.transaction),review});
}

/** Confirmation is a mandatory user-facing host callback; the provider still requires Wallet approval.
 * No auto-retry or fallback to a raw markExecuted commitment. */
export async function submitTreasuryWalletRelease420(provider, controller, smartAccount, client, disbursementId, confirm) {
  if(typeof confirm!=='function')throw new Error('explicit Treasury confirmation required');
  const first=await prepareTreasuryWalletRelease420(provider,controller,smartAccount,client,disbursementId);
  if(await confirm(first)!==true)throw new Error('Treasury confirmation rejected');
  const fresh=await prepareTreasuryWalletRelease420(provider,controller,smartAccount,client,disbursementId);
  if(first.review.chainId!==fresh.review.chainId||first.target!==fresh.target||first.data!==fresh.data||
     first.review.evidence!==fresh.review.evidence||first.transaction.data!==fresh.transaction.data)throw new Error('Treasury release changed after confirmation');
  await connected(provider,controller,fresh.review.chainId);
  const sent=await sendSmartAccountExecution(provider,controller,smartAccount,{target:fresh.target,value:0n,data:fresh.data,expectedChainId:fresh.review.chainId});
  return Object.freeze({...sent,review:fresh.review});
}

export async function treasuryWalletReceipt420(provider, submitted, options={}) {
  const result=await readWalletTransactionStatus420(provider,submitted.txHash,{...options,canonical:true,expectedChainId:submitted.review.chainId});
  if(result.receipt&&result.status!=='reorganized'&&
    (normalizeAddress(result.receipt.to)!==normalizeAddress(submitted.smartAccount)||normalizeAddress(result.receipt.from)!==normalizeAddress(submitted.controller)))throw new Error('Treasury receipt account binding mismatch');
  return {...result,evidenceModel:submitted.review.evidenceModel,independentTransferVerified:false};
}

/** Treasury actions are not executable Wallet owner calls. They must be reviewed
 * as the exact full Civic proposal commitment using the existing Governance client. */
export async function reviewGovernedTreasuryBatch420(governanceClient, proposalId, preparedActions, abiMetadata={}) {
  const session=await governanceClient.verifySession();
  if(!Array.isArray(preparedActions)||!preparedActions.length||preparedActions.some(x=>x.authority!=='GovernanceTimelock/Civic'||BigInt(x.chainId)!==BigInt(session.chainId)))throw new Error('Treasury governance chain or authority mismatch');
  return governanceClient.reviewActionBatch(proposalId,preparedActions.map(x=>x.action),abiMetadata);
}
