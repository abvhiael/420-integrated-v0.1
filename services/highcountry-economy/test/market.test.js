import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryMarket} from '../src/market.js';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){
 const store=new MemoryTransactionFixture(),clock={now:100};
 const authority={
  async registeredPrincipal(s){if(s==='seller')return 'alice';if(s==='buyer')return 'bob';throw Error('unauthorized');},
  async requireAssetIssuer(s){if(s!=='inventory-service')throw Error('untrusted inventory');},
  async verifyAssetReceipt(r){return r.receiptId.startsWith('verified:');}
 };
 const market=new HighCountryMarket(store,authority,()=>clock.now);
 const buds=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000,authorizeSink:()=>true});
 return {store,clock,market,buds};
}
const receipt=(id='verified:1',quantity=3)=>({receiptId:id,owner:'alice',asset:'lot:1',quantity});
test('atomic full-fill BUDS/asset transfer and one winning buyer',async()=>{
 const {store,market,buds}=setup();
 await market.importAsset('inventory-service','import',receipt());
 await buds.earn('earn','bob','approved','proof',100);
 await market.list('seller','list','listing','lot:1',2,60,200);
 await market.buy('buyer','buy','listing');
 assert.deepEqual(store.state.balances.get('bob'),{available:40,reserved:0});
 assert.equal(store.state.balances.get('alice').available,60);
 assert.equal(store.state.assets.get(JSON.stringify(['alice','lot:1'])).available,1);
 assert.equal(store.state.assets.get(JSON.stringify(['bob','lot:1'])).available,2);
 await assert.rejects(market.buy('buyer','buy2','listing'));
 await assert.rejects(market.cancel('seller','cancel','listing'));
 assert.equal(store.state.operations.has('buy2'),false);
});
test('cancel and expiry refund, with no duplicate listing or inventory mint',async()=>{
 const {store,market,clock}=setup();
 await market.importAsset('inventory-service','import',receipt());
 await assert.rejects(market.importAsset('inventory-service','import2',receipt()));
 await market.list('seller','list','one','lot:1',2,30,200);
 await assert.rejects(market.list('seller','double','one','lot:1',1,30,200));
 await assert.rejects(market.list('seller','over','two','lot:1',2,30,200));
 await assert.rejects(market.cancel('buyer','unauthorized','one'));
 await market.cancel('seller','cancel','one');
 assert.equal(store.state.assets.get(JSON.stringify(['alice','lot:1'])).available,3);
 await market.list('seller','list2','two','lot:1',3,30,110);
 clock.now=110;
 await assert.rejects(market.buy('buyer','late','two'));
 await market.expire('expire','two');
 assert.equal(store.state.assets.get(JSON.stringify(['alice','lot:1'])).reserved,0);
 await assert.rejects(market.expire('reexpire','two'));
});
test('bad identity, forged inventory, insufficient funds and self trade rollback',async()=>{
 const {store,market,buds}=setup();
 await assert.rejects(market.importAsset('buyer','x',receipt()));
 await assert.rejects(market.importAsset('inventory-service','y',receipt('local-save')));
 await market.importAsset('inventory-service','import',receipt());
 await market.list('seller','list','one','lot:1',2,30,200);
 await assert.rejects(market.buy('seller','self','one'));
 await assert.rejects(market.buy('buyer','unfunded','one'));
 assert.equal(store.state.listings.get('one').status,'active');
 await buds.earn('earn','bob','approved','proof',30);
 await market.buy('buyer','purchase','one');
 assert.equal(store.state.issued,30);
 assert.equal(store.state.burned,0);
});
