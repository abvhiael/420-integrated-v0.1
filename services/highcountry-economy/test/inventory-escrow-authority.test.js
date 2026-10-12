import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InventoryEscrowAuthority} from '../src/inventory-escrow-authority.js';
import {HighCountryMarket} from '../src/market.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
const receipt={receiptId:'proof:1',owner:'alice',asset:'lot:1',quantity:2,
 chainId:420,registry:'registry:v1',issuer:'inventory:issuer'};
function setup(override={}){
 const identity={registeredPrincipal:async()=> 'alice',requireAssetIssuer:async s=>{if(s!=='trusted')throw Error('not trusted');}};
 const inventory={lockedEscrowReceipt:async()=>({...receipt,locked:true,finalized:true,consumed:false,...override})};
 return new InventoryEscrowAuthority({identity,inventory,issuer:'inventory:issuer',chainId:420,registry:'registry:v1',confirmations:3});
}
test('requires finalized canonical escrow and trusted issuer',async()=>{
 const market=new HighCountryMarket(new MemoryTransactionFixture(),setup());
 await assert.rejects(market.importAsset('guest','operation',receipt));
 await market.importAsset('trusted','operation',receipt);
 await assert.rejects(market.importAsset('trusted','replay',receipt));
});
test('rejects forged, stale, unescrowed, reorged or mismatched inventory',async()=>{
 for(const override of [{locked:false},{finalized:false},{consumed:true},{quantity:3},{owner:'mallory'},{asset:'other'},{chainId:1},{issuer:'rogue'},{registry:'rogue'}]){
  assert.equal(await setup(override).verifyAssetReceipt(receipt),false);
 }
 assert.equal(await setup().verifyAssetReceipt({...receipt,quantity:3}),false);
 assert.equal(await setup().verifyAssetReceipt({...receipt,chainId:1}),false);
 assert.equal(await setup().verifyAssetReceipt({...receipt,receiptId:'guest-save'}),false);
});
test('rejects unconfigured production inventory adapters',()=>{
 assert.throws(()=>new InventoryEscrowAuthority({identity:{},inventory:{},issuer:'x',chainId:420,registry:'y'}));
});

test('canonical listing requires the same on-chain escrow identity and cannot bypass finality',async()=>{
 const market=new HighCountryMarket(new MemoryTransactionFixture(),setup());
 await market.importAsset('trusted','import',receipt);
 await assert.rejects(market.list('alice','bad','different-listing','lot:1',2,10,Date.now()+100000));
 await market.list('alice','correct','proof:1','lot:1',2,10,Date.now()+100000);
 await assert.rejects(market.buy('alice','bypass','proof:1'));
 await assert.rejects(market.cancel('alice','bypass-cancel','proof:1'));
 await assert.rejects(market.expire('bypass-expire','proof:1'));
});
