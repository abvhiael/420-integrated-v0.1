import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCart,getPublicProduct,reviewedOrder,receiptLabel} from '../public-core.js';
const store='a'.repeat(64),other='b'.repeat(64),listing='0x'+'c'.repeat(64);
test('cart cannot cross tenant boundaries or accept duplicate listing',()=>{
 let cart=normalizeCart([],{listingId:listing,revision:2,quantity:3,sku:'Test'},store);
 assert.equal(cart.length,1);
 assert.equal(cart[0].quantity,'3');
 assert.throws(()=>normalizeCart(cart,{listingId:listing,revision:2,quantity:1},other),/single_merchant/);
 assert.equal(normalizeCart(cart,{listingId:listing,revision:3,quantity:2},store).length,1);
});
test('invalid quantity, revision and listing rejected',()=>{
 for(const quantity of [0,-1,1.1,Infinity,1000001])assert.throws(()=>normalizeCart([],{listingId:listing,revision:1,quantity},store));
 assert.throws(()=>normalizeCart([],{listingId:'bad',revision:1,quantity:1},store));
 assert.throws(()=>normalizeCart([],{listingId:listing,revision:0,quantity:1},store));
});
test('no projection invents canonical availability',()=>{
 assert.equal(getPublicProduct({product_id:'1',store_id:store,sku:'sku'}).canCart,false);
 assert.equal(getPublicProduct({product_id:'1',store_id:store,sku:'sku',canonical_listing_id:listing,listing_revision:1,listing:{unitPrice:'42'}}).canCart,true);
});
const plan={orderId:listing,state:'ORDER_SIGNATURE_REQUIRED',paymentAllowed:false,reserved:false,expiresAt:2000,intent:{chainId:'420',target:'0x'+'a'.repeat(40),method:'createOrder',requiresWalletAuthorization:true,canonicalAuthority:false,args:[listing,listing,1,'1','0x'+'b'.repeat(40),'42']}};
test('order terms require nonreserved, nonpayable exact chain plan',()=>{
 assert.equal(reviewedOrder(plan,'420',1000).total,'42');
 for(const change of [{paymentAllowed:true},{reserved:true},{expiresAt:1},{state:'PAID'}])assert.throws(()=>reviewedOrder({...plan,...change},'420',1000));
 assert.throws(()=>reviewedOrder(plan,'421',1000));
});
test('paid receipts require finalized canonical status',()=>{
 assert.equal(receiptLabel({state:'PAID',paid:true,provenance:{finalized:true}}),'Canonical payment confirmed');
 for(const status of [{state:'PAID',paid:false},{state:'CREATED',paid:true},{state:'PAID',paid:true,provenance:{finalized:false}}])assert.equal(receiptLabel(status),'Payment not confirmed');
});
