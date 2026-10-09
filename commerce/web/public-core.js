export function normalizeCart(lines, next, storeId) {
  if (!/^[a-f0-9]{64}$/.test(storeId)) throw Error('invalid_store');
  const previous=lines.length?lines[0].storeId:storeId;
  if (previous!==storeId) throw Error('single_merchant_only');
  if (!/^0x[a-f0-9]{64}$/.test(next.listingId)||!Number.isInteger(next.revision)||next.revision<1) throw Error('invalid_listing');
  const quantity=Number(next.quantity);
  if (!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000) throw Error('invalid_quantity');
  const items=lines.filter(x=>x.listingId!==next.listingId);
  if(items.length>=20)throw Error('cart_limit');
  return [...items,{storeId,listingId:next.listingId,revision:next.revision,quantity:String(quantity),sku:String(next.sku??'')}];
}
export function getPublicProduct(row){
  if(!row||!row.product_id||!row.store_id)return null;
  const listing=row.listing;
  return {id:row.product_id,storeId:row.store_id,sku:String(row.sku??''),description:String(row.description??''),listingId:row.canonical_listing_id,revision:row.listing_revision,price:listing?.unitPrice??null,asset:listing?.quoteAsset??null,canCart:Boolean(listing&&row.canonical_listing_id&&Number(row.listing_revision)>0)};
}
export function reviewedOrder(plan,expectedChain,now=Date.now()){
  if(!plan||plan.state!=='ORDER_SIGNATURE_REQUIRED'||plan.paymentAllowed!==false||plan.reserved!==false||plan.expiresAt<=now)throw Error('unsafe_order_plan');
  const i=plan.intent;
  if(!i||i.chainId!==expectedChain||i.method!=='createOrder'||i.requiresWalletAuthorization!==true||i.canonicalAuthority!==false||!Array.isArray(i.args)||i.args.length!==6||i.args[0]!==plan.orderId)throw Error('unsafe_order_plan');
  return {orderId:plan.orderId,listingId:i.args[1],revision:i.args[2],quantity:String(i.args[3]),asset:i.args[4],total:String(i.args[5]),target:i.target};
}
export function receiptLabel(status){
  if(!status||status.paid!==true)return 'Payment not confirmed';
  if(!['PAID','FULFILLED','COMPLETED','DISPUTED'].includes(status.state)||!status.provenance?.finalized)return 'Payment not confirmed';
  return 'Canonical payment confirmed';
}
