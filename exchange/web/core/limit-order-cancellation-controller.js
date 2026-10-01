import {addressWord,functionSelector,uintWord} from './abi.js';
import {buildLimitOrderCancelTransaction} from './execution.js';
import {hashLimitOrder} from './limit-order-identity.js';
import {readLimitOrderState} from './limit-order-execution.js';
import {preflightExchangeTransaction,transactionFingerprint} from './preflight.js';
import {inspectAndReconcileTransaction} from './transaction-lifecycle.js';
import {submitPreflightedTransaction,DEFAULT_SUBMISSION_GATE} from './wallet-execution.js';
import {withdrawPublishedLimitOrder,fetchLimitOrderStatus,DEFAULT_ORDER_WITHDRAWAL_GATE} from './order-publication-client.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export const CANCELLATION_STATES=Object.freeze([
  'IDLE','REVIEW_READY','AWAITING_CONFIRMATION','WITHDRAWN_OFFCHAIN','PREFLIGHTED',
  'SUBMITTED','PENDING','CONFIRMED','REJECTED','REVERTED','REPLACED','DROPPED','REORGED',
  'INDEXER_DELAYED','INDEXER_CONFLICTING','INVALIDATED',
]);

export class LimitOrderCancellationError extends Error{
  constructor(code,message,details={}){super(message);this.name='LimitOrderCancellationError';this.code=code;this.details=Object.freeze({...details});}
}
const fail=(code,message,details={})=>{throw new LimitOrderCancellationError(code,message,details);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const terminal=new Set(['WITHDRAWN_OFFCHAIN','CONFIRMED','REJECTED','REVERTED','REPLACED','DROPPED','REORGED','INDEXER_DELAYED','INDEXER_CONFLICTING']);

function encodeCancelNonce(nonce){
  return functionSelector('cancelNonce(uint256)')+uintWord(nonce);
}
export function buildLimitOrderNonceCancelTransaction({runtime,account,order}={}){
  if(runtime?.deployment?.status!=='RESOLVED')fail('DEPLOYMENT_UNRESOLVED','resolved Exchange deployment required');
  const maker=normalizeAccount(order?.maker);
  if(normalizeAccount(account)!==maker)fail('MAKER_MISMATCH','only the maker may cancel the nonce');
  const to=runtime.contracts?.ExchangeLimitOrderSettlement420;
  try{addressWord(to);}catch{fail('SETTLEMENT_INVALID','valid limit-order settlement required');}
  return Object.freeze({
    kind:'ORDER_CANCEL',
    chainId:normalizeChainId(runtime.network.chainId),
    request:Object.freeze({from:maker,to,data:encodeCancelNonce(order.nonce),value:'0x0'}),
  });
}
export function buildCancellationTransaction({runtime,account,order,mode}={}){
  if(mode==='HASH')return buildLimitOrderCancelTransaction({runtime,account,signedOrder:order});
  if(mode==='NONCE')return buildLimitOrderNonceCancelTransaction({runtime,account,order});
  fail('CANCELLATION_MODE_INVALID','on-chain cancellation mode must be HASH or NONCE');
}

function remaining(order,state){
  const total=BigInt(order.sellAmountRaw),filled=BigInt(state.filledSellAmountRaw);
  if(filled<0n||filled>total)fail('STATE_CONFLICT','canonical filled amount is out of range');
  return (total-filled).toString();
}
function assertChainState({orderHash,order,state,expectedRemaining=null}){
  if(!state||state.orderHash!==orderHash)fail('ORDER_HASH_MISMATCH','settlement order hash differs from reviewed order');
  if(state.cancelled||state.nonceCancelled||BigInt(state.nonceFloor)>BigInt(order.nonce))fail('DUPLICATE_CANCEL','order is already cancelled or nonce-invalid');
  if(state.boundHash&&state.boundHash!=='0x'+'00'.repeat(32)&&state.boundHash!==orderHash)fail('NONCE_BOUND_TO_OTHER_ORDER','maker nonce is bound to a different order hash');
  const rem=remaining(order,state);
  if(BigInt(rem)<=0n)fail('ORDER_FILLED','order has no remaining amount to cancel');
  if(expectedRemaining!==null&&rem!==expectedRemaining)fail('RACING_FILL','remaining amount changed after cancellation review',{expectedRemaining,actualRemaining:rem});
  return rem;
}
function mapLifecycle(result){
  const rpc=result?.rpc,indexed=result?.indexed;
  if(!rpc?.state)fail('LIFECYCLE_INVALID','cancellation lifecycle missing RPC state');
  if(indexed?.conflicts?.length)return 'INDEXER_CONFLICTING';
  if(rpc.state==='DROPPED'&&indexed?.replacementRecordIds?.length)return 'REPLACED';
  if(['REVERTED','REORGED','DROPPED'].includes(rpc.state))return rpc.state;
  if(['PENDING','INCLUDED'].includes(rpc.state))return 'PENDING';
  if(['CONFIRMED','SAFE','FINALIZED'].includes(rpc.state)){
    if(indexed&&indexed.records?.length===0)return 'INDEXER_DELAYED';
    return 'CONFIRMED';
  }
  return 'PENDING';
}

export class LimitOrderCancellationController{
  constructor({
    controller,
    readState=readLimitOrderState,
    status=fetchLimitOrderStatus,
    withdraw=withdrawPublishedLimitOrder,
    lifecycleInspector=inspectAndReconcileTransaction,
    submissionGate=DEFAULT_SUBMISSION_GATE,
    withdrawalGate=DEFAULT_ORDER_WITHDRAWAL_GATE,
    nowSeconds=()=>Math.floor(Date.now()/1000),
  }={}){
    if(!controller||typeof controller.captureExecutionContext!=='function'||typeof controller.subscribeInvalidation!=='function')fail('CONTROLLER_REQUIRED','browser execution controller required');
    if(typeof readState!=='function'||typeof status!=='function'||typeof withdraw!=='function'||typeof lifecycleInspector!=='function'||typeof nowSeconds!=='function')fail('CONFIG_REQUIRED','cancellation adapters required');
    this.controller=controller;this.readState=readState;this.statusAdapter=status;this.withdrawAdapter=withdraw;this.lifecycleInspector=lifecycleInspector;
    this.submissionGate=submissionGate;this.withdrawalGate=withdrawalGate;this.nowSeconds=nowSeconds;
    this.state='IDLE';this.context=null;this.record=null;this.review=null;this.transaction=null;this.preflight=null;this.submission=null;this.invalidatedReason=null;this.history=[];
    this.unsubscribe=controller.subscribeInvalidation(reason=>{if(!terminal.has(this.state))this.invalidate(reason);});
  }
  transition(state,details={}){if(!CANCELLATION_STATES.includes(state))fail('STATE_INVALID','invalid cancellation state');this.state=state;this.history.push(Object.freeze({state,...details}));return this.snapshot();}
  snapshot(){return Object.freeze({state:this.state,review:this.review,txHash:this.submission?.txHash??null,invalidatedReason:this.invalidatedReason,history:Object.freeze([...this.history])});}
  invalidate(reason='execution-context-changed'){this.invalidatedReason=String(reason);this.transaction=null;this.preflight=null;return this.transition('INVALIDATED',{reason:this.invalidatedReason});}
  assertState(...states){if(this.state==='INVALIDATED')fail('CANCELLATION_INVALIDATED','cancellation review invalidated');if(!states.includes(this.state))fail('STATE_MISMATCH',`cancellation state ${this.state} invalid for operation`);}
  assertContext(){try{return this.controller.assertExecutionContext(this.context);}catch{this.invalidate('STALE_SESSION');fail('STALE_MAKER_STATE','wallet/session changed since cancellation review');}}
  async prepare({record,mode='HASH'}={}){
    this.assertState('IDLE','INVALIDATED');
    const context=this.controller.captureExecutionContext();
    if(!record||record.schema!=='420-exchange-order-status-v1')fail('ORDER_STATUS_REQUIRED','qualified PRE-07 order status required');
    const order=record.order,orderHash=hashLimitOrder(order);
    if(orderHash!==record.orderHash)fail('ORDER_HASH_MISMATCH','service order hash differs from canonical order');
    if(normalizeAccount(order.maker)!==context.account)fail('MAKER_MISMATCH','connected wallet is not the order maker');
    if(normalizeChainId(context.chainId)!==normalizeChainId(this.controller.runtime.network.chainId))fail('CHAIN_MISMATCH','wallet is on wrong chain');
    if(['filled','cancelled','expired','rejected'].includes(record.state))fail('ORDER_NOT_CANCELLABLE',`order state ${record.state} is not cancellable`);
    const live=await this.controller.assertLiveSession();
    const chainState=await this.readState({provider:live.wallet.provider,runtime:this.controller.runtime,order});
    const remainingRaw=assertChainState({orderHash,order,state:chainState});
    this.context=context;this.record=record;
    this.review=Object.freeze({
      schema:'420-exchange-order-cancellation-review-v1',mode,orderHash,nonce:String(order.nonce),account:context.account,chainId:context.chainId,
      remainingSellAmountRaw:remainingRaw,serviceRevision:record.revision,preparedAt:this.nowSeconds(),
    });
    this.transaction=buildCancellationTransaction({runtime:this.controller.runtime,account:context.account,order,mode});
    this.preflight=null;this.submission=null;this.invalidatedReason=null;
    return this.transition('REVIEW_READY');
  }
  beginConfirmation(){
    this.assertState('REVIEW_READY');this.assertContext();return this.transition('AWAITING_CONFIRMATION');
  }
  confirm({orderHash,nonce,account,chainId,remainingSellAmountRaw}={}){
    this.assertState('AWAITING_CONFIRMATION');this.assertContext();
    const r=this.review;
    if(orderHash!==r.orderHash||String(nonce)!==r.nonce||!same(account,r.account)||normalizeChainId(chainId)!==normalizeChainId(r.chainId)||String(remainingSellAmountRaw)!==r.remainingSellAmountRaw)fail('CONFIRMATION_MISMATCH','cancellation confirmation differs from exact reviewed order/nonce/account/chain/remaining amount');
    return this.transition('PREFLIGHTED',{confirmed:true});
  }
  async withdrawOffchain({requestId,fetchImpl,signal}={}){
    this.assertState('PREFLIGHTED');this.assertContext();
    if(this.controller.runtime?.execution?.orderWithdrawal!=='DISABLED_PRETESTNET')fail('RUNTIME_POLICY_INVALID','pre-testnet runtime must keep off-chain withdrawal disabled');
    const latest=await this.statusAdapter({runtime:this.controller.runtime,orderHash:this.review.orderHash,fetchImpl,signal});
    if(latest.revision!==this.record.revision||latest.state!==this.record.state)fail('STALE_ORDER_STATE','off-chain order state changed after review');
    const result=await this.withdrawAdapter({
      runtime:this.controller.runtime,orderHash:this.review.orderHash,maker:this.review.account,nonce:this.review.nonce,requestId,
      fetchImpl,signal,withdrawalGate:this.withdrawalGate,
    });
    if(result.order.state!=='cancelled'||result.order.cancellation?.mode!=='OFFCHAIN_WITHDRAWAL')fail('WITHDRAWAL_NOT_CONFIRMED','service did not confirm off-chain withdrawal');
    this.record=result.order;return this.transition('WITHDRAWN_OFFCHAIN',{idempotent:result.idempotent});
  }
  async preflightOnchain(){
    this.assertState('PREFLIGHTED');this.assertContext();
    if(this.controller.runtime?.execution?.orderCancellation!=='DISABLED_PRETESTNET')fail('RUNTIME_POLICY_INVALID','pre-testnet runtime must keep on-chain cancellation disabled');
    const live=await this.controller.assertLiveSession();
    const latestRecord=await this.statusAdapter({runtime:this.controller.runtime,orderHash:this.review.orderHash});
    if(['filled','cancelled','expired','rejected'].includes(latestRecord.state))fail('STALE_ORDER_STATE',`order service state advanced to ${latestRecord.state}`);
    const chainState=await this.readState({provider:live.wallet.provider,runtime:this.controller.runtime,order:this.record.order});
    assertChainState({orderHash:this.review.orderHash,order:this.record.order,state:chainState,expectedRemaining:this.review.remainingSellAmountRaw});
    const pf=await preflightExchangeTransaction({provider:live.wallet.provider,runtime:this.controller.runtime,transaction:this.transaction});
    if(pf.transactionFingerprint!==transactionFingerprint(this.transaction))fail('FINGERPRINT_CHANGED','cancellation transaction fingerprint changed');
    this.preflight=pf;return pf;
  }
  async submitOnchain(){
    this.assertState('PREFLIGHTED');this.assertContext();
    const live=await this.controller.assertLiveSession();
    const latestRecord=await this.statusAdapter({runtime:this.controller.runtime,orderHash:this.review.orderHash});
    if(['filled','cancelled','expired','rejected'].includes(latestRecord.state))fail('STALE_ORDER_STATE',`order service state advanced to ${latestRecord.state}`);
    const chainState=await this.readState({provider:live.wallet.provider,runtime:this.controller.runtime,order:this.record.order});
    assertChainState({orderHash:this.review.orderHash,order:this.record.order,state:chainState,expectedRemaining:this.review.remainingSellAmountRaw});
    const fresh=await preflightExchangeTransaction({provider:live.wallet.provider,runtime:this.controller.runtime,transaction:this.transaction});
    this.preflight=fresh;
    try{
      this.submission=await submitPreflightedTransaction({
        provider:live.wallet.provider,session:live.session,expectedChainId:this.context.chainId,expectedGeneration:this.context.walletGeneration,
        transaction:this.transaction,preflight:fresh,submissionGate:this.submissionGate,
      });
    }catch(error){
      if(error?.code==='USER_REJECTED'){this.transition('REJECTED',{reason:'wallet-rejected'});}
      throw error;
    }
    this.transition('SUBMITTED',{txHash:this.submission.txHash});
    return this.submission;
  }
  async observeLifecycle({exchangeClient=null,minConfirmations=1}={}){
    this.assertState('SUBMITTED','PENDING','CONFIRMED','REJECTED','REVERTED','REPLACED','DROPPED','REORGED','INDEXER_DELAYED','INDEXER_CONFLICTING');
    const result=await this.lifecycleInspector({provider:this.controller.wallet?.provider,exchangeClient,txHash:this.submission.txHash,minConfirmations,kinds:['CANCELLATION','ORDER']});
    const next=mapLifecycle(result);this.transition(next,{rpcState:result.rpc.state,indexedStatus:result.indexed?.status??null});return Object.freeze({state:next,result});
  }
  dispose(){this.unsubscribe?.();this.unsubscribe=null;}
}
