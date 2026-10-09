import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,toUtf8Bytes} from 'ethers';
import {setup,published,buyer,seller,b32,address} from './fixtures.mjs';
const zeroAddress=address(0);
test('native 420 zero-address quote asset remains legal in Market listing plan, under canonical policy',async t=>{
 const f=setup();t.after(()=>f.close());
 const store=await f.service.createStore(seller.address,{merchantId:b32(1),slug:'native-merchant'});
 const p=await f.service.product(seller.address,store.store_id,{sku:'NATIVE',description:'Native 420 quote',media:[],publishState:'draft'});
 const change={version:p.version,method:'createListing',listingId:b32(78),sellerProfileId:b32(3),itemClass:keccak256(toUtf8Bytes('420/MARKET/ITEM/PHYSICAL_GOOD/V1')),assetRef:b32(5),policyId:b32(6),adapterId:b32(7),quoteAsset:zeroAddress,unitPrice:'420',quantity:'1',expiresAt:0};
 // Existing canonical policy and Market authority remain the final gate;
 // zero address is the native value convention, not an invalid ERC20 token.
 const plan=await f.service.listingPlan(seller.address,store.store_id,p.product_id,change);
 assert.equal(plan.intent.args[8],zeroAddress);
 assert.equal(plan.intent.args[9],'420');
});
test('canonical receipt references are never fabricated for absent orders',async t=>{
 const f=setup();t.after(()=>f.close());
 const {store}=await published(f);
 const cart=f.service.cart(buyer.address,{storeId:store.store_id,lines:[{listingId:b32(2),revision:1,quantity:'1'}]});
 const result=await f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:cart.version,idempotencyKey:'native_receipt_no_claim_01'});
 const status=await f.service.status(buyer.address,result.attempts[0].attemptId);
 assert.equal(status.paid,false);assert.equal(status.reserved,false);
 assert.equal(status.receiptHash,undefined);assert.equal(status.paymentId,undefined);
});
