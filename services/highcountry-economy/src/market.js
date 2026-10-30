// R04.8 ordinary High Country market: fixed-price, full-fill, zero-fee BUDS.
// An asset is admitted only by trusted authoritative inventory reconciliation.
// All market and BUDS state MUST share one serializable transaction.
import {BudsLedger,SettlementError} from './buds-ledger.js';
import {custodyUnitId,CUSTODY_SCHEMA,custodyState,reserveListedUnits,settleListedUnits} from './custody-records.js';
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
     if(s.assetSources.has(k)&&s.assetSources.get(k)!==receipt.receiptId)
       throw new SettlementError('mixed escrow provenance');
     if(b.available>Number.MAX_SAFE_INTEGER-quantity)throw new SettlementError('asset overflow');
     custodyState(s);
     const receiptId=id(receipt.receiptId);
     if(quantity>10000)throw new SettlementError('custody receipt too large');
     if(s.custodyReceipts.has(receiptId))throw new SettlementError('duplicate custody receipt');
     for(let i=0;i<quantity;i++){const unitId=custodyUnitId(receiptId,i);if(s.custodyUnits.has(unitId))throw new SettlementError('duplicate custody unit');s.custodyUnits.set(unitId,{schemaVersion:CUSTODY_SCHEMA,unitId,receiptId,unitIndex:i,owner,assetId:asset,state:'available',reservationId:null,revision:1});}
     s.custodyReceipts.set(receiptId,{schemaVersion:CUSTODY_SCHEMA,owner,assetId:asset,quantity});
     b.available+=quantity;s.assets.set(k,b);s.importedAssets.add(receipt.receiptId);
     s.assetSources.set(k,id(receipt.receiptId));
   });
 }
 async list(session,op,listingId,asset,quantity,price,expiresAt){
   if(this.authority.requireMarketOpen)await this.authority.requireMarketOpen();
   const seller=id(await this.authority.registeredPrincipal(session));
   id(listingId);id(asset);amount(quantity);amount(price);
   if(!Number.isSafeInteger(expiresAt)||expiresAt<=this.clock())throw new SettlementError('expired listing');
   return this.buds.operate(op,s=>{
     if(s.listings.has(listingId))throw new SettlementError('listing already used');
     const k=key(seller,asset),b=s.assets.get(k)||blank();
     if(this.authority.canonicalSettlementRequired===true&&s.assetSources.get(k)!==listingId)
       throw new SettlementError('canonical listing must match escrow receipt');
     if(b.available<quantity)throw new SettlementError('inventory unavailable');
     const unitIds=reserveListedUnits(s,{owner:seller,assetId:asset,listingId,quantity});
     s.listings.set(listingId,{listingId,unitIds,seller,asset,quantity,price,expiresAt,status:'active',
       sourceReceiptId:s.assetSources.get(k)||null});
   });
 }
 async cancel(session,op,listingId){
   if(this.authority.canonicalSettlementRequired===true)
     throw new SettlementError('canonical cancellation requires finalized escrow closure');
   const seller=id(await this.authority.registeredPrincipal(session));
   return this.buds.operate(op,s=>{
     const l=s.listings.get(id(listingId));
     if(!l||l.status!=='active'||l.seller!==seller)throw new SettlementError('cannot cancel');
     this._return(s,l);l.status='cancelled';
   });
 }
 async expire(op,listingId){
   if(this.authority.canonicalSettlementRequired===true)
     throw new SettlementError('canonical expiry requires finalized escrow closure');
   return this.buds.operate(op,s=>{
     const l=s.listings.get(id(listingId));
     if(!l||l.status!=='active'||this.clock()<l.expiresAt)throw new SettlementError('cannot expire');
     this._return(s,l);l.status='expired';
   });
 }
 _return(s,l){settleListedUnits(s,{listing:l});}
 async buy(session,op,listingId){
   if(this.authority.requireMarketOpen)await this.authority.requireMarketOpen();
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
     // Preserve verified receipt lineage through resale and reject incompatible merges.
     const provenance=s.assetSources.get(receivingKey);
     if(!l.sourceReceiptId||(provenance&&provenance!==l.sourceReceiptId))
       throw new SettlementError('conflicting inventory provenance');
     settleListedUnits(s,{listing:l,buyer});
     buyerBuds.available-=l.price;sellerBuds.available+=l.price;
     s.assetSources.set(receivingKey,l.sourceReceiptId);
     l.status='sold';l.buyer=buyer;
     return {buyer,seller:l.seller,asset:l.asset,quantity:l.quantity,price:l.price,fee:0};
   });
 }
}
