import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
import {QuoteReviewSession} from '../core/quote-review-session.js';
import {transactionFingerprint} from '../core/preflight.js';

const account='0x'+'11'.repeat(20);
const runtime={
  deployment:{status:'RESOLVED',environment:'testnet'},
  network:{chainId:'0x420'},
  contracts:{ExchangeAuthorization420:'0x'+'22'.repeat(20)},
};

function provider({deferGas=false}={}){
  const listeners=new Map(),calls=[];
  let releaseGas,gasStartedResolve;
  const gasGate=deferGas?new Promise(resolve=>{releaseGas=resolve;}):null;
  const gasStarted=new Promise(resolve=>{gasStartedResolve=resolve;});
  return {
    listeners,calls,gasStarted,releaseGas:()=>releaseGas?.(),
    on(name,fn){listeners.set(name,fn);},
    removeListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    async request({method}){
      calls.push(method);
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
      if(method==='eth_chainId')return '0x420';
      if(method==='eth_call')return '0x';
      if(method==='eth_estimateGas'){gasStartedResolve();if(gasGate)await gasGate;return '0x5208';}
      if(method==='eth_sendTransaction')return '0x'+'33'.repeat(32);
      throw Error('Unexpected wallet method '+method);
    },
  };
}

test('PRE-02 execution tokens are invalidated by trade context changes without disconnecting the wallet',async()=>{
  const injected=provider(),reasons=[];
  const controller=new BrowserExecutionController({runtime,onInvalidate:reason=>reasons.push(reason)});
  await controller.connect({ethereum:injected});
  const token=controller.captureExecutionContext();
  const wallet=controller.wallet;
  controller.invalidateExecution('trade-input-change');
  assert.throws(()=>controller.assertExecutionContext(token),error=>error.code==='STALE_SESSION');
  assert.equal(controller.wallet,wallet,'trade edits invalidate execution state without inventing a second wallet identity');
  assert.equal(controller.wallet.session.account,account);
  assert.deepEqual(reasons,['trade-input-change']);
  assert.equal(injected.calls.includes('eth_sendTransaction'),false);
  assert.equal(injected.calls.includes('eth_signTypedData_v4'),false);
  controller.dispose();
});

test('PRE-02 runtime replacement revokes the prior wallet authority and invalidates captured confirmation state',async()=>{
  const injected=provider(),reasons=[];
  const controller=new BrowserExecutionController({runtime,onInvalidate:reason=>reasons.push(reason)});
  await controller.connect({ethereum:injected});
  const token=controller.captureExecutionContext();
  const replacement={deployment:{status:'UNRESOLVED',environment:'testnet'},network:{chainId:'0x421'}};
  controller.replaceRuntime(replacement);
  assert.equal(controller.runtime,replacement);
  assert.equal(controller.wallet,null);
  assert.equal(injected.listeners.size,0);
  assert.throws(()=>controller.assertExecutionContext(token),error=>error.code==='STALE_SESSION');
  assert.deepEqual(reasons,['runtime-replaced']);
  controller.dispose();
});

test('PRE-02 input invalidation during preflight prevents a stale transaction from reaching eth_sendTransaction',async()=>{
  const injected=provider({deferGas:true});
  const controller=new BrowserExecutionController({runtime});
  await controller.connect({ethereum:injected});
  const transaction={
    kind:'SWAP',
    chainId:'0x420',
    request:{from:account,to:'0x'+'44'.repeat(20),data:'0x12345678',value:'0x0'},
  };
  const reviewedIntent={kind:'SWAP',transactionFingerprint:transactionFingerprint(transaction)};
  const pending=controller.submit({
    transaction,
    reviewedIntent,
    freshness:{observedAt:10,expiresAt:100,nowSeconds:20},
  });
  await injected.gasStarted;
  controller.invalidateExecution('trade-input-change');
  injected.releaseGas();
  await assert.rejects(pending,error=>error.code==='STALE_SESSION');
  assert.equal(injected.calls.includes('eth_sendTransaction'),false,'stale preflight must never submit');
  controller.dispose();
});

test('PRE-02 central navigation invalidation rejects a late quote even if the fetch transport ignores abort',async()=>{
  const injected=provider(),controller=new BrowserExecutionController({runtime});
  await controller.connect({ethereum:injected});
  let finish;
  const review=new QuoteReviewSession({
    controller,
    fetchReview:()=>new Promise(resolve=>{finish=resolve;}),
    nowSeconds:()=>100,
  });
  const pending=review.request({request:{account}});
  controller.invalidateExecution('navigation-change');
  finish({status:'REVIEW_CANDIDATE_ONLY',prepared:{context:{account,chainId:'0x420',observedAt:99,expiresAt:120}}});
  await assert.rejects(pending,error=>error.code==='SESSION_CHANGED');
  assert.equal(review.candidate,null);
  review.dispose();controller.dispose();
});
