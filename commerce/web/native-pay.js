import {Interface} from 'ethers';

const ZERO='0x0000000000000000000000000000000000000000';
const ZERO32='0x'+'0'.repeat(64);
const ID=/^0x[0-9a-f]{64}$/;
const ADDRESS=/^0x[0-9a-f]{40}$/;
const fail=(reason='native_payment_unavailable')=>{throw new Error(reason)};
const invoiceABI=new Interface(['function getInvoice(bytes32) view returns(tuple(bytes32 merchantId,address merchant,bytes32 metadataHash,bytes3 currency,uint256 amount,uint64 expiresAt,uint64 refundUntil,uint8 mode,uint8 acceptance,bool partialPayments,uint16 quoteMaxSlippageBps,bytes32 acceptedAssetsHash,bytes32 settlementPlanHash,bytes32 tipPolicyHash,bool active))']);
const orderABI=new Interface(['function getOrder(bytes32) view returns(tuple(bytes32 listingId,uint32 listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId,bytes32 paymentRef,bytes32 fulfillmentHash,bytes32 disputeHash,uint8 status,uint64 createdAt,uint64 updatedAt))']);
const merchantABI=new Interface(['function currentPayout(bytes32) view returns(address primary,uint32 version,bytes32 planHash)']);
const paymentABI=new Interface([
  'function derivePaymentId(bytes32,address,address,address,uint256,address,uint256,bytes32,uint256) view returns(bytes32)',
  'function createPayment(bytes32,address,address,address,uint256,address,uint256,bytes32,uint256) returns(bytes32)',
  'function getPayment(bytes32) view returns(tuple(bytes32 invoiceId,address payer,address merchant,address inputAsset,uint256 inputAmount,address settlementAsset,uint256 settlementAmount,bytes32 quoteId,uint256 payerNonce,bytes32 receiptHash,uint256 tipAmount,uint256 refundedAmount,uint8 status))'
]);
const routerABI=new Interface([
  'function executeNativeSplitSettlement(bytes32,address,address[],uint16[],uint8) payable',
  'function consumedPaymentAuthorization(bytes32) view returns(bool)'
]);
function verifyStatus(status,session,now) {
 if(!status||status.paymentAllowed!==true||status.state!=='PAYMENT_SIGNATURE_REQUIRED'||status.paid!==false||status.reserved!==true||!status.provenance?.finalized)fail('canonical_invoice_not_ready');
 if(!ID.test(status.orderId)||!ID.test(status.invoiceId)||!ID.test(status.merchantId)||!ADDRESS.test(status.seller)||!ADDRESS.test(status.buyer)||!/^([1-9][0-9]*)$/.test(String(status.total)))fail('invalid_payment_economics');
 if(status.buyer!==session.address||status.asset!==ZERO||status.provenance.chainId!==session.config.chainId)fail('not_approved_native_420_route');
 if(!session.config.contracts.PaymentRouter420?.verified)fail('approved_pay_router_missing');
 if(now<=0)fail('invalid_time');
}
function assertBinding(session,name) {
 const binding=session.config.contracts[name];
 if(!binding?.verified||!ADDRESS.test(binding.address.toLowerCase()))fail('unapproved_pay_binding');
 return binding.address;
}
async function finalizedRead(session,checked,name,iface,method,args) {
 const to=assertBinding(session,name);
 const data=iface.encodeFunctionData(method,args);
 const result=await session.provider.request({method:'eth_call',params:[{to,data},checked.tag]});
 return iface.decodeFunctionResult(method,result);
}
async function verifyInvoiceOrderPayout(session,status,checked,now) {
 const invoice=(await finalizedRead(session,checked,'InvoiceRegistry420',invoiceABI,'getInvoice',[status.invoiceId]))[0];
 const assetPolicy=session.config.nativePayment;
 if(assetPolicy?.approved!==true||!ID.test(assetPolicy.native420AcceptedAssetsHash)||assetPolicy.native420AcceptedAssetsHash===ZERO32)fail('approved_native_asset_policy_missing');
 if(!invoice.active||invoice.merchantId!==status.merchantId||invoice.merchant.toLowerCase()!==status.seller||invoice.amount.toString()!==String(status.total)||invoice.currency.toLowerCase()!=='0x343230'||Number(invoice.mode)!==0||Number(invoice.acceptance)<1||invoice.partialPayments||Number(invoice.expiresAt)<=Math.floor(now/1000)||invoice.acceptedAssetsHash!==assetPolicy.native420AcceptedAssetsHash||invoice.settlementPlanHash!==ZERO32||invoice.tipPolicyHash!==ZERO32)fail('canonical_invoice_mismatch');
 const order=(await finalizedRead(session,checked,'OrderRegistry420',orderABI,'getOrder',[status.orderId]))[0];
 if(Number(order.status)!==1||order.buyer.toLowerCase()!==status.buyer||order.seller.toLowerCase()!==status.seller||order.paymentAsset.toLowerCase()!==ZERO||order.totalAmount.toString()!==String(status.total))fail('canonical_order_mismatch');
 const payout=await finalizedRead(session,checked,'MerchantRegistry420',merchantABI,'currentPayout',[status.merchantId]);
 const recipient=payout[0].toLowerCase();
 if(!ADDRESS.test(recipient)||recipient===ZERO||Number(payout[1])<1||payout[2]!==ZERO32)fail('canonical_payout_unavailable');
 return recipient;
}
async function guardSend(session,checked,transaction) {
 if(checked.epoch!==session.epoch||checked.address!==session.address)fail('wallet_changed');
 await session.provider.request({method:'eth_call',params:[transaction,checked.tag]});
 if(BigInt(await session.provider.request({method:'eth_chainId'}))!==BigInt(session.config.chainId)||(await session.provider.request({method:'eth_accounts'}))[0]?.toLowerCase()!==checked.address)fail('wallet_changed');
 if(checked.epoch!==session.epoch||checked.address!==session.address)fail('wallet_changed');
 const txHash=await session.provider.request({method:'eth_sendTransaction',params:[transaction]});
 if(!ID.test(txHash)||checked.epoch!==session.epoch)fail('invalid_transaction_response');
 return txHash;
}
export async function createNative420Payment(session,status,{now=Date.now,nonceBytes,approve=()=>false}={}) {
 if(session.pending)fail('wallet_busy');
 verifyStatus(status,session,now());
 const nonce=nonceBytes??crypto.getRandomValues(new Uint8Array(32));
 if(!(nonce instanceof Uint8Array)||nonce.length!==32)fail('invalid_nonce');
 const payerNonce=BigInt('0x'+[...nonce].map(x=>x.toString(16).padStart(2,'0')).join('')).toString();
 if(payerNonce==='0')fail('invalid_nonce');
 session.pending=true;
 try {
   const checked=await session.verify();
   const recipient=await verifyInvoiceOrderPayout(session,status,checked,now());
   const args=[status.invoiceId,status.buyer,status.seller,ZERO,String(status.total),ZERO,String(status.total),ZERO32,payerNonce];
   const paymentId=(await finalizedRead(session,checked,'PaymentRegistry420',paymentABI,'derivePaymentId',args))[0];
   if(!ID.test(paymentId)||paymentId===ZERO32)fail('payment_id_invalid');
   const before=(await finalizedRead(session,checked,'PaymentRegistry420',paymentABI,'getPayment',[paymentId]))[0];
   if(Number(before.status)!==0)fail('payment_replay');
   const tx={from:checked.address,to:assertBinding(session,'PaymentRegistry420'),data:paymentABI.encodeFunctionData('createPayment',args),value:'0x0'};
   if(!await approve({action:'create_payment',payer:status.buyer,seller:status.seller,recipient,asset:ZERO,amount:String(status.total),chainId:session.config.chainId,target:tx.to,paymentId,invoiceId:status.invoiceId}))fail('buyer_cancelled');
   const transactionHash=await guardSend(session,checked,tx);
   return {paymentId,payerNonce,invoiceId:status.invoiceId,orderId:status.orderId,merchantId:status.merchantId,payer:status.buyer,seller:status.seller,recipient,amount:String(status.total),asset:ZERO,transactionHash,state:'PAYMENT_CREATION_BROADCAST_NOT_FINAL',paid:false};
 } finally{session.pending=false;}
}
export async function settleNative420Payment(session,status,created,{now=Date.now,approve=()=>false}={}) {
 if(session.pending)fail('wallet_busy');
 verifyStatus(status,session,now());
 if(!created||!ID.test(created.paymentId)||created.orderId!==status.orderId||created.invoiceId!==status.invoiceId||created.payer!==session.address||created.amount!==String(status.total)||created.asset!==ZERO)fail('payment_plan_mismatch');
 session.pending=true;
 try {
   const checked=await session.verify();
   const recipient=await verifyInvoiceOrderPayout(session,status,checked,now());
   if(recipient!==created.recipient)fail('payout_changed');
   const payment=(await finalizedRead(session,checked,'PaymentRegistry420',paymentABI,'getPayment',[created.paymentId]))[0];
   if(Number(payment.status)!==1||payment.invoiceId!==status.invoiceId||payment.payer.toLowerCase()!==session.address||payment.merchant.toLowerCase()!==status.seller||payment.inputAsset.toLowerCase()!==ZERO||payment.settlementAsset.toLowerCase()!==ZERO||payment.inputAmount.toString()!==created.amount||payment.settlementAmount.toString()!==created.amount||payment.payerNonce.toString()!==created.payerNonce||payment.quoteId!==ZERO32)fail('payment_not_finalized_as_submitted');
   const consumed=(await finalizedRead(session,checked,'PaymentRouter420',routerABI,'consumedPaymentAuthorization',[created.paymentId]))[0];
   if(consumed)fail('settlement_replay');
   const tx={from:checked.address,to:assertBinding(session,'PaymentRouter420'),data:routerABI.encodeFunctionData('executeNativeSplitSettlement',[created.paymentId,session.address,[recipient],[10000],0]),value:'0x'+BigInt(created.amount).toString(16)};
   if(!await approve({action:'send_native_420',payer:status.buyer,seller:status.seller,recipient,asset:ZERO,amount:created.amount,chainId:session.config.chainId,target:tx.to,paymentId:created.paymentId,invoiceId:status.invoiceId}))fail('buyer_cancelled');
   const transactionHash=await guardSend(session,checked,tx);
   return {paymentId:created.paymentId,transactionHash,state:'NATIVE_SETTLEMENT_BROADCAST_NOT_FINAL',paid:false};
 } finally{session.pending=false;}
}
// The canonical quote/health/fee/settlement adapter integration is not configured
// by the Commerce web manifest. No guessed Swap quote or unsafe fallback is allowed.
export function qualifiedSwapRoute() { return {available:false,reason:'No approved executable Pay/Swap quote adapter or verified quote has been configured.'}; }
