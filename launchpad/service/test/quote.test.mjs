import test from 'node:test';
import assert from 'node:assert/strict';
import {convertedCheckoutQuote,convertedCheckoutReview} from '../core/quote.mjs';
import {makeRpc,S,I,MERCHANT,USER,TOKEN,A,runtime,out} from './consumer.fixture.mjs';
const INPUT='0x000000000000000000000000000000000000c333',
  POOL='0x000000000000000000000000000000000000c444',
  ROUTER='0x000000000000000000000000000000000000c555',
  QUOTE='0x000000000000000000000000000000000000c666',
  MARKET='0x000000000000000000000000000000000000c777',
  QUOTE_ID='0x'+'ab'.repeat(32),
  MARKET_ID='0x'+'bc'.repeat(32);
const PAY={
  '420/APP/420PAY/PAYMENT_REGISTRY':A.payments,
  '420/APP/420PAY/PAYMENT_ROUTER':ROUTER,
  '420/APP/420PAY/NATIVE_QUOTE_SOURCE':QUOTE,
  '420/APP/420SWAP/CANONICAL_MARKET_REGISTRY':MARKET,
  '420/APP/420PAY/INVOICE_REGISTRY':A.invoices
};
const COMPONENT_KEYS=Object.keys(PAY),COMPONENT_IDS=Object.fromEntries(COMPONENT_KEYS.map((k,i)=>[k,'0x'+(100+i).toString(16).padStart(64,'0')]));
const CODE_HASH='0x'+'de'.repeat(32),CODE='0x6001';
const terms={saleId:S,account:USER,amount:'42',nonce:'9',marketId:MARKET_ID,inputAsset:INPUT,maxInput:'100',minOutput:'42'};
function payRpc(){
  const rpc=makeRpc(),call=rpc.call.bind(rpc),ethCall=rpc.ethCall.bind(rpc);
  rpc.set('markets(bytes32)',out(POOL,INPUT,TOKEN,1,'0x'+'f0'.repeat(32),1));
  rpc.set('runtimeCodeHash(bytes32)',out(CODE_HASH));
  rpc.set('quoteConversion((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256))',
    out(QUOTE_ID,MARKET_ID,INPUT,TOKEN,100,42,42,2,20,150,MERCHANT,MERCHANT,42,190));
  rpc.set('balanceOf(address)',out(500));
  rpc.set('allowance(address,address)',out(5));
  rpc.call=async(method,params)=>{
    if(method==='web3_sha3'){
      if(params[0]===CODE)return CODE_HASH;
      const key=Buffer.from(params[0].slice(2),'hex').toString('utf8');
      return COMPONENT_IDS[key]||'0x'+'99'.repeat(32);
    }
    if(method==='eth_getCode')return CODE;
    return call(method,params);
  };
  rpc.ethCall=async(to,data)=>{
    const selector=await rpc.selector('resolve(bytes32)');
    if(data.slice(0,10)===selector){
      const id='0x'+data.slice(10,74);
      const key=COMPONENT_KEYS.find(k=>COMPONENT_IDS[k]===id);
      return out(key?PAY[key]:A.invoices);
    }
    return ethCall(to,data);
  };
  return rpc;
}
test('420Pay converter verifies settlement exactness and prepares least-privilege pool approval',async()=>{
  const rpc=payRpc(),q=await convertedCheckoutQuote(rpc,runtime,terms);
  assert.equal(q.quotedSettlement,'42');assert.equal(q.conversionFee,'2');assert.equal(q.pool,POOL);
  assert.equal(q.approveRequired,true);assert.equal(q.canPay,false);assert.equal(q.paymentRouterAddress,ROUTER);
  const review=await convertedCheckoutReview(rpc,runtime,'approve-conversion',terms);
  assert.equal(review.transaction.to,INPUT);assert.match(review.summary,/canonical market pool/);
  rpc.set('allowance(address,address)',out(100));
  const ready=await convertedCheckoutQuote(rpc,runtime,terms);
  assert.equal(ready.canPay,true);
  const pay=await convertedCheckoutReview(rpc,runtime,'pay-conversion',terms);
  assert.equal(pay.transaction.to,ROUTER);assert.equal(pay.transaction.data,ready.transaction.data);
  assert.equal(pay.transaction.value,'0x0');
});
test('converted checkout rejects non-exact settlement, inactive market and codehash substitution',async()=>{
  const rpc=payRpc();
  rpc.set('quoteConversion((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256))',
    out(QUOTE_ID,MARKET_ID,INPUT,TOKEN,100,42,43,2,20,150,MERCHANT,MERCHANT,42,190));
  await assert.rejects(()=>convertedCheckoutQuote(rpc,runtime,terms),/does not settle exact campaign amount/);
  rpc.set('quoteConversion((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256))',
    out(QUOTE_ID,MARKET_ID,INPUT,TOKEN,100,42,42,2,20,150,MERCHANT,MERCHANT,42,190));
  rpc.set('markets(bytes32)',out(POOL,INPUT,TOKEN,1,'0x'+'f0'.repeat(32),0));
  await assert.rejects(()=>convertedCheckoutQuote(rpc,runtime,terms),/market not approved/);
  rpc.set('markets(bytes32)',out(POOL,INPUT,TOKEN,1,'0x'+'f0'.repeat(32),1));
  rpc.set('runtimeCodeHash(bytes32)',out('0x'+'ff'.repeat(32)));
  await assert.rejects(()=>convertedCheckoutQuote(rpc,runtime,terms),/runtime codehash mismatch/);
});
test('converted checkout refuses bogus merchant recipient and approval without a verified quote',async()=>{
  const rpc=payRpc();
  await assert.rejects(()=>convertedCheckoutReview(rpc,runtime,'pay-conversion',terms),/allowance insufficient/);
  rpc.set('quoteConversion((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256))',
    out(QUOTE_ID,MARKET_ID,INPUT,TOKEN,100,42,42,2,20,150,USER,MERCHANT,42,190));
  await assert.rejects(()=>convertedCheckoutQuote(rpc,runtime,terms),/does not settle exact campaign amount/);
});
