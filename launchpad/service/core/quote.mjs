import {call,checkoutContext,hash,address,readSale} from './consumer.mjs';
import {hexUtf8,wordHex,wordAddress,wordUint,decodeUint,decodeAddress,strip0x,encodeStatic} from './abi.mjs';
const NONZERO=/^0x(?!0{64}$)[0-9a-fA-F]{64}$/;
function w(data,index){const s=strip0x(data),v=s.slice(index*64,(index+1)*64);if(v.length!==64)throw new Error('truncated quote ABI');return '0x'+v.toLowerCase();}
async function component(rpc,registry,service){
  const id=await rpc.call('web3_sha3',[hexUtf8(service)]);
  const implementation=decodeAddress(await call(rpc,registry,'resolve(bytes32)',[wordHex(id)]));
  const code=await rpc.call('eth_getCode',[implementation,'latest']);
  if(!code||code==='0x')throw new Error('420Pay component has no runtime code: '+service);
  const expected=w(await call(rpc,registry,'runtimeCodeHash(bytes32)',[wordHex(id)]),0);
  const actual=await rpc.call('web3_sha3',[code]);
  if(expected.toLowerCase()!==actual.toLowerCase())throw new Error('420Pay component runtime codehash mismatch: '+service);
  return implementation;
}
function positive(v){if(typeof v!=='string'||!/^[1-9][0-9]{0,77}$/.test(v)||BigInt(v)>=2n**256n)throw new Error('positive uint256 amount required');return BigInt(v);}
export async function convertedCheckoutQuote(rpc,rt,payload){
  const account=address(payload.account),saleId=hash(payload.saleId);
  const base=await checkoutContext(rpc,rt,saleId,account,payload.amount,payload.nonce);
  if(!base.canContribute)throw new Error('campaign no longer eligible for new 420Pay checkout');
  if(!base.registered||!base.invoiceExists||base.paymentId)throw new Error('conversion requires a registered unpaid canonical invoice');
  const marketId=hash(payload.marketId),inputAsset=address(payload.inputAsset),maxInput=positive(String(payload.maxInput)),
    minOutput=positive(String(payload.minOutput));
  const sale=await readSale(rpc,rt,saleId),settlement=address(sale.paymentAsset);
  // The requested minimum must cover the exact Launchpad invoice principal.
  if(minOutput<BigInt(base.amount))throw new Error('minimum conversion output below campaign principal');
  if(inputAsset===settlement||/^0x0{40}$/i.test(inputAsset))throw new Error('invalid canonical conversion input asset');
  const payRegistry=decodeAddress(await call(rpc,rt.crowdfundingIntegrationAddress,'paymentRegistry()'));
  const resolver=decodeAddress(await call(rpc,payRegistry,'registry()'));
  // The Pay payment registry itself is codehash-bound, as is each invoked component.
  const officialPayments=await component(rpc,resolver,'420/APP/420PAY/PAYMENT_REGISTRY');
  if(officialPayments.toLowerCase()!==payRegistry.toLowerCase())throw new Error('420Pay registry identity mismatch');
  const [router,quoteSource,marketRegistry]=await Promise.all([
    component(rpc,resolver,'420/APP/420PAY/PAYMENT_ROUTER'),
    component(rpc,resolver,'420/APP/420PAY/NATIVE_QUOTE_SOURCE'),
    component(rpc,resolver,'420/APP/420SWAP/CANONICAL_MARKET_REGISTRY')
  ]);
  const market=await call(rpc,marketRegistry,'markets(bytes32)',[wordHex(marketId)]);
  const pool=decodeAddress(market,0),asset0=decodeAddress(market,1),asset1=decodeAddress(market,2);
  if(/^0x0{40}$/i.test(pool)||!decodeUint(market,5)||
    !(asset0.toLowerCase()===inputAsset&&asset1.toLowerCase()===settlement||
      asset1.toLowerCase()===inputAsset&&asset0.toLowerCase()===settlement))throw new Error('market not approved for this conversion');
  const quotedAt=BigInt(base.source.at);
  const req=[wordHex(base.invoiceId),wordAddress(account),wordUint(BigInt(payload.nonce)),wordUint(quotedAt),
    wordHex(marketId),wordAddress(inputAsset),wordAddress(settlement),wordUint(maxInput),wordUint(minOutput)];
  const data=await call(rpc,quoteSource,'quoteConversion((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256))',req);
  const quoteId=w(data,0),quotedSettlement=decodeUint(data,6),conversionFee=decodeUint(data,7),
    impact=decodeUint(data,8),merchant=decodeAddress(data,10),recipient=decodeAddress(data,11),
    invoiceAmount=decodeUint(data,12),expiresAt=decodeUint(data,13);
  if(!NONZERO.test(quoteId)||w(data,1)!==marketId||decodeAddress(data,2).toLowerCase()!==inputAsset||
    decodeAddress(data,3).toLowerCase()!==settlement||decodeUint(data,4)!==maxInput||decodeUint(data,5)!==minOutput||
    quotedSettlement!==BigInt(base.amount)||invoiceAmount!==BigInt(base.amount)||
    merchant.toLowerCase()!==sale.proceedsReceiver.toLowerCase()||recipient.toLowerCase()!==sale.proceedsReceiver.toLowerCase()||
    decodeUint(data,9)!==quotedAt||quotedAt>expiresAt)throw new Error('converted Pay quote does not settle exact campaign amount');
  if(conversionFee>maxInput||impact>10000n)throw new Error('invalid 420Pay fee or slippage');
  const allowed=decodeUint(await call(rpc,inputAsset,'allowance(address,address)',[wordAddress(account),wordAddress(pool)]));
  const balance=decodeUint(await call(rpc,inputAsset,'balanceOf(address)',[wordAddress(account)]));
  const paySelector=await rpc.selector('payConvertedInvoice((bytes32,address,uint256,uint64,bytes32,address,address,uint256,uint256),bytes32)');
  return {schema:'420-launchpad-conversion-quote-v1',canonical:true,source:base.source,
    saleId,invoiceId:base.invoiceId,amount:base.amount,nonce:String(payload.nonce),marketId,inputAsset,
    settlementAsset:settlement,pool,quoteId,quoteSource,paymentRouterAddress:router,
    maxInput:maxInput.toString(),minOutput:minOutput.toString(),quotedSettlement:quotedSettlement.toString(),
    conversionFee:conversionFee.toString(),slippageBps:impact.toString(),quotedAt:quotedAt.toString(),
    expiresAt:Number(expiresAt<quotedAt+42n?expiresAt:quotedAt+42n),allowance:allowed.toString(),balance:balance.toString(),
    approveRequired:allowed<maxInput,canPay:balance>=maxInput&&allowed>=maxInput,
    transaction:{to:router,data:encodeStatic(paySelector,[...req,wordHex(quoteId)]),value:'0x0'},
    approval:{to:inputAsset,spender:pool,amount:maxInput.toString()}};
}
export async function convertedCheckoutReview(rpc,rt,kind,payload){
  const q=await convertedCheckoutQuote(rpc,rt,payload);
  if(q.expiresAt<=q.source.at)throw new Error('420Pay quote expired; refresh');
  if(BigInt(q.balance)<BigInt(q.maxInput))throw new Error('insufficient token balance');
  if(kind==='approve-conversion'){
    if(!q.approveRequired)throw new Error('current token allowance already sufficient');
    const sel=await rpc.selector('approve(address,uint256)');
    return {schema:'420-launchpad-transaction-review-v1',canonical:true,kind,summary:
      'Approve exact '+q.maxInput+' input token units for the canonical market pool '+q.pool+'. Re-quote before checkout.',
      transaction:{to:q.inputAsset,data:encodeStatic(sel,[wordAddress(q.pool),wordUint(q.maxInput)]),value:'0x0'}};
  }
  if(kind==='pay-conversion'){
    if(!q.canPay)throw new Error('token balance or allowance insufficient; approve and re-quote');
    return {schema:'420-launchpad-transaction-review-v1',canonical:true,kind,summary:
      '420Pay converted checkout. Spend '+q.maxInput+' input units (fee '+q.conversionFee+
      '), receive exact '+q.quotedSettlement+' settlement units. Quote expires at '+q.expiresAt+'.',
      transaction:q.transaction};
  }
  throw new Error('unsupported 420Pay quote action');
}
