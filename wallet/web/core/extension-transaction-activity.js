import {readWalletTransactionStatus420, normalizeTransactionHash420} from './transaction-lifecycle.js';

const IN_FLIGHT=new Set(['pending','submitted','included','confirming','reorganized']);
const STABLE=new Set(['confirmed','reverted','dropped','replaced','cancelled']);
export function extensionTransactionInFlight420(status){return IN_FLIGHT.has(status);}
export function extensionTransactionStatusLabel420(status){
  if(!IN_FLIGHT.has(status)&&!STABLE.has(status))throw new Error('unknown transaction lifecycle status');
  return status;
}
/**
 * Refresh a broadcast transaction without treating an RPC timeout or absent receipt
 * as failure. Confirmation requires a canonical block and a second matching receipt.
 * Dropped/replaced/cancelled cannot be inferred solely from a missing receipt.
 */
export async function reconcileExtensionTransaction420(entry,{provider,chainId,confirmations=2}={}){
  if(!entry||typeof entry!=='object')throw new Error('transaction activity entry required');
  if(!extensionTransactionInFlight420(entry.status))return entry;
  if(typeof chainId!=='string'||!/^0x[0-9a-fA-F]+$/.test(chainId)||BigInt(chainId)<=0n)
    throw new Error('verified chain required to track activity');
  if(entry.chainId!==chainId)throw new Error('transaction belongs to another chain');
  const hash=normalizeTransactionHash420(entry.hash);
  const result=await readWalletTransactionStatus420(provider,hash,{
    expectedChainId:chainId,canonical:true,confirmations
  });
  const status=result.status==='confirming'?'included':result.status;
  return {
    ...entry,hash,status,confirmations:result.confirmations.toString(),
    blockNumber:result.receipt?.blockNumber||null,
  };
}
