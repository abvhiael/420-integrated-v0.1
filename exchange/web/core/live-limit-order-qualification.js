import {buildLimitOrderTypedData,buildLimitOrderCancelTransaction} from './execution.js';
import {buildLimitOrderFillTransaction,readLimitOrderState} from './limit-order-execution.js';
import {preflightExchangeTransaction,preflightLimitOrderSigning} from './preflight.js';
import {signQualifiedLimitOrder,submitPreflightedTransaction} from './wallet-execution.js';
import {WalletSession,normalizeAccount,normalizeChainId} from './wallet-session.js';
import {inspectTransactionLifecycle} from './transaction-lifecycle.js';

export class LimitOrderQualificationError extends Error{
  constructor(code,message,details={}){super(message);this.name='LimitOrderQualificationError';this.code=code;this.details=details;}
}
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function wallet(provider,chainId,expectedAccount){
  if(!provider?.request) throw new LimitOrderQualificationError('PROVIDER_REQUIRED','EIP-1193 provider required');
  const [accounts,actual]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);
  if(normalizeChainId(actual)!==normalizeChainId(chainId)) throw new LimitOrderQualificationError('CHAIN_MISMATCH','wallet is on a different chain');
  const account=normalizeAccount(accounts?.[0]);
  if(expectedAccount&&account!==normalizeAccount(expectedAccount)) throw new LimitOrderQualificationError('ACCOUNT_MISMATCH','active wallet account changed');
  const session=new WalletSession(); session.connected({account,chainId});return {account,session};
}
async function complete({provider,txHash,attempts=60,pollMs=5000,wait=sleep}){
  if(!Number.isInteger(attempts)||attempts<1||!Number.isInteger(pollMs)||pollMs<0) throw new LimitOrderQualificationError('INVALID_POLICY','invalid polling policy');
  for(let i=0;i<attempts;i++){
    const result=await inspectTransactionLifecycle({provider,txHash,minConfirmations:2});
    if(result.state==='FINALIZED') return result;
    if(['REVERTED','REORGED','DROPPED'].includes(result.state)) throw new LimitOrderQualificationError('TX_FAILED',`transaction ${result.state}`,{txHash,state:result.state});
    if(i+1<attempts) await wait(pollMs);
  }
  throw new LimitOrderQualificationError('FINALITY_TIMEOUT','transaction not finalized',{txHash});
}
async function send({provider,runtime,account,session,transaction,checks={},attempts,pollMs,wait}){
  const preflight=await preflightExchangeTransaction({provider,transaction,runtime,...checks});
  const sent=await submitPreflightedTransaction({provider,session,expectedChainId:runtime.network.chainId,expectedGeneration:session.generation,transaction,preflight});
  const finalized=await complete({provider,txHash:sent.txHash,attempts,pollMs,wait});
  return {txHash:sent.txHash,blockHash:finalized.receipt.blockHash,blockNumber:finalized.receipt.blockNumber.toString(),state:finalized.state};
}
/** Intentionally uses a partially filled order, then cancels the remaining amount. */
export async function qualifyLiveLimitOrder({runtime,makerProvider,fillerProvider,reviewedOrder,execution,fill,nowSeconds=Math.floor(Date.now()/1000),attempts=60,pollMs=5000,wait=sleep}={}){
  if(runtime?.deployment?.environment!=='testnet'||runtime.deployment.status!=='RESOLVED') throw new LimitOrderQualificationError('TESTNET_REQUIRED','resolved testnet deployment required');
  const maker=await wallet(makerProvider,runtime.network.chainId,execution?.maker);
  const filler=await wallet(fillerProvider,runtime.network.chainId,fill?.filler);
  const signingRequest=buildLimitOrderTypedData({runtime,reviewedOrder,execution});
  if(normalizeAccount(signingRequest.account)!==maker.account) throw new LimitOrderQualificationError('MAKER_MISMATCH','signed maker differs from wallet');
  const amount=BigInt(fill?.fillSellAmountRaw??0);
  const total=BigInt(signingRequest.order.sellAmountRaw);
  if(!signingRequest.order.allowPartial||amount<=0n||amount>=total) throw new LimitOrderQualificationError('PARTIAL_FILL_REQUIRED','drill requires a strictly partial permitted fill');
  const qualification=await preflightLimitOrderSigning({provider:makerProvider,runtime,account:maker.account,order:signingRequest.order,nowSeconds});
  const signed=await signQualifiedLimitOrder({provider:makerProvider,session:maker.session,expectedChainId:runtime.network.chainId,expectedGeneration:maker.session.generation,signingRequest,qualification});
  const before=await readLimitOrderState({provider:makerProvider,runtime,order:signed.order});
  if(before.cancelled||before.nonceCancelled||BigInt(before.nonceFloor)>BigInt(signed.order.nonce)||BigInt(before.filledSellAmountRaw)!==0n) throw new LimitOrderQualificationError('ORDER_NOT_FRESH','order is already cancelled, invalidated or filled');
  const fillTx=buildLimitOrderFillTransaction({runtime,filler:filler.account,order:signed.order,fillSellAmountRaw:fill.fillSellAmountRaw,signature:signed.signature,expectedPathHash:fill.expectedPathHash,hops:fill.hops});
  const filled=await send({provider:fillerProvider,runtime,account:filler.account,session:filler.session,transaction:fillTx,checks:fill.preflight??{},attempts,pollMs,wait});
  const afterFill=await readLimitOrderState({provider:makerProvider,runtime,order:signed.order});
  if(afterFill.orderHash!==before.orderHash||BigInt(afterFill.filledSellAmountRaw)!==amount||afterFill.cancelled) throw new LimitOrderQualificationError('FILL_STATE_MISMATCH','canonical settlement storage did not record exact partial fill');
  const cancelTx=buildLimitOrderCancelTransaction({runtime,account:maker.account,signedOrder:signed.order});
  const cancelled=await send({provider:makerProvider,runtime,account:maker.account,session:maker.session,transaction:cancelTx,checks:fill.cancelPreflight??{},attempts,pollMs,wait});
  const afterCancel=await readLimitOrderState({provider:makerProvider,runtime,order:signed.order});
  if(afterCancel.orderHash!==before.orderHash||!afterCancel.cancelled||BigInt(afterCancel.filledSellAmountRaw)!==amount) throw new LimitOrderQualificationError('CANCEL_STATE_MISMATCH','canonical settlement storage did not record cancellation');
  return Object.freeze({qualified:true,environment:'testnet',chainId:runtime.network.chainId,maker:maker.account,filler:filler.account,orderHash:before.orderHash,sellAmountRaw:total.toString(),fillAmountRaw:amount.toString(),remainingCancelledRaw:(total-amount).toString(),fill:filled,cancel:cancelled,finalState:afterCancel});
}
