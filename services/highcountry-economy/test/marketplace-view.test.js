import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture,BudsLedger} from '../src/buds-ledger.js';
import {HighCountryMarket} from '../src/market.js';
import {HighCountryMarketplaceView} from '../src/marketplace-view.js';
const setup=()=>{
 const store=new MemoryTransactionFixture(),auth={
  canonicalSettlementRequired:false,
  registeredPrincipal:async token=>{if(token==='seller')return 'alice';if(token==='buyer')return 'bob';throw Error('guest');},
  requireAssetIssuer:async token=>{if(token!=='issuer')throw Error('wrong issuer');},
  verifyAssetReceipt:async()=>true
 },market=new HighCountryMarket(store,auth,()=>100);
 const view=new HighCountryMarketplaceView({store,identity:auth,market,clock:()=>100});
 const ledger=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>true});
 return {store,market,view,ledger};
};
test('browse hides seller listing, inventory is principal-scoped and history reflects atomic trade',async()=>{
 const {market,view,ledger}=setup();
 await market.importAsset('issuer','import',{receiptId:'lot-source',owner:'alice',asset:'lot',quantity:4});
 await ledger.earn('fund','bob','reward','proof',100);
 await market.list('seller','list','one','lot',2,35,200);
 const seller=await view.snapshot('seller'),buyer=await view.snapshot('buyer');
 assert.equal(seller.inventory[0].available,2);
 assert.equal(seller.inventory[0].reserved,2);
 assert.equal(seller.browse.length,0);
 assert.equal(buyer.browse.length,1);
 assert.equal(buyer.inventory.length,0);
 assert.deepEqual(buyer.buds,{available:100,reserved:0});
 await market.buy('buyer','buy','one');
 const later=await view.snapshot('buyer');
 assert.equal(later.history[0].status,'sold');
 assert.equal(later.inventory[0].available,2);
 assert.equal(later.buds.available,65);
 assert.equal(later.feePolicy,'zero');
});
test('dispute filing cannot refund BUDS, mint goods, duplicate notices, or impersonate party',async()=>{
 const {store,market,view,ledger}=setup();
 await market.importAsset('issuer','import',{receiptId:'lot-source',owner:'alice',asset:'lot',quantity:2});
 await ledger.earn('fund','bob','reward','proof',100);
 await market.list('seller','list','one','lot',2,30,200);
 await market.buy('buyer','buy','one');
 const before={balances:structuredClone(store.state.balances),assets:structuredClone(store.state.assets)};
 const result=await view.dispute('buyer','dispute-one','one','missing-item');
 assert.equal(result.settlementChanged,false);
 assert.equal((await view.snapshot('buyer')).disputes[0].status,'open');
 assert.deepEqual(store.state.balances,before.balances);
 assert.deepEqual(store.state.assets,before.assets);
 await assert.rejects(view.dispute('buyer','dispute-two','one','missing-item'),/dispute already open/);
 await assert.rejects(view.dispute('buyer','dispute-one','one','payment'),/replayed dispute/);
 await assert.rejects(view.dispute('buyer','bad-dispute','one','free-credits'),/invalid dispute category/);
 await assert.rejects(view.dispute('guest','guest-dispute','one','payment'),/guest/);
});
test('server read model never identifies provisional expired listings as successfully released',async()=>{
 const {market,view}=setup();
 await market.importAsset('issuer','import',{receiptId:'lot-source',owner:'alice',asset:'lot',quantity:2});
 await market.list('seller','list','one','lot',2,30,200);
 view.clock=()=>200;
 const snapshot=await view.snapshot('seller');
 assert.equal(snapshot.history[0].status,'expired-pending-release');
 assert.equal(snapshot.inventory[0].reserved,2);
 await market.expire('expire','one').catch(()=>{}); // Market clock remains 100, cannot execute early.
 assert.equal((await view.snapshot('seller')).history[0].status,'expired-pending-release');
});

test('only authorized market operator may review then close disputes without credit mutations',async()=>{
 const {store,market,view,ledger}=setup();
 await market.importAsset('issuer','import',{receiptId:'source',owner:'alice',asset:'lot',quantity:2});
 await ledger.earn('fund','bob','source','proof',30);
 await market.list('seller','list','one','lot',2,30,200);
 await market.buy('buyer','buy','one');
 await view.dispute('buyer','dispute','one','payment');
 const before=structuredClone(store.state.balances);
 await assert.rejects(view.review('buyer','op0','dispute','under-review','evidence'),/dispute review disabled/);
 view.identity.requireMarketOperator=async token=>{if(token!=='operator')throw Error('denied operator');};
 await assert.rejects(view.review('buyer','op1','dispute','under-review','evidence'),/denied operator/);
 await assert.rejects(view.review('operator','op2','dispute','closed-no-adjustment','evidence'),/review required/);
 assert.equal((await view.review('operator','op3','dispute','under-review','evidence')).status,'under-review');
 assert.equal((await view.review('operator','op4','dispute','closed-no-adjustment','evidence2')).status,'closed-no-adjustment');
 await assert.rejects(view.review('operator','op5','dispute','referred','evidence3'),/not reviewable/);
 assert.equal((await view.snapshot('buyer')).disputes[0].decision,'no-ledger-adjustment');
 assert.deepEqual(store.state.balances,before);
});

test('canonical buyer sees prepared escrow as pending, never completed or wallet-free',async()=>{
 const {store,market,view}=setup();
 market.authority.canonicalSettlementRequired=true;
 store.state.listings.set('canonical',{seller:'alice',asset:'0xasset',quantity:1,price:25,
  expiresAt:200,status:'settling',sourceReceiptId:'canonical'});
 store.state.transferIntents.set('transfer',{listingId:'canonical',buyer:'bob',status:'prepared'});
 const buyer=await view.snapshot('buyer');
 assert.equal(buyer.mode,'canonical');
 assert.equal(buyer.walletRequired,true);
 assert.equal(buyer.history[0].listing,'canonical');
 assert.equal(buyer.history[0].status,'settling');
 assert.equal(buyer.history[0].buyer,'bob');
 assert.equal(buyer.browse.length,0);
});
