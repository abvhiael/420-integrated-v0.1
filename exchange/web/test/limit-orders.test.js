import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLimitOrderDraft, canCancelOrder, minimumBuyForFill, normalizeOrderRecord, signedPriceFloor, validateFillPrice } from '../core/limit-orders.js';

const order=()=>({maker:'0xmaker',sellToken:'420',buyToken:'USD',sellAmount:10,minTotalBuyAmount:42,recipient:'0xmaker',primaryMarket:'m1',nonce:7,expiry:200,allowPartial:true});

test('draft preserves every V10 signed field',()=>{
  const d=buildLimitOrderDraft(order());
  assert.deepEqual(Object.keys(d),['maker','sellToken','buyToken','sellAmount','minTotalBuyAmount','recipient','primaryMarket','nonce','expiry','allowPartial']);
});

test('partial fill minimum rounds upward and preserves signed price floor',()=>{
  const min=minimumBuyForFill(order(),3);
  assert.ok(min>=12.6);
  assert.equal(signedPriceFloor(order()),4.2);
});

test('non-partial order rejects partial fill',()=>{
  assert.throws(()=>minimumBuyForFill({...order(),allowPartial:false},5),/partial fill not allowed/);
});

test('record derives partial and filled states deterministically',()=>{
  assert.equal(normalizeOrderRecord({...order(),filledSellAmount:0,boughtAmount:0}).state,'OPEN');
  assert.equal(normalizeOrderRecord({...order(),filledSellAmount:5,boughtAmount:21}).state,'PARTIAL');
  assert.equal(normalizeOrderRecord({...order(),filledSellAmount:10,boughtAmount:42}).state,'FILLED');
});

test('fill price cannot erode signed ratio',()=>{
  assert.equal(validateFillPrice({...order(),filledSellAmount:5,boughtAmount:21}),true);
  assert.equal(validateFillPrice({...order(),filledSellAmount:5,boughtAmount:20.9}),false);
});

test('cancellation remains fail closed without wallet session',()=>{
  const r=normalizeOrderRecord({...order(),filledSellAmount:0,boughtAmount:0});
  assert.equal(canCancelOrder(r,{walletReady:false,nowSeconds:100}).reason,'wallet-unavailable');
  assert.equal(canCancelOrder(r,{walletReady:true,nowSeconds:100}).ok,true);
});
