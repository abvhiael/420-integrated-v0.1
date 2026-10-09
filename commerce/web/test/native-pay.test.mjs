import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {createNative420Payment,settleNative420Payment,qualifiedSwapRoute} from '../native-pay.js';
const addr=n=>'0x'+n.toString(16).padStart(40,'0'),word=n=>'0x'+n.toString(16).padStart(64,'0'),ZERO=addr(0),Z32=word(0),now=1800000000000;
const buyer=addr(11),seller=addr(12),recipient=addr(13),mid=word(14),orderId=word(15),invoiceId=word(16),paymentId=word(17);
const invoice=new Interface(['function getInvoice(bytes32) view returns(tuple(bytes32 merchantId,address merchant,bytes32 metadataHash,bytes3 currency,uint256 amount,uint64 expiresAt,uint64 refundUntil,uint8 mode,uint8 acceptance,bool partialPayments,uint16 quoteMaxSlippageBps,bytes32 acceptedAssetsHash,bytes32 settlementPlanHash,bytes32 tipPolicyHash,bool active))']);
const order=new Interface(['function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
const merchant=new Interface(['function currentPayout(bytes32) view returns(address primary,uint32 version,bytes32 planHash)']);
const pay=new Interface(['function derivePaymentId(bytes32,address,address,address,uint256,address,uint256,bytes32,uint256) view returns(bytes32)','function getPayment(bytes32) view returns(tuple(bytes32 invoiceId,address payer,address merchant,address inputAsset,uint256 inputAmount,address settlementAsset,uint256 settlementAmount,bytes32 quoteId,uint256 payerNonce,bytes32 receiptHash,uint256 tipAmount,uint256 refundedAmount,uint8 status))']);
const router=new Interface(['function consumedPaymentAuthorization(bytes32) view returns(bool)']);
const status={state:'PAYMENT_SIGNATURE_REQUIRED',paymentAllowed:true,paid:false,reserved:true,orderId,invoiceId,merchantId:mid,seller,buyer,asset:ZERO,total:'420',provenance:{chainId:'420',finalized:true}};
function mock({invoiceAmount='420',orderStatus=1,payout=recipient,submitted=false,consumed=false,chain='0x1a4'}={}){
 const contracts=Object.fromEntries(['InvoiceRegistry420','OrderRegistry420','MerchantRegistry420','PaymentRegistry420','PaymentRouter420'].map((n,i)=>[n,{address:addr(i+30),verified:true}]));
 const calls=[];
 const provider={request:async({method,params=[]})=>{
   calls.push({method,params});
   if(method==='eth_chainId')return chain;
   if(method==='eth_accounts')return [buyer];
   if(method==='eth_sendTransaction')return word(999);
   if(method!=='eth_call')throw Error('unexpected_method');
   const tx=params[0];const data=tx.data;
   if(data.startsWith(invoice.getFunction('getInvoice').selector))return invoice.encodeFunctionResult('getInvoice',[[mid,seller,Z32,'0x343230',invoiceAmount,BigInt(Math.floor(now/1000)+1000),BigInt(Math.floor(now/1000)+2000),0,1,false,0,word(5),Z32,Z32,true]]);
   if(data.startsWith(order.getFunction('getOrder').selector))return order.encodeFunctionResult('getOrder',[[word(20),1,buyer,seller,1,ZERO,420,word(21),Z32,Z32,Z32,orderStatus,0,0]]);
   if(data.startsWith(merchant.getFunction('currentPayout').selector))return merchant.encodeFunctionResult('currentPayout',[payout,1,Z32]);
   if(data.startsWith(pay.getFunction('derivePaymentId').selector))return pay.encodeFunctionResult('derivePaymentId',[paymentId]);
   if(data.startsWith(pay.getFunction('getPayment').selector))return pay.encodeFunctionResult('getPayment',[[invoiceId,buyer,seller,ZERO,420,ZERO,420,Z32,BigInt('0x'+Buffer.alloc(32,1).toString('hex')),Z32,0,0,submitted?1:0]]);
   if(data.startsWith(router.getFunction('consumedPaymentAuthorization').selector))return router.encodeFunctionResult('consumedPaymentAuthorization',[consumed]);
   return '0x';
 }};
 const s={address:buyer,epoch:0,pending:false,provider,config:{chainId:'420',contracts,nativePayment:{approved:true,native420AcceptedAssetsHash:word(5)}},verify:async()=>({epoch:0,address:buyer,tag:{blockHash:word(90),requireCanonical:true}})};
 return {s,calls};
}
const nonce=new Uint8Array(32).fill(1);
test('native Pay creation requires reviewed invoice, payout and explicit consent; never asserts paid',async()=>{
 const {s,calls}=mock();
 const r=await createNative420Payment(s,status,{now:()=>now,nonceBytes:nonce,approve:()=>true});
 assert.equal(r.paymentId,paymentId);assert.equal(r.paid,false);
 assert.equal(r.state,'PAYMENT_CREATION_BROADCAST_NOT_FINAL');
 assert.equal(calls.filter(x=>x.method==='eth_sendTransaction').length,1);
});
test('native creation fails closed for no approved router, wrong order or wrong invoice',async()=>{
 for(const bad of [{invoiceAmount:'421'},{orderStatus:0},{payout:ZERO}]){const {s,calls}=mock(bad);await assert.rejects(()=>createNative420Payment(s,status,{now:()=>now,nonceBytes:nonce,approve:()=>true}));assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);}
 const {s,calls}=mock();delete s.config.contracts.PaymentRouter420;await assert.rejects(()=>createNative420Payment(s,status,{now:()=>now,nonceBytes:nonce,approve:()=>true}));assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);
});
test('native creation never sends on buyer rejection',async()=>{
 const {s,calls}=mock();await assert.rejects(()=>createNative420Payment(s,status,{now:()=>now,nonceBytes:nonce,approve:()=>false}),/buyer_cancelled/);assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);
});
test('native settlement only after finalized matching registered Pay payment',async()=>{
 const {s,calls}=mock({submitted:true});
 const created={paymentId,payerNonce:BigInt('0x'+Buffer.alloc(32,1).toString('hex')).toString(),orderId,invoiceId,merchantId:mid,payer:buyer,seller,recipient,amount:'420',asset:ZERO};
 const r=await settleNative420Payment(s,status,created,{now:()=>now,approve:()=>true});
 assert.equal(r.paid,false);assert.equal(r.state,'NATIVE_SETTLEMENT_BROADCAST_NOT_FINAL');
 const tx=calls.find(x=>x.method==='eth_sendTransaction').params[0];
 assert.equal(tx.value,'0x1a4');
});
test('native settlement denies unsettled registry, replay, changed payout and rejected approval',async()=>{
 const created={paymentId,payerNonce:BigInt('0x'+Buffer.alloc(32,1).toString('hex')).toString(),orderId,invoiceId,merchantId:mid,payer:buyer,seller,recipient,amount:'420',asset:ZERO};
 for(const bad of [{submitted:false},{submitted:true,consumed:true},{submitted:true,payout:addr(99)}]){
  const {s,calls}=mock(bad);
  await assert.rejects(()=>settleNative420Payment(s,status,created,{now:()=>now,approve:()=>true}));
  assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);
 }
 const {s,calls}=mock({submitted:true});await assert.rejects(()=>settleNative420Payment(s,status,created,{now:()=>now,approve:()=>false}),/buyer_cancelled/);assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);
});
test('Swap is unavailable absent approved executable routing and quote',()=>{assert.equal(qualifiedSwapRoute().available,false)});

test('COM-7 unqualified Swap cannot create a funded transaction under a forged quote or route',async()=>{
 const {s,calls}=mock({submitted:true});
 for(const candidate of [
  {quoteId:word(77),expiresAt:now+1000},
  {quoteId:word(77),expiresAt:now-1},
  {route:['unapproved-router'],minimumOut:'420'},
  {recipient:addr(99),minimumOut:'419',slippageBps:10000},
  {network:'421',quoteId:word(77),replay:true},
  {status:'reverted',nonce:word(77)}
 ]) {
  const availability=qualifiedSwapRoute(s,candidate);
  assert.equal(availability.available,false);
 }
 assert.equal(calls.some(x=>x.method==='eth_sendTransaction'),false);
});
