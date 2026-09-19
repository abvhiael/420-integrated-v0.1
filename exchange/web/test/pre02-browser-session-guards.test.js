import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
import {QuoteReviewSession} from '../core/quote-review-session.js';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../browser-wallet-ui.js'),'utf8');
const account='0x'+'11'.repeat(20);
const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'}};
function provider(){
  const listeners=new Map();
  const requests=[];
  return {listeners,requests,on(name,fn){listeners.set(name,fn);},removeListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},async request({method}){
    requests.push(method);
    if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
    if(method==='eth_chainId')return '0x420';
    throw Error('Unexpected wallet method '+method);
  }};
}

test('PRE-02 browser wires provider choice, background, navigation and teardown to review invalidation',()=>{
  assert.match(source,/select\.addEventListener\('change',onProviderChoice\)/);
  assert.match(source,/context\.controller\.unbind\(\);context\.selectedProviderId=null/);
  assert.match(source,/context\.quoteSurface\?\.clear\('Wallet provider changed; quote review invalidated\.'\)/);
  assert.match(source,/documentRef\.addEventListener\('visibilitychange',onVisibility\)/);
  assert.match(source,/windowRef\.addEventListener\('popstate',onNavigation\)/);
  assert.match(source,/documentRef\.removeEventListener\('visibilitychange',onVisibility\)/);
  assert.match(source,/select\.removeEventListener\('change',onProviderChoice\)/);
  assert.match(source,/windowRef\.removeEventListener\('popstate',onNavigation\)/);
  assert.doesNotMatch(source,/eth_sendTransaction|eth_signTypedData_v4/);
});

test('PRE-02 a provider replacement invalidates pending reviews even when transport ignores abort',async()=>{
  const one=provider(),two=provider();
  const controller=new BrowserExecutionController({runtime});
  controller.announce({info:{uuid:'first',name:'First',rdns:'first.wallet'},provider:one});
  controller.announce({info:{uuid:'second',name:'Second',rdns:'second.wallet'},provider:two});
  await controller.connect({selectedId:'eip6963:first'});
  let finish;
  const review=new QuoteReviewSession({controller,fetchReview:()=>new Promise(resolve=>{finish=resolve;}),nowSeconds:()=>100});
  const pending=review.request({request:{account}});
  controller.unbind();
  review.invalidate();
  assert.equal(one.listeners.size,0);
  await controller.connect({selectedId:'eip6963:second'});
  finish({status:'REVIEW_CANDIDATE_ONLY',prepared:{context:{account,chainId:'0x420',observedAt:99,expiresAt:120}}});
  await assert.rejects(pending,error=>error.code==='STALE_QUOTE');
  assert.equal(review.candidate,null);
  assert.equal(controller.selection.id,'eip6963:second');
  assert.equal(two.requests.includes('eth_sendTransaction'),false);
  review.dispose();controller.dispose();
});
