import {keccak256} from './abi.js';
import {beginBoundSwapReview,confirmBoundSwapReview} from './bound-swap-review.js';
import {isVerifiedQuoteEvidence} from './quote-authentication.js';
import {preflightExchangeTransaction,transactionFingerprint} from './preflight.js';
import {inspectAndReconcileTransaction} from './transaction-lifecycle.js';
import {DEFAULT_SUBMISSION_GATE,submitPreflightedTransaction} from './wallet-execution.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export const SWAP_ORCHESTRATION_STATES=Object.freeze([
  'IDLE','PREPARED','AWAITING_CONFIRMATION','REVIEW_CONFIRMED','PREFLIGHTED',
  'SUBMITTED','PENDING','CONFIRMED','REVERTED','REPLACED','DROPPED','REORGED',
  'INDEXER_DELAYED','INDEXER_CONFLICTING','INVALIDATED',
]);

export class SwapOrchestrationError extends Error{
  constructor(code,message,details={}){
    super(message);
    this.name='SwapOrchestrationError';
    this.code=code;
    this.details=Object.freeze({...details});
  }
}
const fail=(code,message,details={})=>{throw new SwapOrchestrationError(code,message,details);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value);
const raw=value=>typeof value==='string'&&/^[0-9]+$/.test(value)&&BigInt(value)>0n;
const terminalReviewStates=new Set(['SUBMITTED','PENDING','CONFIRMED','REVERTED','REPLACED','DROPPED','REORGED','INDEXER_DELAYED','INDEXER_CONFLICTING']);

export function buildSwapAuthorizationReview({
  mode='NONE',owner=null,token=null,spender=null,amountRaw=null,permitType=null,deadline=null,
}={}){
  if(!['NONE','ALLOWANCE','PERMIT'].includes(mode))fail('AUTHORIZATION_MODE_INVALID','authorization mode must be NONE, ALLOWANCE or PERMIT');
  if(mode==='NONE'){
    const fingerprint=keccak256('420/exchange/swap-authorization/v1|NONE');
    return Object.freeze({schema:'420-exchange-swap-authorization-review-v1',mode,owner:null,token:null,spender:null,amountRaw:null,permitType:null,deadline:null,fingerprint});
  }
  if(!address(owner)||!address(token)||!address(spender)||!raw(amountRaw))fail('AUTHORIZATION_REVIEW_INVALID','authorization review requires owner, token, spender and positive raw amount');
  if(mode==='PERMIT'){
    if(typeof permitType!=='string'||permitType.length<1||permitType.length>64||!Number.isSafeInteger(deadline)||deadline<=0)fail('AUTHORIZATION_REVIEW_INVALID','permit review requires permit type and deadline');
  }else if(permitType!==null||deadline!==null){
    fail('AUTHORIZATION_REVIEW_INVALID','allowance review cannot contain permit fields');
  }
  const canonical=[
    '420/exchange/swap-authorization/v1',mode,normalizeAccount(owner),normalizeAccount(token),normalizeAccount(spender),
    amountRaw,permitType??'',deadline===null?'':String(deadline),
  ].join('|');
  return Object.freeze({
    schema:'420-exchange-swap-authorization-review-v1',mode,
    owner:normalizeAccount(owner),token:normalizeAccount(token),spender:normalizeAccount(spender),
    amountRaw,permitType:permitType??null,deadline:deadline??null,fingerprint:keccak256(canonical),
  });
}

function assertAuthorizationChecks(review,allowanceChecks){
  if(!Array.isArray(allowanceChecks))fail('AUTHORIZATION_CHECK_INVALID','allowance checks must be an array');
  if(review.mode==='NONE'&&allowanceChecks.length)fail('AUTHORIZATION_REVIEW_REQUIRED','allowance preflight requires a separate reviewed authorization');
  if(review.mode==='ALLOWANCE'){
    const match=allowanceChecks.some(check=>same(check?.owner,review.owner)&&same(check?.token,review.token)&&same(check?.spender,review.spender)&&String(check?.requiredAmountRaw)===review.amountRaw);
    if(!match)fail('AUTHORIZATION_REVIEW_MISMATCH','allowance preflight differs from the separately reviewed authorization');
  }
}

function mapLifecycle(result,exchangeClient){
  const rpc=result?.rpc,indexed=result?.indexed;
  if(!rpc?.state)fail('LIFECYCLE_INVALID','lifecycle inspector returned no RPC state');
  if(rpc.state==='DROPPED'&&indexed?.replacementRecordIds?.length)return 'REPLACED';
  if(indexed?.conflicts?.length)return 'INDEXER_CONFLICTING';
  if(['REVERTED','REORGED','DROPPED'].includes(rpc.state))return rpc.state;
  if(rpc.state==='PENDING'||rpc.state==='INCLUDED')return 'PENDING';
  if(['CONFIRMED','SAFE','FINALIZED'].includes(rpc.state)){
    if(exchangeClient&&!indexed?.reconciled)return 'INDEXER_DELAYED';
    return 'CONFIRMED';
  }
  return 'PENDING';
}

export class GuardedSwapOrchestrator{
  constructor({
    controller,
    nowSeconds=()=>Math.floor(Date.now()/1000),
    lifecycleInspector=inspectAndReconcileTransaction,
    submissionGate=DEFAULT_SUBMISSION_GATE,
  }={}){
    if(!controller||typeof controller.captureExecutionContext!=='function'||typeof controller.subscribeInvalidation!=='function')fail('CONTROLLER_REQUIRED','PRE-02 browser execution controller required');
    if(typeof nowSeconds!=='function'||typeof lifecycleInspector!=='function')fail('CONFIG_REQUIRED','clock and lifecycle inspector required');
    this.controller=controller;
    this.nowSeconds=nowSeconds;
    this.lifecycleInspector=lifecycleInspector;
    this.submissionGate=submissionGate;
    this.state='IDLE';
    this.history=[];
    this.trusted=null;
    this.context=null;
    this.bound=null;
    this.authorizationReview=buildSwapAuthorizationReview();
    this.confirmation=null;
    this.preflight=null;
    this.preflightArgs=null;
    this.submission=null;
    this.lastLifecycle=null;
    this.invalidatedReason=null;
    this.unsubscribe=controller.subscribeInvalidation(reason=>{
      if(!terminalReviewStates.has(this.state))this.invalidate(reason);
    });
  }
  transition(state,details={}){
    if(!SWAP_ORCHESTRATION_STATES.includes(state))fail('STATE_INVALID','invalid swap orchestration state');
    this.state=state;
    this.history.push(Object.freeze({state,...details}));
    return this.snapshot();
  }
  snapshot(){
    return Object.freeze({
      state:this.state,
      quoteId:this.trusted?.quoteId??null,
      transactionFingerprint:this.trusted?.prepared?.transactionFingerprint??null,
      authorizationFingerprint:this.authorizationReview?.fingerprint??null,
      txHash:this.submission?.txHash??null,
      invalidatedReason:this.invalidatedReason,
      history:Object.freeze([...this.history]),
    });
  }
  invalidate(reason='execution-context-changed'){
    if(terminalReviewStates.has(this.state))return this.snapshot();
    this.invalidatedReason=String(reason);
    this.bound=null;this.confirmation=null;this.preflight=null;this.preflightArgs=null;
    return this.transition('INVALIDATED',{reason:this.invalidatedReason});
  }
  assertActive(...allowed){
    if(this.state==='INVALIDATED')fail('REVIEW_INVALIDATED','swap review was invalidated',{reason:this.invalidatedReason});
    if(!allowed.includes(this.state))fail('STATE_MISMATCH',`swap orchestration state ${this.state} is not valid for this operation`);
  }
  assertContext(){
    try{return this.controller.assertExecutionContext(this.context);}
    catch(error){this.invalidate(error?.code??'STALE_SESSION');fail('STALE_SESSION','wallet/session changed since swap preparation');}
  }
  prepare({trustedQuote}={}){
    this.assertActive('IDLE','INVALIDATED');
    if(trustedQuote?.status!=='TRUSTED_EXECUTION_QUOTE'||trustedQuote?.prepared?.kind!=='SWAP'||!isVerifiedQuoteEvidence(trustedQuote?.authentication))fail('AUTHENTICATED_QUOTE_REQUIRED','PRE-05 authenticated executable swap quote required');
    const context=this.controller.captureExecutionContext();
    if(!same(trustedQuote.prepared.context.account,context.account)||normalizeChainId(trustedQuote.prepared.context.chainId)!==context.chainId)fail('SESSION_MISMATCH','authenticated quote does not match the current wallet session');
    this.trusted=trustedQuote;
    this.context=context;
    this.bound=null;this.confirmation=null;this.preflight=null;this.preflightArgs=null;this.submission=null;this.lastLifecycle=null;this.invalidatedReason=null;
    this.authorizationReview=buildSwapAuthorizationReview();
    return this.transition('PREPARED');
  }
  beginReview({authorizationReview=buildSwapAuthorizationReview()}={}){
    this.assertActive('PREPARED');
    this.assertContext();
    if(!authorizationReview||authorizationReview.schema!=='420-exchange-swap-authorization-review-v1')fail('AUTHORIZATION_REVIEW_INVALID','separate authorization review object required');
    const trusted=this.trusted;
    this.bound=beginBoundSwapReview({
      runtime:this.controller.runtime,prepared:trusted.prepared,execution:trusted.execution,tokens:trusted.tokens,quoteId:trusted.quoteId,
      session:this.controller.wallet.session,authenticationEvidence:trusted.authentication,
    });
    this.authorizationReview=authorizationReview;
    return this.transition('AWAITING_CONFIRMATION');
  }
  confirm({displayed,confirmedFingerprint,authorizationFingerprint=null}={}){
    this.assertActive('AWAITING_CONFIRMATION');
    this.assertContext();
    if(this.authorizationReview.mode!=='NONE'&&authorizationFingerprint!==this.authorizationReview.fingerprint)fail('AUTHORIZATION_CONFIRMATION_REQUIRED','approval/permit review must be confirmed separately from the swap');
    const trusted=this.trusted;
    const executionConfirmation=confirmBoundSwapReview({
      runtime:this.controller.runtime,prepared:trusted.prepared,execution:trusted.execution,tokens:trusted.tokens,quoteId:trusted.quoteId,
      session:this.controller.wallet.session,bound:this.bound,displayed,confirmedFingerprint,nowSeconds:this.nowSeconds(),
    });
    this.confirmation=Object.freeze({
      schema:'420-exchange-swap-confirmation-v1',
      account:this.context.account,chainId:this.context.chainId,
      walletGeneration:this.context.walletGeneration,controllerGeneration:this.context.controllerGeneration,
      quoteId:trusted.quoteId,transactionFingerprint:trusted.prepared.transactionFingerprint,
      authorization:this.authorizationReview,confirmedAt:this.nowSeconds(),execution:executionConfirmation,
    });
    return this.transition('REVIEW_CONFIRMED');
  }
  async preflightSwap({allowanceChecks=[],authorizationChecks=[],staticCalls=[]}={}){
    this.assertActive('REVIEW_CONFIRMED','PREFLIGHTED');
    this.assertContext();
    assertAuthorizationChecks(this.authorizationReview,allowanceChecks);
    const live=await this.controller.assertLiveSession();
    if(live.generation!==this.context.walletGeneration||live.epoch!==this.context.controllerGeneration)fail('STALE_SESSION','wallet generation changed before preflight');
    const now=this.nowSeconds();
    const args=Object.freeze({
      allowanceChecks:Object.freeze([...allowanceChecks]),authorizationChecks:Object.freeze([...authorizationChecks]),staticCalls:Object.freeze([...staticCalls]),
    });
    const preflight=await preflightExchangeTransaction({
      provider:live.wallet.provider,runtime:this.controller.runtime,transaction:this.trusted.prepared.transaction,
      allowanceChecks:args.allowanceChecks,authorizationChecks:args.authorizationChecks,staticCalls:args.staticCalls,
      freshness:{observedAt:this.trusted.prepared.context.observedAt,expiresAt:this.trusted.prepared.context.expiresAt,nowSeconds:now,maxAgeSeconds:30},
    });
    this.assertContext();
    if(preflight.transactionFingerprint!==this.confirmation.transactionFingerprint)fail('FINGERPRINT_CHANGED','preflight fingerprint differs from explicit confirmation');
    this.preflight=preflight;this.preflightArgs=args;
    this.transition('PREFLIGHTED',{gasEstimate:preflight.gasEstimate});
    return preflight;
  }
  async submit(){
    this.assertActive('PREFLIGHTED');
    this.assertContext();
    const live=await this.controller.assertLiveSession();
    if(live.generation!==this.context.walletGeneration||live.epoch!==this.context.controllerGeneration)fail('STALE_SESSION','wallet generation changed at submit boundary');
    const currentFingerprint=transactionFingerprint(this.trusted.prepared.transaction);
    if(currentFingerprint!==this.confirmation.transactionFingerprint)fail('FINGERPRINT_CHANGED','transaction changed after confirmation');

    // PRE-06 requires a fresh preflight immediately before the send boundary.
    const now=this.nowSeconds();
    const fresh=await preflightExchangeTransaction({
      provider:live.wallet.provider,runtime:this.controller.runtime,transaction:this.trusted.prepared.transaction,
      allowanceChecks:this.preflightArgs.allowanceChecks,authorizationChecks:this.preflightArgs.authorizationChecks,staticCalls:this.preflightArgs.staticCalls,
      freshness:{observedAt:this.trusted.prepared.context.observedAt,expiresAt:this.trusted.prepared.context.expiresAt,nowSeconds:now,maxAgeSeconds:30},
    });
    this.assertContext();
    if(fresh.transactionFingerprint!==this.confirmation.transactionFingerprint)fail('FINGERPRINT_CHANGED','fresh preflight differs from confirmed transaction');
    this.preflight=fresh;
    const submission=await submitPreflightedTransaction({
      provider:live.wallet.provider,session:live.session,expectedChainId:this.context.chainId,expectedGeneration:this.context.walletGeneration,
      transaction:this.trusted.prepared.transaction,preflight:fresh,submissionGate:this.submissionGate,
    });
    this.submission=submission;
    this.transition('SUBMITTED',{txHash:submission.txHash,gasEstimate:fresh.gasEstimate});
    return submission;
  }
  async observeLifecycle({exchangeClient=null,minConfirmations=1,subjectId=null,kinds=['TRADE','FEE_ROUTING']}={}){
    this.assertActive('SUBMITTED','PENDING','CONFIRMED','REVERTED','REPLACED','DROPPED','REORGED','INDEXER_DELAYED','INDEXER_CONFLICTING');
    const result=await this.lifecycleInspector({
      provider:this.controller.wallet?.provider,exchangeClient,txHash:this.submission.txHash,minConfirmations,subjectId,kinds,
    });
    this.lastLifecycle=result;
    const next=mapLifecycle(result,exchangeClient);
    this.transition(next,{rpcState:result.rpc.state,indexedStatus:result.indexed?.status??null});
    return Object.freeze({state:next,result});
  }
  async waitForLifecycle({maxAttempts=3,sleep=async()=>{},...options}={}){
    if(!Number.isInteger(maxAttempts)||maxAttempts<1||typeof sleep!=='function')fail('LIFECYCLE_POLICY_INVALID','valid lifecycle polling policy required');
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      const observation=await this.observeLifecycle(options);
      if(!['PENDING','INDEXER_DELAYED'].includes(observation.state))return observation;
      if(attempt<maxAttempts)await sleep(attempt);
    }
    fail('LIFECYCLE_TIMEOUT','transaction lifecycle did not settle within the bounded polling policy',{state:this.state,txHash:this.submission?.txHash??null});
  }
  dispose(){
    this.unsubscribe?.();this.unsubscribe=null;
  }
}
