import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalMarketSettlement} from '../src/canonical-settlement.js';
import {HighCountryMarket} from '../src/market.js';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){
 const store=new MemoryTransactionFixture();
 const state={finalized:false,cancelled:false};
 const authority={
  registeredPrincipal:async who=>who==='buyer'?'bob':who==='seller'?'alice':Promise.reject(Error('guest')),
  requireAssetIssuer:async who=>{if(who!=='inventory')throw Error('issuer');},
  verifyAssetReceipt:async r=>r.receiptId==='verified:1',
  confirmedReservedTransfer:async operationId=>state.finalized?{
    finalized:true,operationId,sourceReceiptId:'verified:1',asset:'lot:1',from:'alice',to:'bob',quantity:2
  }:null,
  proveUnexecutedAndCancelled:async()=>state.cancelled
 };
 const market=new HighCountryMarket(store,authority,()=>100);
 const settle=new CanonicalMarketSettlement(store,authority,()=>100);
 const buds=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>false});
 return {store,state,market,settle,buds};
}
async function listed(t) {
 await t.market.importAsset('inventory','import',{receiptId:'verified:1',owner:'alice',asset:'lot:1',quantity:3});
 await t.buds.earn('earn','bob','reward','proof',80);
 await t.market.list('seller','list','listing','lot:1',2,60,1000);
}
test('canonical transfer finality gates BUDS and conserved asset delivery',async()=>{
 const t=setup();await listed(t);
 await t.settle.prepare('buyer','prepare','listing','transfer:1');
 assert.equal(t.store.state.balances.get('bob').reserved,60);
 await assert.rejects(t.settle.finalize('early','transfer:1'));
 assert.equal(t.store.state.transferIntents.get('transfer:1').sourceReceiptId,'verified:1');
 await assert.rejects(t.market.cancel('seller','cancel','listing'));
 await assert.rejects(t.market.buy('buyer','buy','listing'));
 t.state.finalized=true;
 const done=await t.settle.finalize('finalize','transfer:1');
 assert.equal(done.status,'finalized');
 assert.deepEqual(t.store.state.balances.get('bob'),{available:20,reserved:0});
 assert.equal(t.store.state.balances.get('alice').available,60);
 assert.equal(t.store.state.assets.get(JSON.stringify(['bob','lot:1'])).available,2);
 await assert.rejects(t.settle.finalize('replay','transfer:1'));
 await assert.rejects(t.settle.abort('refund','transfer:1'));
});
test('cancel only after irreversible proof of unexecuted canonical transfer',async()=>{
 const t=setup();await listed(t);
 await t.settle.prepare('buyer','prepare','listing','transfer:2');
 await assert.rejects(t.settle.abort('abort-early','transfer:2'));
 assert.equal(t.store.state.balances.get('bob').reserved,60);
 t.state.cancelled=true;
 await t.settle.abort('abort','transfer:2');
 assert.equal(t.store.state.balances.get('bob').reserved,0);
 assert.equal(t.store.state.balances.get('bob').available,80);
 assert.equal(t.store.state.listings.get('listing').status,'active');
 await assert.rejects(t.settle.finalize('late','transfer:2'));
 await assert.rejects(t.settle.prepare('buyer','duplicate','listing','transfer:2'));
});
test('durable intent survives restart and re-entry cannot sell twice',async()=>{
 const t=setup();await listed(t);
 await t.settle.prepare('buyer','prepare','listing','transfer:3');
 const second=new CanonicalMarketSettlement(t.store,t.settle.authority,()=>100);
 await assert.rejects(second.prepare('buyer','race','listing','transfer:4'));
 t.state.finalized=true;
 await second.finalize('finalize','transfer:3');
 assert.equal(t.store.state.issued,80);
});
