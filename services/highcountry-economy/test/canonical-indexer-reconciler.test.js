import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalIndexerReconciler} from '../src/canonical-indexer-reconciler.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
const listing='0x'+'11'.repeat(32),op='0x'+'22'.repeat(32),asset='0x'+'33'.repeat(32);
const seller='0x'+'44'.repeat(20),buyer='0x'+'55'.repeat(20);
const setup=()=>{
 const store=new MemoryTransactionFixture();
 store.state.listings.set(listing,{sourceReceiptId:listing});
 store.state.transferIntents.set(op,{sourceReceiptId:listing,status:'prepared'});
 const chain={locked:true,closed:false,settled:false};
 const reader={
  lockedEscrowReceipt:async()=>chain.locked?{asset,quantity:2}:null,
  confirmedListingClosure:async()=>chain.closed,
  confirmedReservedTransfer:async()=>chain.settled?
   {sourceReceiptId:listing,from:seller,to:buyer,asset,quantity:2}:null
 };
 const projection={
  listing:async()=>({id:listing,status:'active',asset,quantity:2}),
  transfer:async()=>({operationId:op,listingId:listing,seller,buyer,asset,quantity:2})
 };
 return {store,chain,reader,projection};
};
test('independent finalized canonical escrow supports matching indexer projection',async()=>{
 const x=setup(),r=new CanonicalIndexerReconciler({store:x.store,reader:x.reader,indexer:x.projection});
 assert.equal((await r.listing(listing)).status,'active');
 x.chain.locked=false;x.chain.settled=true;
 x.projection.listing=async()=>({id:listing,status:'sold',asset,quantity:2,operationId:op});
 assert.equal((await r.listing(listing)).status,'sold');
 assert.equal((await r.transfer(op)).status,'finalized');
});
test('indexer cannot authorize fabricated chain sale or invented buyer',async()=>{
 const x=setup(),r=new CanonicalIndexerReconciler({store:x.store,reader:x.reader,indexer:x.projection});
 x.projection.listing=async()=>({id:listing,status:'sold',asset,quantity:2,operationId:op});
 await assert.rejects(r.listing(listing),/indexer listing divergence/);
 await assert.rejects(r.transfer(op),/indexer transfer diverges/);
 x.chain.locked=false;x.chain.settled=true;
 x.projection.transfer=async()=>({operationId:op,listingId:listing,seller,buyer:seller,asset,quantity:2});
 await assert.rejects(r.transfer(op),/indexer transfer diverges/);
});
test('finalized cancellation requires matching indexer closure but never credits from projection',async()=>{
 const x=setup(),r=new CanonicalIndexerReconciler({store:x.store,reader:x.reader,indexer:x.projection});
 x.chain.locked=false;x.chain.closed=true;
 await assert.rejects(r.listing(listing),/indexer closure divergence/);
 x.projection.listing=async()=>({id:listing,status:'cancelled',asset,quantity:2});
 assert.equal((await r.listing(listing)).status,'closed');
 assert.equal(x.store.state.balances.size,0);
});
test('unknown projections and contradicting chain states fail closed',async()=>{
 const x=setup(),r=new CanonicalIndexerReconciler({store:x.store,reader:x.reader,indexer:x.projection});
 await assert.rejects(r.listing('bad'),/invalid canonical listing/);
 await assert.rejects(r.transfer('bad'),/invalid canonical transfer/);
 x.chain.closed=true;
 await assert.rejects(r.listing(listing),/contradictory finalized escrow/);
});
