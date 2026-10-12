// R04.8 canonical settlement: recoverable two-domain intent, NOT a cross-chain/database transaction.
// Stage buyer's BUDS and freeze the listing before any on-chain transfer.
// Only a finalized, independently verified R04.1 transfer receipt authorizes BUDS payout.
// Every canonical transfer uses deterministic operation identity so crash/retry cannot pay twice.
import {BudsLedger,SettlementError} from './buds-ledger.js';
const id=x=>{if(typeof x!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(x))throw new SettlementError('invalid identity');return x;};
export class CanonicalMarketSettlement {
 constructor(store,authority,clock=()=>Date.now()){
  if(typeof store?.transact!=='function'||typeof authority?.registeredPrincipal!=='function'
     ||typeof authority?.confirmedReservedTransfer!=='function'
     ||typeof authority?.proveUnexecutedAndCancelled!=='function'
     ||typeof clock!=='function')throw new SettlementError('missing canonical authority');
  this.store=store;this.authority=authority;this.clock=clock;this.buds=new BudsLedger(store,null);
 }
 // Atomic database reservation and listing lock. No chain call under SQL locks.
 async prepare(session,op,listingId,transferOp){
  const buyer=id(await this.authority.registeredPrincipal(session));id(listingId);id(transferOp);
  return this.buds.operate(op,s=>{
   if(s.transferIntents.has(transferOp))throw new SettlementError('duplicate transfer intent');
   const l=s.listings.get(listingId);
   if(!l||l.status!=='active'||this.clock()>=l.expiresAt||l.seller===buyer)
     throw new SettlementError('unavailable listing');
   const funds=this.buds.get(s,buyer);
   if(funds.available<l.price)throw new SettlementError('insufficient BUDS');
   const asset=s.assets.get(JSON.stringify([l.seller,l.asset]));
   if(!asset||asset.reserved<l.quantity)throw new SettlementError('missing inventory');
   funds.available-=l.price;funds.reserved+=l.price;
   l.status='settling';
   const intent={transferOp,listingId,buyer,seller:l.seller,asset:l.asset,
    quantity:l.quantity,price:l.price,sourceReceiptId:l.sourceReceiptId||null,status:'prepared'};
   s.transferIntents.set(transferOp,intent);
   return {...intent};
  });
 }
 // Caller supplies NO arbitrary transfer facts; independently inspect canonical receipt.
 async finalize(op,transferOp){
  id(transferOp);
  const receipt=await this.authority.confirmedReservedTransfer(transferOp);
  return this.buds.operate(op,s=>{
   const t=s.transferIntents.get(transferOp);
   if(!t||t.status!=='prepared')throw new SettlementError('missing prepared intent');
   const l=s.listings.get(t.listingId);
   if(!l||l.status!=='settling')throw new SettlementError('listing no longer settling');
   if(!receipt||receipt.finalized!==true||receipt.operationId!==transferOp
      ||receipt.asset!==t.asset||receipt.from!==t.seller
      ||receipt.to!==t.buyer||receipt.quantity!==t.quantity
      ||(t.sourceReceiptId!==null&&receipt.sourceReceiptId!==t.sourceReceiptId))
      throw new SettlementError('no matching finalized canonical transfer');
   const buyer=this.buds.get(s,t.buyer),seller=this.buds.get(s,t.seller);
   if(buyer.reserved<t.price||seller.available>Number.MAX_SAFE_INTEGER-t.price)
     throw new SettlementError('BUDS settlement unavailable');
   const sellerKey=JSON.stringify([t.seller,t.asset]);
   const sender=s.assets.get(sellerKey);
   if(!sender||sender.reserved<t.quantity)throw new SettlementError('inventory mismatch');
   const buyerKey=JSON.stringify([t.buyer,t.asset]),receiver=s.assets.get(buyerKey)||{available:0,reserved:0};
   if(receiver.available>Number.MAX_SAFE_INTEGER-t.quantity)throw new SettlementError('asset overflow');
   buyer.reserved-=t.price;seller.available+=t.price;
   sender.reserved-=t.quantity;receiver.available+=t.quantity;s.assets.set(buyerKey,receiver);
   t.status='finalized';l.status='sold';l.buyer=t.buyer;
   return {...t};
  });
 }
 // Refund ONLY when independent chain source proves no transfer is final or possible.
 // An unknown/pending chain status MUST strand funds for reconciliation, not double spend.
 async abort(op,transferOp){
  id(transferOp);
  const safe=await this.authority.proveUnexecutedAndCancelled(transferOp);
  if(safe!==true)throw new SettlementError('canonical transfer unresolved');
  return this.buds.operate(op,s=>{
   const t=s.transferIntents.get(transferOp);
   if(!t||t.status!=='prepared')throw new SettlementError('not refundable');
   const l=s.listings.get(t.listingId),buyer=this.buds.get(s,t.buyer);
   if(!l||l.status!=='settling'||buyer.reserved<t.price)throw new SettlementError('inconsistent reservation');
   buyer.reserved-=t.price;buyer.available+=t.price;
   l.status='active';t.status='cancelled';
   return {...t};
  });
 }
}
