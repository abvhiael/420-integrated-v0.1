// HC-NEXT-4.3: the indexer is a non-authoritative projection, never payout evidence.
// Every projection is reconciled against independently finalized canonical chain state.
import {SettlementError} from './buds-ledger.js';
const hex32=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
const normalize=x=>typeof x==='string'?x.toLowerCase():x;
export class CanonicalIndexerReconciler {
 constructor({store,reader,indexer}){
  if(typeof store?.transact!=='function'||typeof reader?.confirmedReservedTransfer!=='function'
   ||typeof reader?.confirmedListingClosure!=='function'||typeof reader?.lockedEscrowReceipt!=='function'
   ||typeof indexer?.listing!=='function'||typeof indexer?.transfer!=='function')
   throw new SettlementError('untrusted indexer reconciliation dependencies');
  Object.assign(this,{store,reader,indexer});
 }
 async listing(listingId){
  if(!hex32(listingId))throw new SettlementError('invalid canonical listing id');
  const local=await this.store.transact(s=>s.listings.get(listingId));
  if(!local||local.sourceReceiptId!==listingId)throw new SettlementError('unknown escrow listing');
  const projected=await this.indexer.listing(listingId);
  if(!projected||normalize(projected.id)!==normalize(listingId))
   throw new SettlementError('indexer listing missing');
  const locked=await this.reader.lockedEscrowReceipt(listingId,1);
  const closed=await this.reader.confirmedListingClosure(listingId,1);
  if(locked&&closed)throw new SettlementError('contradictory finalized escrow states');
  if(locked){
   if(projected.status!=='active'||normalize(projected.asset)!==normalize(locked.asset)
      ||projected.quantity!==locked.quantity)
    throw new SettlementError('indexer listing divergence');
   return {status:'active',finalized:true,listingId};
  }
  if(closed){
   if(!['cancelled','expired'].includes(projected.status))
    throw new SettlementError('indexer closure divergence');
   return {status:'closed',finalized:true,listingId};
  }
  // A sold listing may be reconciled only via exact operation evidence.
  if(projected.status==='sold'&&hex32(projected.operationId)){
   const transfer=await this.reader.confirmedReservedTransfer(projected.operationId,1);
   if(transfer&&normalize(transfer.sourceReceiptId)===normalize(listingId))
    return {status:'sold',finalized:true,listingId,operationId:projected.operationId};
  }
  throw new SettlementError('indexer lacks independently finalized escrow evidence');
 }
 async transfer(operationId){
  if(!hex32(operationId))throw new SettlementError('invalid canonical transfer id');
  const intent=await this.store.transact(s=>s.transferIntents.get(operationId));
  if(!intent||intent.sourceReceiptId===null)throw new SettlementError('unknown canonical intent');
  const projected=await this.indexer.transfer(operationId);
  const confirmed=await this.reader.confirmedReservedTransfer(operationId,1);
  if(!projected||!confirmed||normalize(projected.operationId)!==normalize(operationId)
    ||normalize(projected.listingId)!==normalize(intent.sourceReceiptId)
    ||normalize(confirmed.sourceReceiptId)!==normalize(intent.sourceReceiptId)
    ||normalize(projected.buyer)!==normalize(confirmed.to)
    ||normalize(projected.seller)!==normalize(confirmed.from)
    ||normalize(projected.asset)!==normalize(confirmed.asset)
    ||projected.quantity!==confirmed.quantity)
   throw new SettlementError('indexer transfer diverges from finalized chain');
  return {operationId,status:'finalized',sourceReceiptId:intent.sourceReceiptId};
 }
}
