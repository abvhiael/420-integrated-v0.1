// R04.8 ordinary High Country market: fixed-price, full-fill, zero-fee BUDS.
// An asset is admitted only by trusted authoritative inventory reconciliation.
// All market and BUDS state MUST share one serializable transaction.
import {BudsLedger,SettlementError} from './buds-ledger.js';
const id = x => {if(typeof x!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(x))throw new SettlementError('invalid market id');return x;};
const amount = x => {if(!Number.isSafeInteger(x)||x<=0)throw new SettlementError('invalid market units');return x;};
const key=(owner,asset)=>JSON.stringify([id(owner),id(asset)]);
const blank=()=>({available:0,reserved:0});
export class HighCountryMarket {
 constructor(store,authority,clock=()=>Date.now()){
   if(typeof store?.transact!=='function'||typeof authority?.verifyAssetReceipt!=='function'
      ||typeof authority?.registeredPrincipal!=='function'||typeof clock!=='function')
     throw new SettlementError('market dependencies missing');
   this.store=store;this.authority=authority;this.clock=clock;
   this.buds=new BudsLedger(store,null);
 }
 // Trust boundary: only independently signed/canonical inventory receipt issuer can admit assets.
 async importAsset(session,op,receipt){
   const owner=id(receipt?.owner),asset=id(receipt?.asset),quantity=amount(receipt?.quantity);
   await this.authority.requireAssetIssuer(session);
   if(await this.authority.verifyAssetReceipt(receipt)!==true)throw new SettlementError('unverified inventory');
   return this.buds.operate(op,s=>{
     if(s.importedAssets.has(id(receipt.receiptId)))throw new SettlementError('duplicate source receipt');
     const k=key(owner,asset),b=s.assets.get(k)||blank();
     if(b.available>Number.MAX_SAFE_INTEGER-quantity)throw new SettlementError('asset overflow');
     b.available+=quantity;s.assets.set(k,b);s.importedAssets.add(receipt.receiptId);
   });
 }
 async list(session,op,listingId,asset,quantity,price,expiresAt){
   const seller=id(await this.authority.registeredPrincipal(session));
   id(listingId);id(asset);amount(quantity);amount(price);
   if(!Number.isSafeInteger(expiresAt)||expiresAt<=this.clock())throw new SettlementError('expired listing');
   return this.buds.operate(op,s=>{
     if(s.listings.has(listingId))throw new SettlementError('listing already used');
     const k=key(seller,asset),b=s.assets.get(k)||blank();
     if(b.available<quantity)throw new SettlementError('inventory unavailable');
     b.available-=quantity;b.reserved+=quantity;s.assets.set(k,b);
     s.listings.set(listingId,{seller,asset,quantity,price,expiresAt,status:'active'});
   });
 }
 async cancel(session,op,listingId){
   const seller=id(await this.authority.registeredPrincipal(session));
   return this.buds.operate(op,s=>{
     const l=s.listings.get(id(listingId));
     if(!l||l.status!=='active'||l.seller!==seller)throw new SettlementError('cannot cancel');
     this._return(s,l);l.status='cancelled';
   });
 }
 async expire(op,listingId){
   return this.buds.operate(op,s=>{
     const l=s.listings.get(id(listingId));
     if(!l||l.status!=='active'||this.clock()<l.expiresAt)throw new SettlementError('cannot expire');
     this._return(s,l);l.status='expired';
   });
 }
 _return(s,l){
   const b=s.assets.get(key(l.seller,l.asset));
   if(!b||b.reserved<l.quantity)throw new SettlementError('broken reservation');
   b.reserved-=l.quantity;b.available+=l.quantity;
 }
 async buy(session,op,listingId){
   if(this.authority.canonicalSettlementRequired===true)
     throw new SettlementError('canonical custody requires finality-gated settlement');
   const buyer=id(await this.authority.registeredPrincipal(session));
   return this.buds.operate(op,s=>{
     const l=s.listings.get(id(listingId));
     if(!l||l.status!=='active'||this.clock()>=l.expiresAt||buyer===l.seller)
       throw new SettlementError('unavailable listing');
     const buyerBuds=this.buds.get(s,buyer),sellerBuds=this.buds.get(s,l.seller);
     if(buyerBuds.available<l.price)throw new SettlementError('insufficient BUDS');
     if(sellerBuds.available>Number.MAX_SAFE_INTEGER-l.price)throw new SettlementError('BUDS overflow');
     const sellerAssets=s.assets.get(key(l.seller,l.asset));
     if(!sellerAssets||sellerAssets.reserved<l.quantity)throw new SettlementError('unbacked listing');
     const receivingKey=key(buyer,l.asset),buyerAssets=s.assets.get(receivingKey)||blank();
     if(buyerAssets.available>Number.MAX_SAFE_INTEGER-l.quantity)throw new SettlementError('asset overflow');
     buyerBuds.available-=l.price;sellerBuds.available+=l.price;
     sellerAssets.reserved-=l.quantity;buyerAssets.available+=l.quantity;
     s.assets.set(receivingKey,buyerAssets);
     l.status='sold';l.buyer=buyer;
     return {buyer,seller:l.seller,asset:l.asset,quantity:l.quantity,price:l.price,fee:0};
   });
 }
}
