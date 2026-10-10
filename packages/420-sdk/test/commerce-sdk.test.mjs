import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommerceSdk420,commerceSigningMessage420,encodeCommerceMerchantTransaction420 } from '../dist/index.js';
test('Commerce SDK request signing domain is explicit and compatible with API v1',()=>{
  assert.equal(commerceSigningMessage420({origin:'https://commerce.invalid',chainId:'420',address:'0xabc',nonce:'nonce',expiresAt:42},'GET','/v1/checkout/id','hash'),'420Commerce request v1\nOrigin: https://commerce.invalid\nChain: 420\nWallet: 0xabc\nNonce: nonce\nExpires: 42\nMethod: GET\nPath: /v1/checkout/id\nBody-SHA256: hash');
});
test('Commerce SDK rejects insecure remote endpoints and invalid object identifiers',()=>{
  assert.throws(()=>createCommerceSdk420({baseUrl:'http://commerce.invalid',origin:'https://commerce.invalid',chainId:'420'}));const sdk=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420'});assert.throws(()=>sdk.product('../private'));assert.throws(()=>sdk.storefront('<script>'));
});
test('Commerce SDK keeps anonymous search independent of Wallet and reports unavailable envelopes',async()=>{
  const calls=[],sdk=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420',fetcher:async(url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify({schema:'420-commerce-api-v1',data:{items:[],authoritative:false}}));}});const result=await sdk.search({query:'safe text',limit:20});assert.equal(result.authoritative,false);assert.equal(calls[0].url,'https://commerce.invalid/v1/search?query=safe+text&limit=20');assert.equal(calls[0].init.redirect,'error');
  const broken=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420',fetcher:async()=>new Response(JSON.stringify({schema:'v0',data:{}}))});await assert.rejects(()=>broken.search(),e=>e.code==='invalid_response');
});
test('Commerce SDK refuses an unbound, spoofed or wrong-chain Market transaction plan',async()=>{
  const address='0x'+'1'.repeat(40),orderId='0x'+'2'.repeat(64),listingId='0x'+'3'.repeat(64),now=1800000000000;
  let target=address,signed=0;const sdk=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420',now:()=>now,wallet:{address,signMessage:async()=>{signed++;return '0xsignature';}},host:{network:{chainIdDecimal:'420'},contract:()=>({address,version:'2',verified:true})},fetcher:async(url)=>new Response(JSON.stringify({schema:'420-commerce-api-v1',data:String(url).endsWith('/challenge')?{origin:'https://commerce.invalid',chainId:'420',address,nonce:'a'.repeat(64),expiresAt:now+120000}:{paid:false,attempts:[{attemptId:'a'.repeat(64),orderId,state:'ORDER_SIGNATURE_REQUIRED',expiresAt:now+120000,paymentAllowed:false,reserved:false,intent:{chainId:'420',target,method:'createOrder',args:[orderId,listingId,1,'1',address,'100'],requiresWalletAuthorization:true,canonicalAuthority:false}}]}}))});
  const result=await sdk.prepareCheckout('a'.repeat(64),1,'abcdefghijklmnop');assert.equal(result.attempts[0].intent.target,address);assert.equal(signed,1);target='0x'+'4'.repeat(40);await assert.rejects(()=>sdk.prepareCheckout('a'.repeat(64),1,'abcdefghijklmnop'),e=>e.code==='invalid_order_plan');
  const unbound=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420'});await assert.rejects(()=>unbound.prepareCheckout('a'.repeat(64),1,'abcdefghijklmnop'),e=>e.code==='canonical_market_unavailable');
});
test('merchant SDK validates registration target/controller/payout/expiry and forbids forged reviewed args',async()=>{
  const address='0x'+'1'.repeat(40),id='0x'+'2'.repeat(64),now=1800000000000,change={merchantId:id,profileId:id,metadataHash:id,payout:address};let tamper=null;
  const sdk=createCommerceSdk420({baseUrl:'https://commerce.invalid',origin:'https://commerce.invalid',chainId:'420',now:()=>now,wallet:{address,signMessage:async()=> '0xsigned'},host:{network:{chainIdDecimal:'420'},contract:()=>({address,version:'1',verified:true})},fetcher:async url=>{
    const plan={controller:address,expiresAt:now+10000,provenance:{chainId:'420',blockHash:id,blockNumber:1,finalized:true},intent:{chainId:'420',target:address,contract:'MerchantRegistry420',method:'register',args:[id,id,id,address],data:encodeCommerceMerchantTransaction420('register',[id,id,id,address]),requiresWalletAuthorization:true,canonicalAuthority:false}};
    if(tamper==='data')plan.intent.data='0x1234';if(tamper==='target')plan.intent.target='0x'+'3'.repeat(40);if(tamper==='controller')plan.controller='0x'+'4'.repeat(40);if(tamper==='payout')plan.intent.args[3]='0x'+'5'.repeat(40);if(tamper==='expiry')plan.expiresAt=now;if(tamper==='finality')plan.provenance.finalized=false;
    return new Response(JSON.stringify({schema:'420-commerce-api-v1',data:String(url).endsWith('/challenge')?{origin:'https://commerce.invalid',chainId:'420',address,nonce:'a'.repeat(64),expiresAt:now+120000}:plan}));
  }});
  assert.equal((await sdk.registrationPlan(change)).intent.target,address);for(const reason of ['target','controller','payout','expiry','finality','data']){tamper=reason;await assert.rejects(()=>sdk.registrationPlan(change),e=>e.code==='invalid_transaction_plan');}
});
