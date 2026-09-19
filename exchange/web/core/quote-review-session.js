import {fetchExecutableSwapReview} from './executable-quote-intake.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export class QuoteReviewSessionError extends Error {
  constructor(code,message){super(message);this.name='QuoteReviewSessionError';this.code=code;}
}
const fail=(code,message)=>{throw new QuoteReviewSessionError(code,message);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();

// Read-only session for a candidate quote. Invalidation never promotes a quote to
// execution authority, and neither this class nor its fetcher invokes a wallet.
export class QuoteReviewSession {
  constructor({controller,fetchReview=fetchExecutableSwapReview,nowSeconds=()=>Math.floor(Date.now()/1000)}={}){
    if(!controller||typeof fetchReview!=='function'||typeof nowSeconds!=='function')fail('CONFIG_REQUIRED','wallet controller, quote fetcher and clock required');
    this.controller=controller;this.fetchReview=fetchReview;this.nowSeconds=nowSeconds;
    this.epoch=0;this.pending=null;this.candidate=null;this.disposed=false;
  }
  snapshot(){
    if(this.disposed)fail('DISPOSED','quote review session disposed');
    const wallet=this.controller.wallet,session=wallet?.session;
    if(this.controller.disposed||!wallet||!session?.account||!session?.chainId||!Number.isSafeInteger(session.generation))fail('WALLET_UNAVAILABLE','connected wallet required for quote review');
    return {wallet,account:normalizeAccount(session.account),chainId:normalizeChainId(session.chainId),generation:session.generation,controllerGeneration:this.controller.generation};
  }
  unchanged(original){
    const current=this.snapshot();
    return current.wallet===original.wallet&&current.account===original.account&&current.chainId===original.chainId&&current.generation===original.generation&&current.controllerGeneration===original.controllerGeneration;
  }
  invalidate(){
    this.epoch++;this.pending?.abort();this.pending=null;this.candidate=null;
  }
  async request({request,fetchImpl}={}){
    this.invalidate();
    const epoch=this.epoch,session=this.snapshot();
    if(!request||!same(request.account,session.account))fail('ACCOUNT_MISMATCH','quote request must identify the connected wallet');
    const controller=new AbortController();this.pending=controller;
    // A rejected or ignored AbortSignal cannot make a late response valid.
    try{
      const candidate=await this.fetchReview({runtime:this.controller.runtime,request,nowSeconds:this.nowSeconds(),fetchImpl,signal:controller.signal});
      if(this.disposed||epoch!==this.epoch||controller.signal.aborted)fail('STALE_QUOTE','quote request was replaced or invalidated');
      if(!this.unchanged(session)||!same(candidate?.prepared?.context?.account,session.account)||normalizeChainId(candidate?.prepared?.context?.chainId)!==session.chainId)fail('SESSION_CHANGED','wallet or chain changed while fetching quote');
      const now=this.nowSeconds();
      if(!Number.isSafeInteger(now)||candidate?.status!=='REVIEW_CANDIDATE_ONLY'||candidate.prepared.context.observedAt>now||now-candidate.prepared.context.observedAt>30||candidate.prepared.context.expiresAt<=now)fail('STALE_QUOTE','quote expired or became stale before display');
      this.candidate=Object.freeze({candidate,session,epoch});
      return candidate;
    }catch(error){
      if(epoch===this.epoch)this.candidate=null;
      throw error;
    }finally{if(this.pending===controller)this.pending=null;}
  }
  current(){
    const saved=this.candidate;
    if(!saved||this.disposed||saved.epoch!==this.epoch)fail('REVIEW_UNAVAILABLE','no current quote review candidate');
    if(!this.unchanged(saved.session)){this.invalidate();fail('SESSION_CHANGED','wallet changed since quote review');}
    const now=this.nowSeconds(),context=saved.candidate.prepared.context;
    if(!Number.isSafeInteger(now)||context.observedAt>now||now-context.observedAt>30||context.expiresAt<=now){this.invalidate();fail('STALE_QUOTE','quote review is no longer fresh');}
    return saved.candidate;
  }
  dispose(){if(this.disposed)return;this.invalidate();this.disposed=true;}
}
