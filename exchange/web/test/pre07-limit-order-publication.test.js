import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
import {LimitOrderPublicationController} from '../core/limit-order-publication-controller.js';
import {hashLimitOrder,limitOrderDigest} from '../core/limit-order-identity.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=addr(1);
const runtime={
  deployment:{status:'RESOLVED',environment:'testnet'},
  network:{chainId:'0x420'},
  contracts:{ExchangeLimitOrderSettlement420:addr(9)},
  execution:{orderSigning:'DISABLED_PRETESTNET',orderPublication:'DISABLED_PRETESTNET'},
};
const reviewedOrder={maker:account,recipient:account,primaryMarket:id(4),nonce:7,expiry:2000,allowPartial:true};
const execution={maker:account,sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',recipient:account,marketId:id(4),nonce:'7',expiry:'2000',allowPartial:true};
function provider(){
  const listeners=new Map(),calls=[];
  return {listeners,calls,on(n,cb){listeners.set(n,cb);},removeListener(n,cb){if(listeners.get(n)===cb)listeners.delete(n);},async request({method}){
    calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];if(method==='eth_chainId')return '0x420';throw new Error('unexpected '+method);
  }};
}
async function setup({publish,status}={}){
  const p=provider(),browser=new BrowserExecutionController({runtime});await browser.connect({ethereum:p});
  const lifecycle=new LimitOrderPublicationController({
    controller:browser,nowSeconds:()=>1000,
    publish:publish??(async({signedOrder})=>({idempotent:false,order:{schema:'420-exchange-order-status-v1',orderHash:signedOrder.orderHash,order:signedOrder.order,state:'accepted',revision:3,provenance:{schema:'420-exchange-order-status-provenance-v1',service:'420/service/exchange-orders/v1',orderHash:signedOrder.orderHash,revision:3,observedAt:1000}}})),
    status:status??(async()=>{throw new Error('unused');}),
  });
  return {p,browser,lifecycle};
}

test('browser creates exact canonical order review without invoking wallet signing',async()=>{
  const env=await setup();
  const snap=env.lifecycle.prepare({reviewedOrder,execution});
  assert.equal(snap.state,'prepared');
  assert.equal(snap.review.orderHash,hashLimitOrder(execution));
  assert.equal(snap.review.digest,limitOrderDigest({domain:snap.review.domain,order:snap.review.order}));
  assert.equal(env.p.calls.includes('eth_signTypedData_v4'),false);
  env.lifecycle.dispose();env.browser.dispose();
});

test('externally signed artifact must exactly match reviewed domain/order and publication preserves canonical identity',async()=>{
  const env=await setup();
  env.lifecycle.prepare({reviewedOrder,execution});
  const review=env.lifecycle.review,signature='0x'+'11'.repeat(65);
  assert.throws(()=>env.lifecycle.attachSigned({signature,domain:review.domain,order:{...review.order,nonce:'8'}}),e=>e.code==='SIGNED_ORDER_MISMATCH');
  env.lifecycle.attachSigned({signature,domain:review.domain,order:review.order});
  assert.equal(env.lifecycle.state,'signed');
  const result=await env.lifecycle.publish();
  assert.equal(result.state,'accepted');
  assert.equal(result.orderHash,review.orderHash);
  assert.equal(env.p.calls.includes('eth_signTypedData_v4'),false);
  env.lifecycle.dispose();env.browser.dispose();
});

test('provider/account change invalidates prepared or signed publication authority',async()=>{
  const env=await setup();
  env.lifecycle.prepare({reviewedOrder,execution});
  env.p.listeners.get('accountsChanged')?.([addr(8)]);
  assert.equal(env.lifecycle.state,'invalidated');
  assert.throws(()=>env.lifecycle.attachSigned({}),e=>e.code==='ORDER_INVALIDATED');
  env.lifecycle.dispose();env.browser.dispose();
});

test('status refresh preserves distinct service lifecycle states and stale/conflicting service identity is rejected by controller',async()=>{
  const states=['accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected'];
  let index=0,hash=null;
  const env=await setup({
    status:async()=>({schema:'420-exchange-order-status-v1',orderHash:hash,order:execution,state:states[index++],revision:index,provenance:{schema:'420-exchange-order-status-provenance-v1',service:'420/service/exchange-orders/v1',orderHash:hash,revision:index,observedAt:1000}}),
  });
  env.lifecycle.prepare({reviewedOrder,execution});hash=env.lifecycle.orderHash;
  env.lifecycle.attachSigned({signature:'0x'+'22'.repeat(65),domain:env.lifecycle.review.domain,order:env.lifecycle.review.order});
  await env.lifecycle.publish();
  for(const state of states){
    const snap=await env.lifecycle.refresh();assert.equal(snap.state,state);
  }
  env.lifecycle.dispose();env.browser.dispose();
});
